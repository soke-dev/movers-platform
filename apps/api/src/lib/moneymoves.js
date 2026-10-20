// Money Moves Business: online payments by bank transfer, the Money Moves app or stablecoin.
// Docs: https://docs.usemoneymoves.xyz
import crypto from 'node:crypto';
import { env } from '../env.js';
import { HttpError } from './util.js';

export const moneyMovesEnabled = () => Boolean(env.moneyMovesKey);

async function call(path, { method = 'GET', body, idempotencyKey } = {}) {
  const res = await fetch(env.moneyMovesBase + path, {
    method,
    headers: {
      Authorization: `Bearer ${env.moneyMovesKey}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('Money Moves error', res.status, data?.error);
    throw new HttpError(502, data?.error?.message || 'Online payment is unavailable right now. Choose WhatsApp or pay at the office.');
  }
  return data;
}

/** Amount is in naira. Returns the checkout, whose `url` is the page the customer pays on. */
export const createCheckout = ({ amount, description, reference, customer, metadata, redirectUrl, idempotencyKey }) =>
  call('/checkouts', {
    method: 'POST',
    idempotencyKey,
    body: {
      amount,
      currency: 'NGN',
      description: description.slice(0, 200),
      reference: reference.slice(0, 100),
      customer,
      metadata,
      expires_in: 24 * 3600,
      redirect_url: redirectUrl
    }
  });

export const getCheckout = (id) => call(`/checkouts/${encodeURIComponent(id)}`);

export const getPayment = (id) => call(`/payments/${encodeURIComponent(id)}`);

/**
 * `payment` is the Money Moves payment id. `amount` is in the currency the customer paid in
 * (NGN, or USD for the app and crypto); leave it out to refund what's left.
 */
export const createRefund = ({ payment, amount, reason, idempotencyKey }) =>
  call('/refunds', { method: 'POST', idempotencyKey, body: { payment, ...(amount != null ? { amount } : {}), ...(reason ? { reason: reason.slice(0, 280) } : {}) } });

/** Retrieving a refund also checks whether our transfer to its account has arrived. */
export const getRefund = (id) => call(`/refunds/${encodeURIComponent(id)}`);

export const cancelRefund = (id) => call(`/refunds/${encodeURIComponent(id)}/cancel`, { method: 'POST' });

/**
 * Checks the mm-signature header: "t=<unix seconds>,v1=<hex HMAC-SHA256 of `${t}.${rawBody}`>".
 * Rejects signatures older than five minutes.
 */
export function validSignature(rawBody, header) {
  if (!header || !env.moneyMovesWebhookSecret) return false;
  const parts = Object.fromEntries(String(header).split(',').map((p) => p.split('=')));
  const t = Number(parts.t);
  if (!t || !parts.v1 || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const expected = crypto.createHmac('sha256', env.moneyMovesWebhookSecret).update(`${t}.`).update(rawBody).digest('hex');
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(parts.v1, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
