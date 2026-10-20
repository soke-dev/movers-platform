import jwt from 'jsonwebtoken';
import { env } from '../env.js';
import { prisma } from '../db.js';

const COOKIE = 'movers_session';
const MAX_AGE = 30 * 24 * 60 * 60 * 1000;

export function setSession(res, user) {
  const token = jwt.sign({ sub: user.id }, env.jwtSecret, { expiresIn: '30d' });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: 'lax',
    domain: env.cookieDomain,
    maxAge: MAX_AGE,
    path: '/'
  });
}

export function clearSession(res) {
  res.clearCookie(COOKIE, { domain: env.cookieDomain, path: '/' });
}

/** Attaches req.user when a valid session cookie is present. */
export async function loadUser(req, _res, next) {
  const token = req.cookies?.[COOKIE];
  if (token) {
    try {
      const payload = jwt.verify(token, env.jwtSecret);
      req.user = await prisma.user.findUnique({ where: { id: payload.sub } });
    } catch {
      req.user = null;
    }
  }
  next();
}

export const requireAuth = (req, res, next) =>
  req.user ? next() : res.status(401).json({ error: 'Please log in to continue.' });

export const requireStaff = (req, res, next) =>
  req.user && req.user.role !== 'USER' ? next() : res.status(403).json({ error: 'This page is for Movers staff.' });

export const publicUser = (u) =>
  u && { id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, referralCode: u.referralCode };
