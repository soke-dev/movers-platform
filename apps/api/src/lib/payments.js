import { prisma } from '../db.js';
import { env } from '../env.js';
import { bad, HttpError, makeRef, naira, waLink } from './util.js';
import { createCheckout, getCheckout, moneyMovesEnabled } from './moneymoves.js';
import { sendReceiptEmail } from './email.js';

export const PREFIX = { ENROLLMENT: 'MVL', BOOKING: 'MVS', PASS: 'MVS', OTHER: 'MV' };

export function newPayment(data) {
  return prisma.payment.create({ data: { ...data, reference: makeRef(PREFIX[data.purpose] || 'MV') } });
}

const allowedReturn = (url) => typeof url === 'string' && env.origins.some((o) => url.startsWith(o));

/**
 * Starts paying an existing payment with the chosen method.
 * Returns what the page should do next.
 */
export async function startPayment(payment, user, method, returnUrl) {
  if (payment.status === 'PAID') throw bad('This is already paid.');
  if (payment.status === 'CANCELLED') throw bad('This payment was cancelled.');

  if (method === 'LATER') {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: 'UNPAID', method: null } });
    await syncTarget(payment);
    return { type: 'later', reference: payment.reference };
  }

  if (method === 'WHATSAPP' || method === 'OFFICE') {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: 'PENDING', method } });
    await syncTarget(payment);
    if (method === 'OFFICE') return { type: 'office', reference: payment.reference };
    const message = `Hello Movers team, I want to pay ${naira(payment.amount)} for ${payment.description}. Name: ${user.name}. Reference: ${payment.reference}.`;
    return { type: 'whatsapp', reference: payment.reference, message, url: waLink(env.whatsappNumber, message) };
  }

  // ONLINE, through a Money Moves checkout page
  if (!moneyMovesEnabled()) {
    if (env.fakePayments) {
      await markPaid(payment.id, null, 'ONLINE');
      return { type: 'paid', reference: payment.reference };
    }
    throw new HttpError(503, 'Online payment is not switched on yet. Choose WhatsApp or pay at the office.');
  }
  if (!allowedReturn(returnUrl)) throw bad('Invalid return address.');

  // Reuse a checkout that is still open, so going back and forth doesn't create new ones.
  if (payment.gatewayRef) {
    const existing = await getCheckout(payment.gatewayRef).catch(() => null);
    if (existing?.status === 'open' && existing.url) return { type: 'redirect', url: existing.url, reference: payment.reference };
    if (existing?.status === 'paid') {
      await markPaid(payment.id, null, 'ONLINE');
      return { type: 'paid', reference: payment.reference };
    }
  }
  const sep = returnUrl.includes('?') ? '&' : '?';
  const checkout = await createCheckout({
    amount: payment.amount,
    description: payment.description,
    reference: payment.reference,
    customer: { email: user.email, name: user.name },
    metadata: { payment_id: payment.id, purpose: payment.purpose },
    redirectUrl: `${returnUrl}${sep}ref=${encodeURIComponent(payment.reference)}`,
    idempotencyKey: makeRef(payment.reference, 8)
  });
  await prisma.payment.update({ where: { id: payment.id }, data: { method: 'ONLINE', gatewayRef: checkout.id } });
  return { type: 'redirect', url: checkout.url, reference: payment.reference };
}

/** Confirms an online payment with Money Moves. Safe to call more than once. */
export async function settleOnline(payment) {
  if (!payment || payment.status === 'PAID' || !payment.gatewayRef || !moneyMovesEnabled()) return payment;
  const checkout = await getCheckout(payment.gatewayRef);
  const paid = checkout.payment;
  if (checkout.status === 'paid' && paid?.status === 'successful' && Number(paid.received_ngn ?? paid.amount_ngn) >= payment.amount) {
    return markPaid(payment.id, null, 'ONLINE');
  }
  return payment;
}

export async function markPaid(paymentId, staffId, method) {
  const p = await prisma.payment.update({
    where: { id: paymentId },
    data: { status: 'PAID', paidAt: new Date(), confirmedById: staffId || null, ...(method ? { method } : {}) },
    include: { user: true }
  });
  await syncTarget(p);
  sendReceiptEmail(p.user, p).catch((e) => console.error('Receipt email failed', e));
  return p;
}

/** Staff says the money never arrived: back to unpaid so the person can try again. */
export async function markUnpaid(paymentId) {
  const p = await prisma.payment.update({ where: { id: paymentId }, data: { status: 'UNPAID', method: null } });
  await syncTarget(p);
  return p;
}

export async function syncTarget(p) {
  if (p.bookingId) await syncBooking(p.bookingId);
  if (p.passId) await syncPass(p.passId);
}

async function syncBooking(id) {
  const b = await prisma.booking.findUnique({ where: { id }, include: { payments: true } });
  if (!b || b.status === 'CANCELLED') return;
  const status = b.payments.some((x) => x.status === 'PAID') ? 'CONFIRMED' : b.payments.some((x) => x.status === 'PENDING') ? 'HELD' : 'UNPAID';
  if (status !== b.status) await prisma.booking.update({ where: { id }, data: { status } });
}

async function syncPass(id) {
  const pass = await prisma.pass.findUnique({ where: { id }, include: { payments: true } });
  if (!pass || pass.status === 'CANCELLED' || pass.status === 'EXPIRED') return;
  const status = pass.payments.some((x) => x.status === 'PAID') ? 'ACTIVE' : pass.payments.some((x) => x.status === 'PENDING') ? 'HELD' : 'UNPAID';
  if (status !== pass.status) await prisma.pass.update({ where: { id }, data: { status } });
}

export const paymentView = (p) => ({
  id: p.id,
  reference: p.reference,
  amount: p.amount,
  purpose: p.purpose,
  description: p.description,
  method: p.method,
  status: p.status,
  dueDate: p.dueDate,
  paidAt: p.paidAt,
  createdAt: p.createdAt,
  // Money given back so far; only filled in where the query includes refunds.
  refunded: (p.refunds || []).filter((x) => x.status === 'PROCESSING' || x.status === 'COMPLETED').reduce((s, x) => s + x.amount, 0)
});
