// "Continue with Google" and "Continue with Apple".
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../env.js';
import { HttpError } from './util.js';

export const googleEnabled = () => Boolean(env.google.clientId && env.google.clientSecret);
export const appleEnabled = () => Boolean(env.apple.clientId && env.apple.teamId && env.apple.keyId && env.apple.privateKey);

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

export function appleAuthUrl(state) {
  const p = new URLSearchParams({
    client_id: env.apple.clientId,
    redirect_uri: callback('apple'),
    response_type: 'code',
    response_mode: 'form_post',
    scope: 'name email',
    state
  });
  return `https://appleid.apple.com/auth/authorize?${p}`;
}

const appleClientSecret = () =>
  jwt.sign({}, env.apple.privateKey, {
    algorithm: 'ES256',
    keyid: env.apple.keyId,
    issuer: env.apple.teamId,
    subject: env.apple.clientId,
    audience: 'https://appleid.apple.com',
    expiresIn: '5m'
  });

let appleKeys = { at: 0, keys: [] };
async function appleKey(kid) {
  if (Date.now() - appleKeys.at > 3600e3 || !appleKeys.keys.some((k) => k.kid === kid)) {
    const res = await fetch('https://appleid.apple.com/auth/keys');
    appleKeys = { at: Date.now(), keys: (await res.json()).keys || [] };
  }
  const jwk = appleKeys.keys.find((k) => k.kid === kid);
  if (!jwk) throw new HttpError(400, 'Apple sign-in didn’t work. Try again.');
  return crypto.createPublicKey({ key: jwk, format: 'jwk' });
}

/** `userJson` is only sent by Apple the first time someone signs in, and holds their name. */
export async function appleProfile(code, userJson) {
  const tokenRes = await fetch('https://appleid.apple.com/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: env.apple.clientId, client_secret: appleClientSecret(), code, grant_type: 'authorization_code', redirect_uri: callback('apple') })
  });
  const tokens = await tokenRes.json();
  if (!tokenRes.ok || !tokens.id_token) throw new HttpError(400, 'Apple sign-in didn’t work. Try again.');
  const { header } = jwt.decode(tokens.id_token, { complete: true });
  const claims = jwt.verify(tokens.id_token, await appleKey(header.kid), { algorithms: ['RS256'], audience: env.apple.clientId, issuer: 'https://appleid.apple.com' });
  if (!claims.email) throw new HttpError(400, 'Apple didn’t share an email address.');
  let name = '';
  try {
    const u = JSON.parse(userJson || '{}');
    name = [u.name?.firstName, u.name?.lastName].filter(Boolean).join(' ');
  } catch { /* first sign-in only */ }
  return { id: claims.sub, email: claims.email.toLowerCase(), emailVerified: claims.email_verified === true || claims.email_verified === 'true', name: name || claims.email.split('@')[0] };
}
