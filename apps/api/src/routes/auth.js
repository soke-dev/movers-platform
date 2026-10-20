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

const sendVerification = async (user) => sendVerifyEmail(user, await issueCode(user.id, 'VERIFY_EMAIL'));

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

const RegisterBody = z.object({
  name: z.string().trim().min(2, 'Enter your full name'),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  phone: NigeriaPhone,
  password: Password,
  referral: z.string().trim().optional()
});

/** Creates the account and emails a 6-digit code. Entering it confirms the email and logs them in. */
r.post('/register', limiter, ah(async (req, res) => {
  const body = parse(RegisterBody, req.body);
  const existing = await prisma.user.findUnique({ where: { email: body.email } });
  if (existing?.emailVerifiedAt) throw new HttpError(409, 'An account with this email already exists. Log in instead.');
  const referrer = body.referral ? await prisma.user.findUnique({ where: { referralCode: body.referral.toUpperCase() } }) : null;
  const data = { name: body.name, phone: body.phone, passwordHash: await bcrypt.hash(body.password, 10) };
  // An unconfirmed account with this email can be signed up again (e.g. they lost the email).
  const user = existing
    ? await prisma.user.update({ where: { id: existing.id }, data })
    : await prisma.user.create({ data: { ...data, email: body.email, referralCode: referralFor(body.name), referredById: referrer?.id } });
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
  if (user) await sendResetEmail(user, await issueCode(user.id, 'RESET_PASSWORD'));
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

const ProfileBody = z.object({ name: z.string().trim().min(2).optional(), phone: NigeriaPhone.optional() });
r.patch('/me', requireAuth, ah(async (req, res) => {
  const data = parse(ProfileBody, req.body);
  const user = await prisma.user.update({ where: { id: req.user.id }, data });
  res.json({ user: publicUser(user) });
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
async function upsertGoogleUser(p) {
  let user = await prisma.user.findUnique({ where: { googleId: p.id } });
  if (!user) {
    const byEmail = await prisma.user.findUnique({ where: { email: p.email } });
    if (byEmail) {
      if (!p.emailVerified) throw new HttpError(400, 'Your email isn’t confirmed with Google. Log in with your password instead.');
      user = await prisma.user.update({ where: { id: byEmail.id }, data: { googleId: p.id, emailVerifiedAt: byEmail.emailVerifiedAt || new Date() } });
    } else {
      user = await prisma.user.create({
        data: { googleId: p.id, email: p.email, name: p.name, referralCode: referralFor(p.name), emailVerifiedAt: p.emailVerified ? new Date() : null }
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
  res.redirect(googleAuthUrl(makeState(startUrl(req))));
});

r.get('/google/callback', async (req, res) => {
  let returnTo = `${env.learnUrl}/dashboard`;
  try {
    returnTo = readState(req.query.state);
    if (req.query.error) throw new HttpError(400, 'Google sign-in was cancelled.');
    finish(res, await upsertGoogleUser(await googleProfile(String(req.query.code || ''))), returnTo);
  } catch (e) {
    if (!e.status || e.status >= 500) console.error(e);
    failTo(res, returnTo, e);
  }
});

/* ---------- local development only ---------- */
if (!env.isProd) r.get('/dev-outbox', (_req, res) => res.json({ emails: devOutbox }));

export default r;
