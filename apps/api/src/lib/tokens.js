import crypto from 'node:crypto';
import { prisma } from '../db.js';
import { env } from '../env.js';

const hash = (t) => crypto.createHash('sha256').update(t).digest('hex');
const TTL = { VERIFY_EMAIL: 24 * 3600e3, RESET_PASSWORD: 3600e3 };

/** Creates a one-time token and returns the raw value (only its hash is stored). */
export async function issueToken(userId, kind, ttlMs = TTL[kind]) {
  await prisma.authToken.deleteMany({ where: { userId, kind, usedAt: null } });
  const raw = crypto.randomBytes(32).toString('hex');
  await prisma.authToken.create({ data: { userId, kind, tokenHash: hash(raw), expiresAt: new Date(Date.now() + ttlMs) } });
  return raw;
}

/** Marks a token used and returns its user, or null if it's wrong, used or expired. */
export async function useToken(raw, kind) {
  const t = await prisma.authToken.findUnique({ where: { tokenHash: hash(String(raw || '')) }, include: { user: true } });
  if (!t || t.kind !== kind || t.usedAt || t.expiresAt < new Date()) return null;
  await prisma.authToken.update({ where: { id: t.id }, data: { usedAt: new Date() } });
  return t.user;
}

/** Only our own sites may appear in email links and sign-in redirects. */
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
