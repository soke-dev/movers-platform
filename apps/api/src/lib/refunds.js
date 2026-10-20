// Refunds on paid payments. Online payments go back through Money Moves, the way the customer
// paid: Money Moves gives a one-time account, staff transfer the amount it shows, and Money Moves
// sends the money on. Cash, POS and WhatsApp transfers are paid back by staff and recorded here.
import { prisma } from '../db.js';
import { bad, notFound, makeRef, naira } from './util.js';
import { createRefund, getRefund, cancelRefund as cancelMoneyMovesRefund, getCheckout, getPayment, moneyMovesEnabled } from './moneymoves.js';
import { sendRefundEmail } from './email.js';

const STATUS = { awaiting_funds: 'AWAITING_FUNDS', processing: 'PROCESSING', completed: 'COMPLETED', cancelled: 'CANCELLED' };

/** Where staff send the money. Null when Money Moves refunds from funds it is still holding. */
const fundingOf = (f) =>
  f?.bank ? { amount: f.amount_ngn, bank: f.bank.name, accountNumber: f.bank.account_number, accountName: f.bank.account_name, expiresAt: f.bank.expires_at } : null;

/** Refunds that count against the payment: everything not cancelled. */
export const refundable = (payment, refunds) =>
  payment.amount - refunds.filter((x) => x.status !== 'CANCELLED').reduce((s, x) => s + x.amount, 0);

export const goesThroughMoneyMoves = (payment) => payment.method === 'ONLINE' && Boolean(payment.gatewayRef) && moneyMovesEnabled();

const notify = (payment, refund) => sendRefundEmail(payment.user, payment, refund).catch((e) => console.error('Refund email failed', e));

/** Starts a refund of `amount` naira (the whole remaining amount when left out). */
export async function startRefund(paymentId, { amount, reason = '' }, staffId) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId }, include: { refunds: true, user: true } });
  if (!payment) throw notFound('Payment');
  if (payment.status !== 'PAID') throw bad('Only paid payments can be refunded.');
  const left = refundable(payment, payment.refunds);
  if (left <= 0) throw bad('This payment has already been refunded in full.');
  const value = amount ?? left;
  if (value < 1 || value > left) throw bad(`You can refund up to ${naira(left)}.`);

  if (!goesThroughMoneyMoves(payment)) {
    const refund = await prisma.refund.create({ data: { paymentId, amount: value, reason, status: 'COMPLETED', completedAt: new Date(), createdById: staffId } });
    notify(payment, refund);
    return refund;
  }

  if (payment.refunds.some((x) => x.status === 'AWAITING_FUNDS')) throw bad('A refund on this payment is still waiting for your transfer. Fund it or cancel it first.');
  const mm = (await getCheckout(payment.gatewayRef)).payment;
  if (!mm?.id) throw bad('Money Moves has no completed payment for this checkout.');
  // Money Moves takes the amount in the currency the customer paid in: naira, or US dollars for the app and crypto.
  const mmAmount = value === left ? undefined : mm.currency === 'NGN' ? value : Math.round(((Number(mm.amount_usd) * value) / payment.amount) * 100) / 100;
  const out = await createRefund({ payment: mm.id, amount: mmAmount, reason, idempotencyKey: makeRef(`${payment.reference}-R`, 8) });
  const status = STATUS[out.status] || 'AWAITING_FUNDS';
  const refund = await prisma.refund.create({
    data: { paymentId, amount: value, reason, viaMoneyMoves: true, status, gatewayRef: out.id, funding: fundingOf(out.funding), createdById: staffId, completedAt: status === 'COMPLETED' ? new Date() : null }
  });
  if (status === 'COMPLETED') notify(payment, refund);
  return refund;
}

/** Brings a Money Moves refund up to date, from a webhook's refund object or by asking. Safe to call more than once. */
export async function syncRefund(refund, mmRefund) {
  if (!refund.viaMoneyMoves || !refund.gatewayRef || refund.status === 'COMPLETED' || refund.status === 'CANCELLED') return refund;
  const out = mmRefund || (await getRefund(refund.gatewayRef));
  const status = STATUS[out.status];
  if (!status || status === refund.status) return refund;
  // Only the call that moves it from the status we read sends the email.
  const { count } = await prisma.refund.updateMany({
    where: { id: refund.id, status: refund.status },
    data: { status, funding: fundingOf(out.funding) ?? refund.funding ?? undefined, ...(status === 'COMPLETED' ? { completedAt: new Date() } : {}) }
  });
  const updated = await prisma.refund.findUnique({ where: { id: refund.id }, include: { payment: { include: { user: true } } } });
  if (count && status === 'COMPLETED') notify(updated.payment, updated);
  return updated;
}

export async function cancelRefund(refund) {
  if (refund.status !== 'AWAITING_FUNDS') throw bad('Only a refund still waiting for your transfer can be cancelled.');
  if (refund.viaMoneyMoves) await cancelMoneyMovesRefund(refund.gatewayRef);
  return prisma.refund.update({ where: { id: refund.id }, data: { status: 'CANCELLED' } });
}

/** A refund.created or refund.completed webhook. Records refunds started in the Money Moves dashboard too. */
export async function refundFromWebhook(mmRefund) {
  if (!mmRefund?.id) return;
  let refund = await prisma.refund.findUnique({ where: { gatewayRef: mmRefund.id } });
  if (!refund) {
    const mm = await getPayment(mmRefund.payment).catch(() => null);
    const payment = mm && (await prisma.payment.findFirst({ where: { OR: [{ gatewayRef: mm.checkout || '__none__' }, { reference: mm.checkout_reference || '__none__' }] } }));
    if (!payment) return;
    refund = await prisma.refund.upsert({
      where: { gatewayRef: mmRefund.id },
      update: {},
      create: { paymentId: payment.id, amount: Math.round(Number(mmRefund.amount_ngn) || 0), reason: mmRefund.reason || '', viaMoneyMoves: true, status: 'AWAITING_FUNDS', gatewayRef: mmRefund.id, funding: fundingOf(mmRefund.funding) }
    });
  }
  await syncRefund(refund, mmRefund);
}

export const refundView = (x) => ({
  id: x.id,
  amount: x.amount,
  reason: x.reason,
  status: x.status,
  viaMoneyMoves: x.viaMoneyMoves,
  funding: x.funding,
  createdAt: x.createdAt,
  completedAt: x.completedAt
});
