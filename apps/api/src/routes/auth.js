import express, { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { ah, parse, HttpError, makeRef } from '../lib/util.js';
import { setSession, clearSession, publicUser, requireAuth } from '../lib/auth.js';
import { issueToken, useToken, safeAppUrl, safeNext } from '../lib/tokens.js';
import { sendVerifyEmail, sendResetEmail, devOutbox } from '../lib/email.js';
import { googleEnabled, appleEnabled, makeState, readState, googleAuthUrl, googleProfile, appleAuthUrl, appleProfile } from '../lib/oauth.js';

const r = Router();
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many attempts. Wait a few minutes and try again.' } });

const referralFor = (name) => makeRef(name.split(' ')[0].toUpperCase().replace(/[^A-Z]/g, '').slice(0, 8) || 'MOVER', 4);

async function sendVerification(user, appUrl, next) {
  const token = await issueToken(user.id, 'VERIFY_EMAIL');
  const link = `${safeAppUrl(appUrl)}/verify-email?token=${token}&next=${encodeURIComponent(safeNext(next))}`;
  return sendVerifyEmail(user, link);
}

const RegisterBody = z.object({
  name: z.string().trim().min(2, 'Enter your full name'),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  phone: z.string().trim().refine((p) => p.replace(/\D/g, '').length >= 10, 'Enter an 11-digit phone number'),
  password: z.string().min(8, 'Use at least 8 characters'),
  referral: z.string().trim().optional(),
  appUrl: z.string().optional(),
  next: z.string().optional()
});

/** Creates the account and emails a confirmation link. They can log in once they confirm. */
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
  await sendVerification(user, body.appUrl, body.next);
  res.status(201).json({ needsVerification: true, email: user.email });
}));

const VerifyBody = z.object({ token: z.string().min(10) });

r.post('/verify', ah(async (req, res) => {
  const { token } = parse(VerifyBody, req.body);
  const user = await useToken(token, 'VERIFY_EMAIL');
  if (!user) throw new HttpError(400, 'This link has expired or was already used. Log in, or ask for a new link.');
  const updated = await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: user.emailVerifiedAt || new Date() } });
  setSession(res, updated);
  res.json({ user: publicUser(updated) });
}));

const EmailBody = z.object({ email: z.string().trim().toLowerCase().email('Enter a valid email'), appUrl: z.string().optional(), next: z.string().optional() });

r.post('/resend-verification', limiter, ah(async (req, res) => {
  const body = parse(EmailBody, req.body);
  const user = await prisma.user.findUnique({ where: { email: body.email } });
  if (user && !user.emailVerifiedAt) await sendVerification(user, body.appUrl, body.next);
  res.json({ ok: true });
}));

const LoginBody = z.object({ email: z.string().trim().toLowerCase().email('Enter a valid email'), password: z.string().min(1, 'Enter your password') });

r.post('/login', limiter, ah(async (req, res) => {
  const body = parse(LoginBody, req.body);
  const user = await prisma.user.findUnique({ where: { email: body.email } });
  if (user && !user.passwordHash) throw new HttpError(401, 'This account signs in with Google or Apple. Use that button, or reset your password to add one.');
  if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
    throw new HttpError(401, 'That email and password don’t match. Check them and try again.');
  }
  if (!user.emailVerifiedAt) {
    return res.status(403).json({ error: `Confirm your email first. We sent a link to ${user.email}.`, code: 'EMAIL_NOT_VERIFIED' });
  }
  setSession(res, user);
  res.json({ user: publicUser(user) });
}));

r.post('/forgot', limiter, ah(async (req, res) => {
  const body = parse(EmailBody, req.body);
  const user = await prisma.user.findUnique({ where: { email: body.email } });
  if (user) {
    const token = await issueToken(user.id, 'RESET_PASSWORD');
    await sendResetEmail(user, `${safeAppUrl(body.appUrl)}/reset-password?token=${token}`);
  }
  res.json({ ok: true });
}));

const ResetBody = z.object({ token: z.string().min(10), password: z.string().min(8, 'Use at least 8 characters') });

/** Also used by a new admin to set their first password. Proves they own the email, so it confirms it. */
r.post('/reset', limiter, ah(async (req, res) => {
  const body = parse(ResetBody, req.body);
  const user = await useToken(body.token, 'RESET_PASSWORD');
  if (!user) throw new HttpError(400, 'This link has expired or was already used. Ask for a new one.');
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

const ProfileBody = z.object({ name: z.string().trim().min(2).optional(), phone: z.string().trim().min(10).optional() });
r.patch('/me', requireAuth, ah(async (req, res) => {
  const data = parse(ProfileBody, req.body);
  const user = await prisma.user.update({ where: { id: req.user.id }, data });
  res.json({ user: publicUser(user) });
}));

/* ---------- Google and Apple ---------- */

r.get('/providers', (_req, res) => res.json({ google: googleEnabled(), apple: appleEnabled() }));

/** ?return=https://learn.moverstech.xyz/dashboard */
function startUrl(req) {
  let ret = `${env.learnUrl}/dashboard`;
  try {
    const u = new URL(String(req.query.return || ''));
    ret = `${safeAppUrl(u.origin)}${safeNext(u.pathname + u.search)}`;
  } catch { /* keep default */ }
  return ret;
}

/** Finds or creates the account for a Google/Apple sign-in, linking by email when it already exists. */
async function upsertOAuthUser(provider, p) {
  const idField = provider === 'google' ? 'googleId' : 'appleId';
  let user = await prisma.user.findUnique({ where: { [idField]: p.id } });
  if (!user) {
    const byEmail = await prisma.user.findUnique({ where: { email: p.email } });
    if (byEmail) {
      if (!p.emailVerified) throw new HttpError(400, 'Your email isn’t confirmed with that provider. Log in with your password instead.');
      user = await prisma.user.update({ where: { id: byEmail.id }, data: { [idField]: p.id, emailVerifiedAt: byEmail.emailVerifiedAt || new Date() } });
    } else {
      user = await prisma.user.create({
        data: { [idField]: p.id, email: p.email, name: p.name, referralCode: referralFor(p.name), emailVerifiedAt: p.emailVerified ? new Date() : null }
      });
    }
  }
  return user;
}

function finish(res, user, returnTo) {
  const origin = new URL(returnTo).origin;
  if (!user.emailVerifiedAt) return res.redirect(303, `${origin}/login?error=${encodeURIComponent('Confirm your email with that provider first.')}`);
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
    finish(res, await upsertOAuthUser('google', await googleProfile(String(req.query.code || ''))), returnTo);
  } catch (e) {
    if (!e.status || e.status >= 500) console.error(e);
    failTo(res, returnTo, e);
  }
});

r.get('/apple', (req, res) => {
  if (!appleEnabled()) return res.status(404).json({ error: 'Apple sign-in isn’t set up.' });
  res.redirect(appleAuthUrl(makeState(startUrl(req))));
});

// Apple posts the result back as a form.
r.post('/apple/callback', express.urlencoded({ extended: false }), async (req, res) => {
  let returnTo = `${env.learnUrl}/dashboard`;
  try {
    returnTo = readState(req.body.state);
    if (req.body.error) throw new HttpError(400, 'Apple sign-in was cancelled.');
    finish(res, await upsertOAuthUser('apple', await appleProfile(String(req.body.code || ''), req.body.user)), returnTo);
  } catch (e) {
    if (!e.status || e.status >= 500) console.error(e);
    failTo(res, returnTo, e);
  }
});

/* ---------- local development only ---------- */
if (!env.isProd) r.get('/dev-outbox', (_req, res) => res.json({ emails: devOutbox }));

export default r;
