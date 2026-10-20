import crypto from 'node:crypto';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const bad = (msg) => new HttpError(400, msg);
export const notFound = (what = 'That') => new HttpError(404, `${what} was not found.`);

/** Wraps an async route so thrown errors reach the error handler. */
export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Validates input with a zod schema and turns the first problem into a readable 400. */
export function parse(schema, data) {
  const r = schema.safeParse(data);
  if (!r.success) {
    const issue = r.error.issues[0];
    const field = issue.path.join('.');
    throw bad(field ? `${field}: ${issue.message}` : issue.message);
  }
  return r.data;
}

export const naira = (n) => '₦' + Math.round(n).toLocaleString('en-NG');

const REF_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function makeRef(prefix, len = 6) {
  let s = '';
  for (let i = 0; i < len; i++) s += REF_CHARS[crypto.randomInt(REF_CHARS.length)];
  return `${prefix}-${s}`;
}

/** A referral code like MV-7K2Q9P. Random, never made from the person's name. */
export const newReferralCode = () => makeRef('MV', 6);

export const waLink = (number, text) => `https://wa.me/${number}?text=${encodeURIComponent(text)}`;

/** "0803 000 0000" -> "2348030000000" for wa.me links. */
export function phoneToWa(phone) {
  const d = String(phone || '').replace(/\D/g, '');
  if (d.startsWith('234')) return d;
  if (d.startsWith('0')) return '234' + d.slice(1);
  return d;
}

/** "2026-10-26" -> local midnight (Lagos). */
export function dateOnly(s) {
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function atHour(dateStr, hour) {
  const d = dateOnly(dateStr);
  d.setHours(hour, 0, 0, 0);
  return d;
}

export const startOfDay = (d = new Date()) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

export const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

export const sameDay = (a, b) => startOfDay(a).getTime() === startOfDay(b).getTime();
