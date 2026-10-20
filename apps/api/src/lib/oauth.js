// "Continue with Google".
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../env.js';
import { HttpError } from './util.js';

export const googleEnabled = () => Boolean(env.google.clientId && env.google.clientSecret);

const callback = (provider) => `${env.publicApiUrl}/auth/${provider}/callback`;

/** Signed state carries where to send the person afterwards, and stops forged callbacks. */
export const makeState = (returnTo) => jwt.sign({ r: returnTo, n: crypto.randomBytes(8).toString('hex') }, env.jwtSecret, { expiresIn: '15m' });
export function readState(state) {
  try {
    return jwt.verify(String(state || ''), env.jwtSecret).r;
  } catch {
    throw new HttpError(400, 'That sign-in link expired. Try again.');
  }
}

export function googleAuthUrl(state) {
  const p = new URLSearchParams({
    client_id: env.google.clientId,
    redirect_uri: callback('google'),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account'
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

/** Returns { id, email, emailVerified, name }. */
export async function googleProfile(code) {
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: env.google.clientId, client_secret: env.google.clientSecret, redirect_uri: callback('google'), grant_type: 'authorization_code' })
  });
  const tokens = await tokenRes.json();
  if (!tokenRes.ok) throw new HttpError(400, 'Google sign-in didn’t work. Try again.');
  const infoRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${tokens.access_token}` } });
  const info = await infoRes.json();
  if (!infoRes.ok || !info.email) throw new HttpError(400, 'Google didn’t share an email address.');
  return { id: info.sub, email: info.email.toLowerCase(), emailVerified: info.email_verified === true, name: info.name || info.email.split('@')[0] };
}
