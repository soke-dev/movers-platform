import crypto from 'node:crypto';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { HttpError } from './util.js';

// The user id is mixed in so two people can hold the same 6 digits.
const hash = (userId, code) => crypto.createHash('sha256').update(`${userId}:${code}`).digest('hex');
const CODE_TTL = 10 * 60e3;
const MAX_TRIES = 5;

/** Emails get a fresh 6-digit code; any earlier code of the same kind stops working. Returns the code. */
export async function issueCode(userId, kind) {
  await prisma.authToken.deleteMany({ where: { userId, kind } });
  const code = String(crypto.randomInt(0, 1e6)).padStart(6, '0');
  await prisma.authToken.create({ data: { userId, kind, tokenHash: hash(userId, code), expiresAt: new Date(Date.now() + CODE_TTL) } });
  return code;
}

/** Checks a code for this email and uses it up. Returns the user, or throws a message to show. */
export async function useCode(email, code, kind) {
  const user = await prisma.user.findUnique({ where: { email } });
  const t = user && (await prisma.authToken.findFirst({ where: { userId: user.id, kind, usedAt: null }, orderBy: { createdAt: 'desc' } }));
  if (!t || t.expiresAt < new Date()) throw new HttpError(400, 'That code has expired. Ask for a new one.');
  if (t.attempts >= MAX_TRIES) throw new HttpError(400, 'Too many wrong tries. Ask for a new code.');
  const a = Buffer.from(t.tokenHash, 'hex');
  const b = Buffer.from(hash(user.id, String(code || '').replace(/\D/g, '')), 'hex');
  if (!crypto.timingSafeEqual(a, b)) {
    await prisma.authToken.update({ where: { id: t.id }, data: { attempts: { increment: 1 } } });
    throw new HttpError(400, t.attempts + 1 >= MAX_TRIES ? 'Too many wrong tries. Ask for a new code.' : 'That code isn’t right. Check the email and try again.');
  }
  await prisma.authToken.update({ where: { id: t.id }, data: { usedAt: new Date() } });
  return user;
}

/** Only our own sites may appear in sign-in redirects. */
export function safeAppUrl(url, fallback = env.learnUrl) {
  const allowed = [env.learnUrl, env.spaceUrl, env.adminUrl, ...env.origins];
  try {
    const u = new URL(url);
    return allowed.includes(u.origin) ? u.origin : fallback;
  } catch {
    return fallback;
  }
}

export const safeNext = (next) => (typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard');
