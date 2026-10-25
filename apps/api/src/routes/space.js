import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { ah, parse, bad, notFound, HttpError, startOfDay, addDays, isSunday } from '../lib/util.js';
import { requireAuth } from '../lib/auth.js';
import { newPayment, paymentView } from '../lib/payments.js';
import { getSettings, PASS_INFO, passWindow } from '../lib/pricing.js';
import { BookingInput, quoteBooking, isStudent } from './public.js';

const r = Router();
r.use(requireAuth);

export const passView = (p) => {
  const used = p.visits?.length ?? 0;
  return {
    id: p.id,
    kind: p.kind,
    label: Object.values(PASS_INFO).find((x) => x.kind === p.kind)?.label || (p.kind === 'BUNDLE' ? '10-day bundle' : p.kind),
    people: p.people,
    daysTotal: p.daysTotal,
    daysUsed: used,
    daysLeft: p.daysTotal == null ? null : Math.max(0, p.daysTotal - used),
    validFrom: p.validFrom,
    validUntil: p.validUntil,
    price: p.price,
    status: p.status,
    // Only filled in where the query includes them (the member's own dashboard).
    payments: (p.payments || []).map(paymentView)
  };
};

export const bookingView = (b) => ({
  id: b.id,
  room: b.room?.name,
  roomKind: b.room?.kind,
  start: b.start,
  end: b.end,
  people: b.people,
  layout: b.layout,
  details: b.details,
  total: b.total,
  status: b.status,
  payments: (b.payments || []).map(paymentView)
});

/**
 * An unpaid pass whose dates have passed can't be used any more, so it and its unpaid payment are
 * cancelled: nobody keeps owing for a day that's gone. Pass a userId to tidy one member's passes.
 */
export async function expireUnpaidPasses(userId) {
  const stale = await prisma.pass.findMany({ where: { status: 'UNPAID', validUntil: { lt: new Date() }, ...(userId ? { userId } : {}) }, select: { id: true } });
  if (!stale.length) return;
  const ids = stale.map((p) => p.id);
  await prisma.payment.updateMany({ where: { passId: { in: ids }, status: 'UNPAID' }, data: { status: 'CANCELLED' } });
  await prisma.pass.updateMany({ where: { id: { in: ids } }, data: { status: 'CANCELLED' } });
}

/** Picks the pass a check-in should use today, best value first. */
export async function usablePass(userId) {
  const now = new Date();
  const passes = await prisma.pass.findMany({
    where: { userId, status: 'ACTIVE', validFrom: { lte: now }, validUntil: { gt: startOfDay(now) } },
    include: { visits: true }
  });
  const order = { DEDICATED: 0, MONTHLY: 1, WEEKLY: 2, BUNDLE: 3, DAY: 4 };
  const today = startOfDay(now);
  return passes
    .filter((p) => p.daysTotal == null || p.visits.length < p.daysTotal)
    .filter((p) => p.visits.filter((v) => v.checkedInAt >= today).length < p.people)
    .sort((a, b) => order[a.kind] - order[b.kind])[0];
}

export async function freeDesk() {
  const s = await getSettings();
  const open = await prisma.visit.findMany({ where: { checkedInAt: { gte: startOfDay() }, checkedOutAt: null }, select: { desk: true } });
  const taken = new Set(open.map((v) => v.desk));
  for (let d = 1; d <= s.desks; d++) if (!taken.has(d)) return d;
  return null;
}

r.get('/me', ah(async (req, res) => {
  const uid = req.user.id;
  await expireUnpaidPasses(uid);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const [passes, visits, openVisit, bookings, payments, referrals, student] = await Promise.all([
    prisma.pass.findMany({ where: { userId: uid }, orderBy: { createdAt: 'desc' }, include: { visits: true, payments: true } }),
    prisma.visit.findMany({ where: { userId: uid, checkedInAt: { gte: addDays(monthStart, -62) } }, orderBy: { checkedInAt: 'desc' } }),
    prisma.visit.findFirst({ where: { userId: uid, checkedInAt: { gte: startOfDay() }, checkedOutAt: null } }),
    prisma.booking.findMany({ where: { userId: uid }, orderBy: { start: 'desc' }, take: 40, include: { room: true, payments: { include: { refunds: true } } } }),
    prisma.payment.findMany({ where: { userId: uid, purpose: { in: ['BOOKING', 'PASS'] } }, orderBy: { createdAt: 'desc' }, include: { refunds: true } }),
    prisma.user.findMany({ where: { referredById: uid }, select: { name: true, createdAt: true, _count: { select: { visits: true } } } }),
    isStudent(uid)
  ]);
  res.json({
    passes: passes.map(passView),
    activePass: passes.map(passView).find((p) => p.status === 'ACTIVE' && new Date(p.validUntil) > new Date() && (p.daysLeft == null || p.daysLeft > 0)) || null,
    visits,
    openVisit,
    bookings: bookings.map(bookingView),
    payments: payments.map(paymentView),
    referralCode: req.user.referralCode,
    referrals: referrals.map((x) => ({ name: x.name, joined: x.createdAt, visited: x._count.visits > 0 })),
    isStudent: student,
    checkinCode: `MOVERS:${req.user.referralCode}`
  });
}));

/** Creates a pass or a room/hall booking with its unpaid payment(s). Used by members and by staff. */
export async function createOrder(userId, input) {
  const user = { id: userId, isStudent: await isStudent(userId) };
  const q = await quoteBooking(input, user);
  if (q.error) throw bad(q.error);

  if (input.type === 'desk') {
    const info = PASS_INFO[input.pass];
    const { from, until } = passWindow(input.pass, input.date);
    if (from < startOfDay()) throw bad('Pick today or a later date.');
    const pass = await prisma.pass.create({
      data: { userId, kind: info.kind, people: input.people, daysTotal: info.days == null ? null : info.days * input.people, validFrom: from, validUntil: until, price: q.total }
    });
    const payment = await newPayment({
      userId, purpose: 'PASS', passId: pass.id, amount: q.total, dueDate: new Date(),
      description: `${info.label}${input.people > 1 ? ` for ${input.people} people` : ''}, from ${from.toDateString().slice(0, 10)}`
    });
    return { pass: passView({ ...pass, visits: [] }), payments: [payment], quote: q };
  }

  if (q.clash) throw new HttpError(409, 'That time overlaps another booking. Pick another start time or date.');
  const label = q.room.name;
  const when = `${q.start.toDateString().slice(0, 10)}, ${String(q.start.getHours()).padStart(2, '0')}:00–${String(q.end.getHours()).padStart(2, '0')}:00`;
  const booking = await prisma.booking.create({
    data: {
      userId,
      roomId: q.room.id,
      start: q.start,
      end: q.end,
      people: input.type === 'room' ? input.people : input.guests,
      layout: '',
      details: { lines: q.lines, package: q.package?.name || null, addons: input.addons || {} },
      subtotal: q.subtotal,
      vat: q.vat,
      total: q.total
    },
    include: { room: true }
  });
  const payments = [];
  if (input.type === 'hall' && input.deposit) {
    payments.push(await newPayment({ userId, purpose: 'BOOKING', bookingId: booking.id, amount: q.payNow, dueDate: new Date(), description: `${label} deposit, ${when}` }));
    payments.push(await newPayment({ userId, purpose: 'BOOKING', bookingId: booking.id, amount: q.total - q.payNow, dueDate: addDays(q.start, -7), description: `${label} balance, ${when}` }));
  } else {
    payments.push(await newPayment({ userId, purpose: 'BOOKING', bookingId: booking.id, amount: q.total, dueDate: new Date(), description: `${label}, ${when}` }));
  }
  return { booking: bookingView({ ...booking, payments }), payments, quote: q };
}

r.post('/book', ah(async (req, res) => {
  const input = parse(BookingInput, req.body);
  const out = await createOrder(req.user.id, input);
  res.status(201).json({ ...out, payment: paymentView(out.payments[0]), payments: out.payments.map(paymentView) });
}));

r.post('/bookings/:id/cancel', ah(async (req, res) => {
  const b = await prisma.booking.findUnique({ where: { id: req.params.id }, include: { payments: true } });
  if (!b || b.userId !== req.user.id) throw notFound('Booking');
  if (b.status === 'CANCELLED') throw bad('This booking is already cancelled.');
  const paid = b.payments.some((p) => p.status === 'PAID');
  if (paid && b.start - Date.now() < 48 * 3600e3) throw bad('Free cancellation ends 48 hours before. Call or WhatsApp us to change it.');
  await prisma.booking.update({ where: { id: b.id }, data: { status: 'CANCELLED' } });
  await prisma.payment.updateMany({ where: { bookingId: b.id, status: { in: ['UNPAID', 'PENDING'] } }, data: { status: 'CANCELLED' } });
  res.json({ ok: true, refundDue: paid });
}));

/**
 * Cancel an unpaid pass or booking from Payments: the payment and the pass or booking go, freeing the slot.
 * A booking with part of it paid (a hall deposit) is cancelled from Bookings instead, where the 48-hour rule applies.
 */
r.post('/payments/:id/cancel', ah(async (req, res) => {
  const p = await prisma.payment.findUnique({ where: { id: req.params.id } });
  if (!p || p.userId !== req.user.id || !['PASS', 'BOOKING'].includes(p.purpose)) throw notFound('Payment');
  if (p.status !== 'UNPAID') throw bad(p.status === 'PENDING' ? 'This payment is being confirmed. Cancel that first, then cancel the order.' : 'Only an unpaid payment can be cancelled.');
  if (p.passId) {
    await prisma.payment.updateMany({ where: { passId: p.passId, status: 'UNPAID' }, data: { status: 'CANCELLED' } });
    await prisma.pass.update({ where: { id: p.passId }, data: { status: 'CANCELLED' } });
  } else if (p.bookingId) {
    const b = await prisma.booking.findUnique({ where: { id: p.bookingId }, include: { payments: true } });
    if (b.payments.some((x) => x.status === 'PAID' || x.status === 'PENDING')) throw bad('Part of this booking is paid or being confirmed. Cancel the booking from Bookings instead.');
    await prisma.payment.updateMany({ where: { bookingId: b.id, status: 'UNPAID' }, data: { status: 'CANCELLED' } });
    await prisma.booking.update({ where: { id: b.id }, data: { status: 'CANCELLED' } });
  } else {
    await prisma.payment.update({ where: { id: p.id }, data: { status: 'CANCELLED' } });
  }
  res.json({ ok: true });
}));

r.post('/checkin', ah(async (req, res) => {
  if (isSunday()) throw bad('We’re closed on Sundays. See you on Monday.');
  const open = await prisma.visit.findFirst({ where: { userId: req.user.id, checkedInAt: { gte: startOfDay() }, checkedOutAt: null, guestName: '' } });
  if (open) throw bad(`You’re already checked in at desk ${open.desk}.`);
  const pass = await usablePass(req.user.id);
  if (!pass) throw bad('You don’t have a pass you can use today. Buy a day, weekly or monthly pass first.');
  const desk = await freeDesk();
  if (!desk) throw bad('Every desk is taken right now. Ask at the front desk.');
  const visit = await prisma.visit.create({ data: { userId: req.user.id, passId: pass.id, desk } });
  res.status(201).json({ visit });
}));

r.post('/checkout', ah(async (req, res) => {
  const { count } = await prisma.visit.updateMany({
    where: { userId: req.user.id, checkedInAt: { gte: startOfDay() }, checkedOutAt: null },
    data: { checkedOutAt: new Date() }
  });
  if (!count) throw bad('You’re not checked in.');
  res.json({ ok: true });
}));

export default r;
