// Automatic email reminders. The API checks every hour (between 8:00 and 20:00 Lagos time) and
// sends each reminder once; ReminderSent remembers what has gone out.
import { prisma } from '../db.js';
import { env } from '../env.js';
import { naira, addDays } from './util.js';
import { sendReminderEmail } from './email.js';

const HOUR = 3600e3;
const fmtDay = (d) => new Date(d).toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtTime = (d) => new Date(d).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit', hour12: false });

/** Sends one reminder under `key` unless it went out before. Tries again next time if sending fails. */
async function once(key, user, email) {
  try {
    await prisma.reminderSent.create({ data: { key } });
  } catch (e) {
    if (e.code === 'P2002') return false;
    throw e;
  }
  const sent = await sendReminderEmail(user, email).catch(() => false);
  if (!sent) await prisma.reminderSent.delete({ where: { key } }).catch(() => {});
  return sent;
}

/** Instalments and "pay later" class fees, and hall balances. Not one-off passes or room orders left unpaid at checkout. */
async function paymentsDue(now) {
  const payments = await prisma.payment.findMany({
    where: { status: 'UNPAID', dueDate: { gte: addDays(now, -7), lte: addDays(now, 3) }, purpose: { in: ['ENROLLMENT', 'BOOKING'] } },
    include: { user: true }
  });
  let n = 0;
  for (const p of payments) {
    if (p.purpose === 'BOOKING' && p.dueDate - p.createdAt < 24 * HOUR) continue;
    const late = p.dueDate < addDays(now, -1);
    if (!late && p.dueDate < now) continue; // due today: wait for the "late" reminder tomorrow
    const link = `${p.purpose === 'ENROLLMENT' ? env.learnUrl : env.spaceUrl}/dashboard/payments`;
    n += await once(`pay:${p.id}:${late ? 'late' : 'soon'}`, p.user, late
      ? { subject: `Payment overdue: ${naira(p.amount)}`, title: 'A payment is overdue', intro: `${naira(p.amount)} for ${p.description} was due on ${fmtDay(p.dueDate)}. Pay online from your dashboard, on WhatsApp or at the office. Reference: ${p.reference}.`, button: 'Pay now', link }
      : { subject: `Payment due ${fmtDay(p.dueDate)}`, title: 'A payment is coming up', intro: `${naira(p.amount)} for ${p.description} is due on ${fmtDay(p.dueDate)}. Pay online from your dashboard, on WhatsApp or at the office. Reference: ${p.reference}.`, button: 'Pay now', link });
  }
  return n;
}

/** Students who have paid something for the class. */
const studentsOf = async (cohortId) =>
  (await prisma.enrollment.findMany({ where: { cohortId, payments: { some: { status: 'PAID' } } }, include: { user: true } })).map((e) => e.user);

async function quizzesClosing(now) {
  const quizzes = await prisma.quiz.findMany({ where: { closesAt: { gt: now, lte: new Date(+now + 24 * HOUR) } }, include: { attempts: { select: { userId: true } } } });
  let n = 0;
  for (const q of quizzes) {
    const done = new Set(q.attempts.map((a) => a.userId));
    for (const u of await studentsOf(q.cohortId)) {
      if (done.has(u.id)) continue;
      n += await once(`quiz:${q.id}:${u.id}`, u, { subject: `Quiz closes soon: ${q.title}`, title: 'Your quiz closes soon', intro: `“${q.title}” closes ${fmtDay(q.closesAt)} at ${fmtTime(q.closesAt)} and you haven’t taken it yet. It takes about ${q.minutes} minutes.`, button: 'Take the quiz', link: `${env.learnUrl}/dashboard/tasks` });
    }
  }
  return n;
}

async function projectsDue(now) {
  const tasks = await prisma.assignment.findMany({ where: { dueAt: { gt: now, lte: new Date(+now + 24 * HOUR) } }, include: { submissions: { select: { userId: true } } } });
  let n = 0;
  for (const a of tasks) {
    const done = new Set(a.submissions.map((s) => s.userId));
    for (const u of await studentsOf(a.cohortId)) {
      if (done.has(u.id)) continue;
      n += await once(`task:${a.id}:${u.id}`, u, { subject: `Project due soon: ${a.title}`, title: 'Your project is due soon', intro: `“${a.title}” is due ${fmtDay(a.dueAt)} at ${fmtTime(a.dueAt)}. Hand in your GitHub link from your dashboard.`, button: 'Hand it in', link: `${env.learnUrl}/dashboard/tasks` });
    }
  }
  return n;
}

async function bookingsTomorrow(now) {
  const bookings = await prisma.booking.findMany({ where: { status: 'CONFIRMED', start: { gt: new Date(+now + 2 * HOUR), lte: new Date(+now + 30 * HOUR) } }, include: { user: true, room: true } });
  let n = 0;
  for (const b of bookings) {
    n += await once(`booking:${b.id}`, b.user, { subject: `See you soon: ${b.room.name}`, title: 'Your booking is coming up', intro: `${b.room.name} is booked for you on ${fmtDay(b.start)}, ${fmtTime(b.start)}–${fmtTime(b.end)}, for ${b.people} people. We’re at 20A Etete Road, GRA, Benin City.`, button: 'See my booking', link: `${env.spaceUrl}/dashboard/bookings` });
  }
  return n;
}

async function passesEnding(now) {
  const passes = await prisma.pass.findMany({ where: { status: 'ACTIVE', kind: { in: ['MONTHLY', 'DEDICATED'] }, validUntil: { gt: now, lte: addDays(now, 3) } }, include: { user: true } });
  let n = 0;
  for (const p of passes) {
    n += await once(`pass:${p.id}:ending`, p.user, { subject: 'Your Movers Space pass ends soon', title: 'Your pass ends soon', intro: `Your ${p.kind === 'DEDICATED' ? 'dedicated desk' : 'monthly pass'} ends on ${fmtDay(p.validUntil)}. Renew from your dashboard to keep your spot.`, button: 'Renew', link: `${env.spaceUrl}/dashboard/book` });
  }
  return n;
}

export async function runReminders(now = new Date()) {
  const counts = {};
  for (const [name, fn] of Object.entries({ paymentsDue, quizzesClosing, projectsDue, bookingsTomorrow, passesEnding })) {
    counts[name] = await fn(now).catch((e) => {
      console.error(`Reminders (${name}) failed`, e);
      return 0;
    });
  }
  return counts;
}

export function startReminders() {
  if (process.env.REMINDERS === 'off') return;
  if (env.isProd && !env.resendKey) {
    console.log('Email reminders are off until RESEND_API_KEY is set.');
    return;
  }
  const tick = () => {
    const h = new Date().getHours();
    if (h < 8 || h >= 20) return;
    runReminders().then((c) => {
      const total = Object.values(c).reduce((s, x) => s + x, 0);
      if (total) console.log('Reminders sent', c);
    });
  };
  setTimeout(tick, 60e3);
  setInterval(tick, HOUR);
}
