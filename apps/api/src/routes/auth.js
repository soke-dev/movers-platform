import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { ah, parse, HttpError, makeRef } from '../lib/util.js';
import { setSession, clearSession, publicUser, requireAuth } from '../lib/auth.js';
import { issueCode, useCode, safeAppUrl, safeNext } from '../lib/tokens.js';
import { sendVerifyEmail, sendResetEmail, devOutbox } from '../lib/email.js';
import { googleEnabled, makeState, readState, googleAuthUrl, googleProfile } from '../lib/oauth.js';

const r = Router();
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many attempts. Wait a few minutes and try again.' } });

const referralFor = (name) => makeRef(name.split(' ')[0].toUpperCase().replace(/[^A-Z]/g, '').slice(0, 8) || 'MOVER', 4);

/** Tells the person when the email didn't go, instead of leaving them waiting for a code. */
const mustSend = (sent) => {
  if (!sent) throw new HttpError(502, 'We couldn’t send the email just now. Try again in a minute, or call us if it keeps happening.');
};
const sendVerification = async (user) => mustSend(await sendVerifyEmail(user, await issueCode(user.id, 'VERIFY_EMAIL')));

/** Nigerian numbers only, stored as +234 and 10 digits. Accepts 0803…, 803…, +234803… */
const NigeriaPhone = z.string().trim().transform((p, ctx) => {
  let d = p.replace(/\D/g, '');
  if (d.startsWith('234')) d = d.slice(3);
  if (d.startsWith('0')) d = d.slice(1);
  if (!/^[789]\d{9}$/.test(d)) {
    ctx.addIssue({ code: 'custom', message: 'Enter your 10-digit phone number, e.g. 803 123 4567' });
    return z.NEVER;
  }
  return `+234${d}`;
});
const Password = z.string().min(6, 'Use at least 6 characters');
const FirstName = z.string().trim().min(1, 'Enter your first name').max(40);
const LastName = z.string().trim().min(1, 'Enter your last name').max(40);
// Names are stored as "First Last", so the first word is always the first name.
const fullName = (first, last) => `${first.replace(/\s+/g, '-')} ${last}`.trim();

const RegisterBody = z.object({
  firstName: FirstName,
  lastName: LastName,
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  phone: NigeriaPhone,
  password: Password,
  referral: z.string().trim().optional()
});

/** The person whose referral code this is. A code that was typed must exist; an empty one is fine. */
async function referrerFor(code) {
  const c = String(code || '').trim().toUpperCase();
  if (!c) return null;
  const referrer = await prisma.user.findUnique({ where: { referralCode: c } });
  if (!referrer) throw new HttpError(400, 'We couldn’t find that referral code. Check it, or leave it empty.');
  return referrer;
}

/** Creates the account and emails a 6-digit code. Entering it confirms the email and logs them in. */
r.post('/register', limiter, ah(async (req, res) => {
  const body = parse(RegisterBody, req.body);
  const existing = await prisma.user.findUnique({ where: { email: body.email } });
  if (existing?.emailVerifiedAt) throw new HttpError(409, 'An account with this email already exists. Log in instead.');
  const referrer = await referrerFor(body.referral);
  const name = fullName(body.firstName, body.lastName);
  const data = { name, phone: body.phone, passwordHash: await bcrypt.hash(body.password, 10) };
  // An unconfirmed account with this email can be signed up again (e.g. they lost the email).
  const user = existing
    ? await prisma.user.update({ where: { id: existing.id }, data: { ...data, referredById: existing.referredById || referrer?.id } })
    : await prisma.user.create({ data: { ...data, email: body.email, referralCode: referralFor(name), referredById: referrer?.id } });
  await sendVerification(user);
  res.status(201).json({ needsVerification: true, email: user.email });
}));

const Email = z.string().trim().toLowerCase().email('Enter a valid email');
const Code = z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code from the email');
const VerifyBody = z.object({ email: Email, code: Code });

r.post('/verify', limiter, ah(async (req, res) => {
  const { email, code } = parse(VerifyBody, req.body);
  const user = await useCode(email, code, 'VERIFY_EMAIL');
  const updated = await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: user.emailVerifiedAt || new Date() } });
  setSession(res, updated);
  res.json({ user: publicUser(updated) });
}));

const EmailBody = z.object({ email: Email });

r.post('/resend-verification', limiter, ah(async (req, res) => {
  const body = parse(EmailBody, req.body);
  const user = await prisma.user.findUnique({ where: { email: body.email } });
  if (user && !user.emailVerifiedAt) await sendVerification(user);
  res.json({ ok: true });
}));

const LoginBody = z.object({ email: Email, password: z.string().min(1, 'Enter your password') });

/** Password only. The one exception: an email that was never confirmed gets a code first. */
r.post('/login', limiter, ah(async (req, res) => {
  const body = parse(LoginBody, req.body);
  const user = await prisma.user.findUnique({ where: { email: body.email } });
  if (user && !user.passwordHash) throw new HttpError(401, 'This account signs in with Google. Use that button, or tap “Forgot your password?” to add a password.');
  if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
    throw new HttpError(401, 'That email and password don’t match. Check them and try again.');
  }
  if (!user.emailVerifiedAt) {
    await sendVerification(user);
    return res.status(403).json({ error: `Confirm your email first. We sent a code to ${user.email}.`, code: 'EMAIL_NOT_VERIFIED' });
  }
  setSession(res, user);
  res.json({ user: publicUser(user) });
}));

r.post('/forgot', limiter, ah(async (req, res) => {
  const body = parse(EmailBody, req.body);
  const user = await prisma.user.findUnique({ where: { email: body.email } });
  if (user) mustSend(await sendResetEmail(user, await issueCode(user.id, 'RESET_PASSWORD')));
  res.json({ ok: true });
}));

const ResetBody = z.object({ email: Email, code: Code, password: Password });

/** Also how a new admin sets their first password. The code proves they own the email, so it confirms it. */
r.post('/reset', limiter, ah(async (req, res) => {
  const body = parse(ResetBody, req.body);
  const user = await useCode(body.email, body.code, 'RESET_PASSWORD');
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(body.password, 10), emailVerifiedAt: user.emailVerifiedAt || new Date() }
  });
  setSession(res, updated);
  res.json({ user: publicUser(updated) });
}));

r.post('/logout', (_req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

r.get('/me', (req, res) => res.json({ user: publicUser(req.user) || null }));

const Username = z.string().trim().toLowerCase().transform((u, ctx) => {
  const v = u.replace(/^@/, '');
  if (!v) return null; // empty clears it
  if (!/^[a-z0-9_]{3,20}$/.test(v)) {
    ctx.addIssue({ code: 'custom', message: 'Use 3–20 letters, numbers or _' });
    return z.NEVER;
  }
  return v;
});
const ProfileBody = z.object({ firstName: FirstName.optional(), lastName: LastName.optional(), phone: NigeriaPhone.optional(), username: Username.optional() });

/** Profile page: first and last name, phone and username. Email can't change here. */
r.patch('/me', requireAuth, ah(async (req, res) => {
  const body = parse(ProfileBody, req.body);
  const [first, ...rest] = req.user.name.split(' ');
  const data = {};
  if (body.firstName !== undefined || body.lastName !== undefined) data.name = fullName(body.firstName ?? first, body.lastName ?? rest.join(' '));
  if (body.phone !== undefined) data.phone = body.phone;
  if (body.username !== undefined) data.username = body.username;
  try {
    res.json({ user: publicUser(await prisma.user.update({ where: { id: req.user.id }, data })) });
  } catch (e) {
    if (e.code === 'P2002') throw new HttpError(409, 'That username is taken. Try another.');
    throw e;
  }
}));

const PasswordBody = z.object({ current: z.string().optional(), password: Password });

/** Change password. Accounts made with Google have none yet, so they can add one without a current password. */
r.post('/password', requireAuth, limiter, ah(async (req, res) => {
  const body = parse(PasswordBody, req.body);
  if (req.user.passwordHash && !(await bcrypt.compare(body.current || '', req.user.passwordHash))) {
    throw new HttpError(400, 'Your current password isn’t right.');
  }
  const user = await prisma.user.update({ where: { id: req.user.id }, data: { passwordHash: await bcrypt.hash(body.password, 10) } });
  res.json({ user: publicUser(user) });
}));

/** Refer a friend: their code, and the people who signed up with it and what they've done since. */
r.get('/referrals', requireAuth, ah(async (req, res) => {
  const people = await prisma.user.findMany({
    where: { referredById: req.user.id },
    orderBy: { createdAt: 'desc' },
    select: {
      name: true,
      createdAt: true,
      _count: { select: { visits: true } },
      enrollments: { where: { payments: { some: { status: 'PAID' } } }, select: { id: true } }
    }
  });
  res.json({
    code: req.user.referralCode,
    // First name and last initial only.
    referrals: people.map((p) => {
      const [first, ...rest] = p.name.split(' ');
      return { name: `${first}${rest.length ? ` ${rest.join(' ')[0]}.` : ''}`, joined: p.createdAt, joinedClass: p.enrollments.length > 0, visitedSpace: p._count.visits > 0 };
    })
  });
}));

/* ---------- Google ---------- */

r.get('/providers', (_req, res) => res.json({ google: googleEnabled() }));

/** ?return=https://learn.moverstech.xyz/dashboard */
function startUrl(req) {
  let ret = `${env.learnUrl}/dashboard`;
  try {
    const u = new URL(String(req.query.return || ''));
    ret = `${safeAppUrl(u.origin)}${safeNext(u.pathname + u.search)}`;
  } catch { /* keep default */ }
  return ret;
}

/** Finds or creates the account for a Google sign-in, linking by email when it already exists. */
async function upsertGoogleUser(p, ref) {
  let user = await prisma.user.findUnique({ where: { googleId: p.id } });
  if (!user) {
    const byEmail = await prisma.user.findUnique({ where: { email: p.email } });
    if (byEmail) {
      if (!p.emailVerified) throw new HttpError(400, 'Your email isn’t confirmed with Google. Log in with your password instead.');
      user = await prisma.user.update({ where: { id: byEmail.id }, data: { googleId: p.id, emailVerifiedAt: byEmail.emailVerifiedAt || new Date() } });
    } else {
      // A referral link that no longer works shouldn't stop them signing up with Google.
      const referrer = await referrerFor(ref).catch(() => null);
      user = await prisma.user.create({
        data: { googleId: p.id, email: p.email, name: p.name, referralCode: referralFor(p.name), referredById: referrer?.id, emailVerifiedAt: p.emailVerified ? new Date() : null }
      });
    }
  }
  return user;
}

function finish(res, user, returnTo) {
  const origin = new URL(returnTo).origin;
  if (!user.emailVerifiedAt) return res.redirect(303, `${origin}/login?error=${encodeURIComponent('Confirm your email with Google first.')}`);
  setSession(res, user);
  res.redirect(303, returnTo);
}

const failTo = (res, returnTo, e) => {
  const origin = (() => { try { return new URL(returnTo).origin; } catch { return env.learnUrl; } })();
  res.redirect(303, `${origin}/login?error=${encodeURIComponent(e.status && e.status < 500 ? e.message : 'Sign-in didn’t work. Try again.')}`);
};

r.get('/google', (req, res) => {
  if (!googleEnabled()) return res.status(404).json({ error: 'Google sign-in isn’t set up.' });
  res.redirect(googleAuthUrl(makeState(startUrl(req), String(req.query.ref || '').slice(0, 40))));
});

r.get('/google/callback', async (req, res) => {
  let returnTo = `${env.learnUrl}/dashboard`;
  try {
    const state = readState(req.query.state);
    returnTo = state.returnTo;
    if (req.query.error) throw new HttpError(400, 'Google sign-in was cancelled.');
    finish(res, await upsertGoogleUser(await googleProfile(String(req.query.code || '')), state.ref), returnTo);
  } catch (e) {
    if (!e.status || e.status >= 500) console.error(e);
    failTo(res, returnTo, e);
  }
});

/* ---------- local development only ---------- */
if (!env.isProd) r.get('/dev-outbox', (_req, res) => res.json({ emails: devOutbox }));

export default r;
