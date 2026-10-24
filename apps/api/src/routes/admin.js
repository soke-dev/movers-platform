import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { ah, parse, bad, notFound, dateOnly, startOfDay, addDays, naira, isSunday } from '../lib/util.js';
import { requireStaff, publicUser } from '../lib/auth.js';
import { markPaid, markUnpaid, newPayment, paymentView, syncTarget } from '../lib/payments.js';
import { syncSessions, seatsTaken, cohortView, skillView, getCurrentCohort } from '../lib/cohorts.js';
import { getSettings } from '../lib/pricing.js';
import { notify, notifyMany, siteForPurpose } from '../lib/notify.js';
import { startRefund, syncRefund, cancelRefund, refundable, goesThroughMoneyMoves, refundView } from '../lib/refunds.js';
import { BookingInput } from './public.js';
import { createOrder, usablePass, freeDesk, passView, bookingView } from './space.js';

const r = Router();
r.use(requireStaff);

const userBits = { select: { id: true, name: true, email: true, phone: true } };
const monthStart = () => new Date(new Date().getFullYear(), new Date().getMonth(), 1);

/* ---------------- overview ---------------- */

r.get('/overview', ah(async (_req, res) => {
  const now = new Date();
  const today = startOfDay(now);
  const cohort = await getCurrentCohort();
  const [collected, refundedThisMonth, refundsWaiting, pending, unpaidRegs, toGrade, openQuizzes, heldBookings, inNow, sessionsToday, bookingsToday, runningStudents, settings] = await Promise.all([
    prisma.payment.aggregate({ where: { status: 'PAID', paidAt: { gte: monthStart() } }, _sum: { amount: true } }),
    prisma.refund.aggregate({ where: { status: { in: ['PROCESSING', 'COMPLETED'] }, createdAt: { gte: monthStart() } }, _sum: { amount: true } }),
    prisma.refund.count({ where: { status: 'AWAITING_FUNDS' } }),
    prisma.payment.aggregate({ where: { status: 'PENDING' }, _sum: { amount: true }, _count: true }),
    cohort ? prisma.enrollment.count({ where: { cohortId: cohort.id, payments: { none: { status: { in: ['PAID', 'PENDING'] } } } } }) : 0,
    prisma.submission.count({ where: { score: null, changesRequested: false } }),
    prisma.quiz.findMany({ where: { closesAt: { gte: now } }, include: { _count: { select: { attempts: true } } } }),
    prisma.booking.count({ where: { status: { in: ['HELD', 'UNPAID'] }, start: { gte: now } } }),
    prisma.visit.count({ where: { checkedInAt: { gte: today }, checkedOutAt: null } }),
    prisma.classSession.findMany({ where: { date: { gte: today, lt: addDays(today, 2) } }, include: { cohort: true }, orderBy: { date: 'asc' } }),
    prisma.booking.findMany({ where: { status: { in: ['HELD', 'CONFIRMED'] }, start: { gte: today, lt: addDays(today, 2) } }, include: { room: true, user: userBits }, orderBy: { start: 'asc' } }),
    prisma.enrollment.findMany({ where: { cohort: { startDate: { lte: now }, demoDate: { gte: addDays(now, -1) } }, payments: { some: { status: 'PAID' } } }, select: { userId: true, kind: true } }),
    getSettings()
  ]);
  res.json({
    cohort: cohort ? cohortView(cohort, await seatsTaken(cohort.id)) : null,
    collectedThisMonth: (collected._sum.amount || 0) - (refundedThisMonth._sum.amount || 0),
    refundsWaiting,
    pendingCount: pending._count,
    pendingAmount: pending._sum.amount || 0,
    unpaidRegistrations: unpaidRegs,
    toGrade,
    openQuizzes: openQuizzes.map((q) => ({ id: q.id, title: q.title, closesAt: q.closesAt, taken: q._count.attempts })),
    heldBookings,
    inNow,
    desks: settings.desks,
    activeStudents: new Set(runningStudents.map((e) => e.userId)).size,
    activeFull: runningStudents.filter((e) => e.kind === 'FULL').length,
    activeSingle: runningStudents.filter((e) => e.kind === 'SINGLE').length,
    today: [
      ...sessionsToday.map((s) => ({ at: s.date, kind: 'class', text: `${s.cohort.code} class${s.topic ? ` · ${s.topic}` : ''}` })),
      ...bookingsToday.map((b) => ({ at: b.start, kind: 'booking', text: `${b.room.name} · ${b.user.name}` }))
    ]
  });
}));

/* ---------------- payments ---------------- */

r.get('/payments', ah(async (req, res) => {
  const status = ['PENDING', 'UNPAID', 'PAID', 'CANCELLED'].includes(req.query.status) ? req.query.status : 'PENDING';
  const q = String(req.query.q || '').trim();
  const payments = await prisma.payment.findMany({
    where: {
      status,
      ...(q ? { OR: [{ reference: { contains: q, mode: 'insensitive' } }, { user: { name: { contains: q, mode: 'insensitive' } } }, { description: { contains: q, mode: 'insensitive' } }] } : {})
    },
    include: { user: userBits, refunds: true, booking: { select: { status: true } } },
    orderBy: status === 'PAID' ? { paidAt: 'desc' } : { createdAt: 'desc' },
    take: 150
  });
  res.json({
    payments: payments.map((p) => ({
      ...paymentView(p),
      user: p.user,
      refundable: p.status === 'PAID' ? refundable(p, p.refunds) : 0,
      refundViaMoneyMoves: goesThroughMoneyMoves(p),
      refundWaiting: p.refunds.some((x) => x.status === 'AWAITING_FUNDS'),
      // A paid booking that was cancelled later: the money is owed back.
      refundDue: p.booking?.status === 'CANCELLED' && refundable(p, p.refunds) > 0
    }))
  });
}));

r.post('/payments/:id/confirm', ah(async (req, res) => {
  const p = await prisma.payment.findUnique({ where: { id: req.params.id } });
  if (!p) throw notFound('Payment');
  if (p.status === 'PAID') throw bad('This is already marked paid.');
  res.json({ payment: paymentView(await markPaid(p.id, req.user.id, p.method || 'OFFICE')) });
}));

r.post('/payments/:id/reject', ah(async (req, res) => {
  const p = await prisma.payment.findUnique({ where: { id: req.params.id } });
  if (!p) throw notFound('Payment');
  const updated = await markUnpaid(p.id);
  notify(p.userId, { title: 'We couldn’t confirm your payment', body: `${naira(p.amount)} for ${p.description} hasn’t reached us. Pay again, or call us if you’ve already paid.`, site: siteForPurpose(p.purpose), path: '/dashboard/payments' });
  res.json({ payment: paymentView(updated) });
}));

r.post('/payments/:id/cancel', ah(async (req, res) => {
  const p = await prisma.payment.update({ where: { id: req.params.id }, data: { status: 'CANCELLED' } });
  await syncTarget(p);
  res.json({ payment: paymentView(p) });
}));

/* ---------------- refunds ---------------- */

const RefundBody = z.object({
  amount: z.coerce.number().int().positive().optional(),
  reason: z.string().trim().max(280).default('')
});

const onlyAdmin = (req) => {
  if (req.user.role !== 'ADMIN') throw bad('Only an admin can give refunds.');
};

r.post('/payments/:id/refund', ah(async (req, res) => {
  onlyAdmin(req);
  res.status(201).json({ refund: refundView(await startRefund(req.params.id, parse(RefundBody, req.body), req.user.id)) });
}));

r.get('/refunds', ah(async (req, res) => {
  const status = String(req.query.status || '');
  const refunds = await prisma.refund.findMany({
    where: status === 'open' ? { status: { in: ['AWAITING_FUNDS', 'PROCESSING'] } } : {},
    include: { payment: { include: { user: userBits } } },
    orderBy: { createdAt: 'desc' },
    take: 150
  });
  res.json({ refunds: refunds.map((x) => ({ ...refundView(x), payment: { ...paymentView(x.payment), user: x.payment.user } })) });
}));

const findRefund = async (id) => {
  const x = await prisma.refund.findUnique({ where: { id } });
  if (!x) throw notFound('Refund');
  return x;
};

/** Asks Money Moves whether the transfer arrived or the refund has reached the customer. */
r.post('/refunds/:id/check', ah(async (req, res) => {
  res.json({ refund: refundView(await syncRefund(await findRefund(req.params.id))) });
}));

r.post('/refunds/:id/cancel', ah(async (req, res) => {
  onlyAdmin(req);
  res.json({ refund: refundView(await cancelRefund(await findRefund(req.params.id))) });
}));

const RecordBody = z.object({
  userId: z.string(),
  description: z.string().trim().min(2),
  amount: z.coerce.number().int().positive(),
  method: z.enum(['OFFICE', 'WHATSAPP', 'ONLINE']).default('OFFICE')
});

r.post('/payments/record', ah(async (req, res) => {
  const body = parse(RecordBody, req.body);
  const p = await newPayment({ userId: body.userId, amount: body.amount, description: body.description, purpose: 'OTHER', method: body.method });
  res.status(201).json({ payment: paymentView(await markPaid(p.id, req.user.id, body.method)) });
}));

r.get('/users', ah(async (req, res) => {
  const q = String(req.query.q || '').trim();
  const users = await prisma.user.findMany({
    where: q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }, { phone: { contains: q } }] } : {},
    orderBy: { createdAt: 'desc' },
    take: 20
  });
  res.json({ users: users.map(publicUser) });
}));

const RoleBody = z.object({ role: z.enum(['USER', 'STAFF', 'ADMIN']) });
r.patch('/users/:id/role', ah(async (req, res) => {
  if (req.user.role !== 'ADMIN') throw bad('Only an admin can change roles.');
  const { role } = parse(RoleBody, req.body);
  res.json({ user: publicUser(await prisma.user.update({ where: { id: req.params.id }, data: { role } })) });
}));

/* ---------------- cohorts, class info and skills ---------------- */

const CohortBody = z.object({
  name: z.string().trim().min(2),
  code: z.string().trim().min(1),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  demoDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weeks: z.coerce.number().int().min(1).max(26),
  days: z.array(z.number().int().min(0).max(6)).min(1),
  scheduleText: z.string().trim().min(2),
  saturdayNote: z.string().trim().default(''),
  location: z.string().trim().min(2),
  seats: z.coerce.number().int().min(1),
  fullPrice: z.coerce.number().int().positive(),
  skillPrice: z.coerce.number().int().positive(),
  allowTwoPayments: z.boolean().default(true),
  supportNote: z.string().trim().default(''),
  mentorshipNote: z.string().trim().default(''),
  laptopNote: z.string().trim().default('')
});

const cohortData = (b) => ({ ...b, startDate: dateOnly(b.startDate), demoDate: dateOnly(b.demoDate) });

r.get('/cohorts', ah(async (_req, res) => {
  const cohorts = await prisma.cohort.findMany({ orderBy: { startDate: 'desc' }, include: { enrollments: { select: { kind: true, payments: { select: { status: true } } } } } });
  res.json({
    cohorts: cohorts.map((c) => ({
      ...cohortView(c, c.enrollments.filter((e) => e.kind === 'FULL' && e.payments.some((p) => p.status === 'PAID')).length),
      isCurrent: c.isCurrent,
      fullCount: c.enrollments.filter((e) => e.kind === 'FULL').length,
      singleCount: c.enrollments.filter((e) => e.kind === 'SINGLE').length
    }))
  });
}));

r.post('/cohorts', ah(async (req, res) => {
  const body = parse(CohortBody, req.body);
  if (dateOnly(body.demoDate) <= dateOnly(body.startDate)) throw bad('Demo Day has to come after the first class.');
  const cohort = await prisma.cohort.create({ data: cohortData(body) });
  await syncSessions(cohort);
  res.status(201).json({ cohort });
}));

r.patch('/cohorts/:id', ah(async (req, res) => {
  const body = parse(CohortBody.partial(), req.body);
  const data = { ...body };
  if (body.startDate) data.startDate = dateOnly(body.startDate);
  if (body.demoDate) data.demoDate = dateOnly(body.demoDate);
  const cohort = await prisma.cohort.update({ where: { id: req.params.id }, data });
  if (cohort.demoDate <= cohort.startDate) throw bad('Demo Day has to come after the first class.');
  await syncSessions(cohort);
  res.json({ cohort });
}));

r.post('/cohorts/:id/make-current', ah(async (req, res) => {
  await prisma.$transaction([
    prisma.cohort.updateMany({ data: { isCurrent: false } }),
    prisma.cohort.update({ where: { id: req.params.id }, data: { isCurrent: true } })
  ]);
  res.json({ ok: true });
}));

const SkillBody = z.object({
  name: z.string().trim().min(2),
  description: z.string().trim().default(''),
  weekStart: z.coerce.number().int().min(1),
  weekEnd: z.coerce.number().int().min(1),
  group: z.enum(['code', 'web3ai', 'design', 'ops', 'career']),
  icon: z.string().default('bulb'),
  color: z.enum(['amber', 'violet', 'pink', 'lime', 'blue']).default('violet'),
  topics: z.array(z.string().trim().min(1)).min(1, 'Add at least one topic'),
  visible: z.boolean().default(true),
  sortOrder: z.coerce.number().int().optional()
}).refine((s) => s.weekEnd >= s.weekStart, { message: 'The last week can’t come before the first.' });

r.get('/skills', ah(async (_req, res) => {
  res.json({ skills: (await prisma.skill.findMany({ orderBy: { sortOrder: 'asc' } })).map(skillView) });
}));

const slugify = (s) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

r.post('/skills', ah(async (req, res) => {
  const body = parse(SkillBody, req.body);
  const max = await prisma.skill.aggregate({ _max: { sortOrder: true } });
  let slug = slugify(body.name);
  if (await prisma.skill.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36)}`;
  const skill = await prisma.skill.create({ data: { ...body, slug, sortOrder: body.sortOrder ?? (max._max.sortOrder ?? 0) + 1 } });
  res.status(201).json({ skill: skillView(skill) });
}));

r.patch('/skills/:id', ah(async (req, res) => {
  const body = parse(SkillBody.innerType().partial(), req.body);
  if (body.visible === false) {
    const visible = await prisma.skill.count({ where: { visible: true, id: { not: req.params.id } } });
    if (!visible) throw bad('Keep at least one skill on the website.');
  }
  res.json({ skill: skillView(await prisma.skill.update({ where: { id: req.params.id }, data: body })) });
}));

/* ---------------- students ---------------- */

r.get('/cohorts/:id/students', ah(async (req, res) => {
  const now = new Date();
  const [enrollments, sessions, assignments] = await Promise.all([
    prisma.enrollment.findMany({ where: { cohortId: req.params.id }, include: { user: userBits, skills: { include: { skill: true } }, payments: true }, orderBy: { createdAt: 'asc' } }),
    prisma.classSession.findMany({ where: { cohortId: req.params.id, date: { lte: now } }, include: { attendance: true } }),
    prisma.assignment.findMany({ where: { cohortId: req.params.id }, include: { submissions: { select: { userId: true } } } })
  ]);
  res.json({
    students: enrollments.map((e) => {
      const marks = sessions.flatMap((s) => s.attendance.filter((a) => a.userId === e.userId));
      const attended = marks.filter((a) => a.status !== 'ABSENT').length;
      const paid = e.payments.filter((p) => p.status === 'PAID').reduce((s, p) => s + p.amount, 0);
      const owed = e.payments.filter((p) => p.status === 'UNPAID' || p.status === 'PENDING').reduce((s, p) => s + p.amount, 0);
      return {
        enrollmentId: e.id,
        user: e.user,
        kind: e.kind,
        plan: e.plan,
        skills: e.skills.map((s) => s.skill.name),
        attendance: marks.length ? Math.round((attended / marks.length) * 100) : null,
        projects: assignments.filter((a) => a.submissions.some((s) => s.userId === e.userId)).length,
        projectsTotal: assignments.length,
        paid,
        owed,
        pendingConfirmation: e.payments.some((p) => p.status === 'PENDING'),
        secured: e.payments.some((p) => p.status === 'PAID')
      };
    })
  });
}));

/* ---------------- assignments and quizzes ---------------- */

r.get('/cohorts/:id/assessments', ah(async (req, res) => {
  const [assignments, quizzes, enrolled] = await Promise.all([
    prisma.assignment.findMany({ where: { cohortId: req.params.id }, include: { submissions: true }, orderBy: { dueAt: 'asc' } }),
    prisma.quiz.findMany({ where: { cohortId: req.params.id }, include: { attempts: true, _count: { select: { questions: true } } }, orderBy: { closesAt: 'asc' } }),
    prisma.enrollment.count({ where: { cohortId: req.params.id } })
  ]);
  res.json({
    enrolled,
    assignments: assignments.map((a) => ({
      id: a.id, title: a.title, skillName: a.skillName, dueAt: a.dueAt, maxScore: a.maxScore, instructions: a.instructions,
      submitted: a.submissions.length,
      toGrade: a.submissions.filter((s) => s.score == null && !s.changesRequested).length
    })),
    quizzes: quizzes.map((q) => ({
      id: q.id, title: q.title, closesAt: q.closesAt, minutes: q.minutes, questions: q._count.questions,
      taken: q.attempts.length,
      average: q.attempts.length ? q.attempts.reduce((s, x) => s + x.score, 0) / q.attempts.length : null
    }))
  });
}));

const AssignmentBody = z.object({
  cohortId: z.string(),
  title: z.string().trim().min(2),
  skillName: z.string().trim().default(''),
  instructions: z.string().trim().default(''),
  dueAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  maxScore: z.coerce.number().int().min(1).default(100)
});

r.post('/assignments', ah(async (req, res) => {
  const body = parse(AssignmentBody, req.body);
  const due = dateOnly(body.dueAt);
  due.setHours(23, 59, 0, 0);
  const assignment = await prisma.assignment.create({ data: { ...body, dueAt: due } });
  notifyMany(await studentIds(assignment.cohortId), { title: `New project: ${assignment.title}`, body: `Due ${due.toDateString().slice(0, 10)}`, site: 'learn', path: '/dashboard/tasks' });
  res.status(201).json({ assignment });
}));

r.get('/assignments/:id/submissions', ah(async (req, res) => {
  const a = await prisma.assignment.findUnique({ where: { id: req.params.id }, include: { submissions: { include: { user: userBits }, orderBy: { submittedAt: 'asc' } } } });
  if (!a) throw notFound('Assignment');
  res.json({ assignment: { id: a.id, title: a.title, maxScore: a.maxScore }, submissions: a.submissions });
}));

const GradeBody = z.object({
  score: z.coerce.number().int().min(0).nullable().optional(),
  changesRequested: z.boolean().optional(),
  feedback: z.string().trim().max(2000).optional()
});

r.patch('/submissions/:id', ah(async (req, res) => {
  const body = parse(GradeBody, req.body);
  const s = await prisma.submission.findUnique({ where: { id: req.params.id }, include: { assignment: true } });
  if (!s) throw notFound('Submission');
  if (body.score != null && body.score > s.assignment.maxScore) throw bad(`The highest score is ${s.assignment.maxScore}.`);
  const data = { ...body };
  if (body.changesRequested) data.score = null;
  const updated = await prisma.submission.update({ where: { id: s.id }, data });
  if (body.changesRequested) notify(s.userId, { title: `Changes requested: ${s.assignment.title}`, body: updated.feedback || 'Your instructor asked for changes. Resubmit from your dashboard.', site: 'learn', path: '/dashboard/tasks' });
  else if (body.score != null) notify(s.userId, { title: `Graded: ${s.assignment.title}`, body: `${body.score} / ${s.assignment.maxScore}${updated.feedback ? ` · ${updated.feedback}` : ''}`, site: 'learn', path: '/dashboard/tasks' });
  res.json({ submission: updated });
}));

/** Students who have paid something for the class. */
const studentIds = async (cohortId) =>
  (await prisma.enrollment.findMany({ where: { cohortId, payments: { some: { status: 'PAID' } } }, select: { userId: true } })).map((e) => e.userId);

const QuizBody = z.object({
  cohortId: z.string(),
  title: z.string().trim().min(2),
  closesAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  minutes: z.coerce.number().int().min(1).max(180),
  questions: z.array(z.object({
    text: z.string().trim().min(1, 'Every question needs text'),
    options: z.array(z.string().trim().min(1, 'Fill in every option')).min(2).max(6),
    answer: z.number().int().min(0)
  })).min(1, 'Add at least one question')
});

r.post('/quizzes', ah(async (req, res) => {
  const body = parse(QuizBody, req.body);
  if (body.questions.some((q) => q.answer >= q.options.length)) throw bad('Tick the right answer for every question.');
  const closes = dateOnly(body.closesAt);
  closes.setHours(23, 59, 0, 0);
  const quiz = await prisma.quiz.create({
    data: {
      cohortId: body.cohortId, title: body.title, closesAt: closes, minutes: body.minutes,
      questions: { create: body.questions.map((q, i) => ({ ...q, order: i })) }
    }
  });
  notifyMany(await studentIds(quiz.cohortId), { title: `New quiz: ${quiz.title}`, body: `${body.questions.length} questions · closes ${closes.toDateString().slice(0, 10)}`, site: 'learn', path: '/dashboard/tasks' });
  res.status(201).json({ quiz });
}));

r.get('/quizzes/:id/results', ah(async (req, res) => {
  const quiz = await prisma.quiz.findUnique({ where: { id: req.params.id }, include: { attempts: { include: { user: userBits }, orderBy: { score: 'desc' } }, _count: { select: { questions: true } } } });
  if (!quiz) throw notFound('Quiz');
  const enrolled = await prisma.enrollment.findMany({ where: { cohortId: quiz.cohortId }, include: { user: userBits } });
  const done = new Set(quiz.attempts.map((a) => a.userId));
  res.json({
    quiz: { id: quiz.id, title: quiz.title, questions: quiz._count.questions },
    attempts: quiz.attempts.map((a) => ({ user: a.user, score: a.score, total: a.total, at: a.createdAt })),
    notTaken: enrolled.filter((e) => !done.has(e.userId)).map((e) => e.user)
  });
}));

/* ---------------- attendance ---------------- */

r.get('/cohorts/:id/sessions', ah(async (req, res) => {
  const sessions = await prisma.classSession.findMany({ where: { cohortId: req.params.id }, orderBy: { date: 'asc' }, include: { _count: { select: { attendance: true } } } });
  res.json({ sessions: sessions.map((s) => ({ id: s.id, date: s.date, topic: s.topic, marked: s._count.attendance })) });
}));

r.get('/sessions/:id', ah(async (req, res) => {
  const s = await prisma.classSession.findUnique({ where: { id: req.params.id }, include: { cohort: true, attendance: true } });
  if (!s) throw notFound('Class');
  const week = Math.floor((s.date - s.cohort.startDate) / (7 * 864e5)) + 1;
  const enrollments = await prisma.enrollment.findMany({ where: { cohortId: s.cohortId }, include: { user: userBits, skills: { include: { skill: true } } } });
  const expected = enrollments.filter((e) => e.kind === 'FULL' || e.skills.some(({ skill }) => week >= skill.weekStart && week <= skill.weekEnd));
  res.json({
    session: { id: s.id, date: s.date, topic: s.topic, week },
    roster: expected.map((e) => {
      const a = s.attendance.find((x) => x.userId === e.userId);
      return { user: e.user, kind: e.kind, status: a?.status || null, checkedInAt: a?.checkedInAt || null };
    })
  });
}));

const MarksBody = z.object({ marks: z.array(z.object({ userId: z.string(), status: z.enum(['PRESENT', 'LATE', 'ABSENT']) })) });

r.put('/sessions/:id/attendance', ah(async (req, res) => {
  const { marks } = parse(MarksBody, req.body);
  for (const m of marks) {
    await prisma.attendance.upsert({
      where: { sessionId_userId: { sessionId: req.params.id, userId: m.userId } },
      create: { sessionId: req.params.id, userId: m.userId, status: m.status, checkedInAt: m.status === 'ABSENT' ? null : new Date() },
      update: { status: m.status }
    });
  }
  res.json({ ok: true, saved: marks.length });
}));

/* ---------------- announcements ---------------- */

r.get('/announcements', ah(async (_req, res) => {
  res.json({ announcements: await prisma.announcement.findMany({ orderBy: { createdAt: 'desc' }, take: 50, include: { cohort: { select: { code: true } } } }) });
}));

const AnnBody = z.object({
  title: z.string().trim().min(2),
  body: z.string().trim().min(2),
  audience: z.enum(['COHORT', 'ALL_STUDENTS', 'SPACE', 'EVERYONE']),
  cohortId: z.string().optional()
});

r.post('/announcements', ah(async (req, res) => {
  const body = parse(AnnBody, req.body);
  if (body.audience === 'COHORT' && !body.cohortId) throw bad('Choose the class this is for.');
  res.status(201).json({ announcement: await prisma.announcement.create({ data: { ...body, cohortId: body.audience === 'COHORT' ? body.cohortId : null } }) });
}));

r.delete('/announcements/:id', ah(async (req, res) => {
  await prisma.announcement.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
}));

/* ---------------- Movers Space ---------------- */

r.get('/space/today', ah(async (_req, res) => {
  const today = startOfDay();
  const [settings, visits, bookings, nextHall] = await Promise.all([
    getSettings(),
    prisma.visit.findMany({ where: { checkedInAt: { gte: today } }, include: { user: userBits, pass: true }, orderBy: { checkedInAt: 'asc' } }),
    prisma.booking.findMany({ where: { status: { in: ['HELD', 'CONFIRMED', 'UNPAID'] }, start: { gte: today, lt: addDays(today, 1) } }, include: { room: true, user: userBits }, orderBy: { start: 'asc' } }),
    prisma.booking.findFirst({ where: { status: 'CONFIRMED', start: { gte: new Date() }, room: { kind: 'HALL' } }, include: { user: userBits }, orderBy: { start: 'asc' } })
  ]);
  res.json({
    desks: settings.desks,
    inNow: visits.filter((v) => !v.checkedOutAt),
    leftToday: visits.filter((v) => v.checkedOutAt),
    bookings: bookings.map((b) => ({ ...bookingView(b), user: b.user })),
    nextHall: nextHall && { start: nextHall.start, who: nextHall.user.name, people: nextHall.people, layout: nextHall.layout }
  });
}));

const CheckinBody = z.object({ userId: z.string(), guestName: z.string().trim().default('') });

const openVisit = (userId) => prisma.visit.findFirst({ where: { userId, checkedInAt: { gte: startOfDay() }, checkedOutAt: null, guestName: '' } });

async function checkIn(userId, guestName = '') {
  if (isSunday()) throw bad('We’re closed on Sundays.');
  if (!guestName) {
    const open = await openVisit(userId);
    if (open) throw bad(`Already checked in at desk ${open.desk}.`);
  }
  const pass = await usablePass(userId);
  if (!pass) throw bad('No pass they can use today. Sell them a day pass first.');
  const desk = await freeDesk();
  if (!desk) throw bad('Every desk is taken.');
  return prisma.visit.create({ data: { userId, passId: pass.id, desk, guestName } });
}

r.post('/space/checkin', ah(async (req, res) => {
  const { userId, guestName } = parse(CheckinBody, req.body);
  res.status(201).json({ visit: await checkIn(userId, guestName) });
}));

/** The check-in QR on a member's dashboard reads "MOVERS:<their referral code>". Typing just the code works too. */
const userByCode = async (code) => {
  const ref = String(code || '').trim().toUpperCase().replace(/^MOVERS:/, '');
  const user = ref && (await prisma.user.findUnique({ where: { referralCode: ref } }));
  if (!user) throw notFound('A Movers account with that code');
  return user;
};

r.get('/space/code/:code', ah(async (req, res) => {
  res.json({ user: publicUser(await userByCode(req.params.code)) });
}));

/**
 * The door scanner. Not in yet: checks them in. In for more than two minutes: checks them out,
 * so the same code works on the way in and on the way out.
 */
r.post('/space/scan', ah(async (req, res) => {
  const user = publicUser(await userByCode(req.body?.code));
  const open = await openVisit(user.id);
  if (open) {
    if (Date.now() - open.checkedInAt < 2 * 60e3) return res.json({ action: 'already', user, visit: open });
    const visit = await prisma.visit.update({ where: { id: open.id }, data: { checkedOutAt: new Date() } });
    return res.json({ action: 'out', user, visit });
  }
  try {
    res.json({ action: 'in', user, visit: await checkIn(user.id) });
  } catch (e) {
    if (e.status !== 400) throw e;
    res.json({ action: /pass/i.test(e.message) ? 'nopass' : 'full', user, message: e.message });
  }
}));

r.post('/space/visits/:id/checkout', ah(async (req, res) => {
  res.json({ visit: await prisma.visit.update({ where: { id: req.params.id }, data: { checkedOutAt: new Date() } }) });
}));

const StaffOrderBody = z.object({ userId: z.string(), order: BookingInput, paid: z.boolean().default(false) });

/** Walk-ins and phone bookings. Paid at the desk = marked paid straight away. */
r.post('/space/orders', ah(async (req, res) => {
  const { userId, order, paid } = parse(StaffOrderBody, req.body);
  const out = await createOrder(userId, order);
  if (paid) await markPaid(out.payments[0].id, req.user.id, 'OFFICE');
  res.status(201).json({ ok: true, reference: out.payments[0].reference });
}));

r.get('/space/bookings', ah(async (req, res) => {
  const f = String(req.query.filter || 'upcoming');
  const where =
    f === 'cancelled' ? { status: 'CANCELLED' }
      : f === 'past' ? { status: { not: 'CANCELLED' }, end: { lt: new Date() } }
        : { status: { not: 'CANCELLED' }, end: { gte: new Date() }, ...(f === 'hall' ? { room: { kind: 'HALL' } } : f === 'room' ? { room: { kind: 'MEETING' } } : {}) };
  const bookings = await prisma.booking.findMany({ where, include: { room: true, user: userBits, payments: true }, orderBy: { start: f === 'past' || f === 'cancelled' ? 'desc' : 'asc' }, take: 100 });
  res.json({ bookings: bookings.map((b) => ({ ...bookingView(b), user: b.user })) });
}));

r.post('/space/bookings/:id/cancel', ah(async (req, res) => {
  await prisma.booking.update({ where: { id: req.params.id }, data: { status: 'CANCELLED' } });
  await prisma.payment.updateMany({ where: { bookingId: req.params.id, status: { in: ['UNPAID', 'PENDING'] } }, data: { status: 'CANCELLED' } });
  res.json({ ok: true });
}));

r.get('/space/members', ah(async (_req, res) => {
  const ms = monthStart();
  const users = await prisma.user.findMany({
    where: { passes: { some: {} } },
    include: { passes: { include: { visits: true }, orderBy: { createdAt: 'desc' } }, visits: { orderBy: { checkedInAt: 'desc' }, take: 1 } },
    orderBy: { name: 'asc' }
  });
  res.json({
    members: users.map((u) => {
      const passes = u.passes.map(passView);
      const active = passes.find((p) => p.status === 'ACTIVE' && new Date(p.validUntil) > new Date());
      return {
        user: publicUser(u),
        pass: active || passes[0] || null,
        visitsThisMonth: u.passes.flatMap((p) => p.visits).filter((v) => v.checkedInAt >= ms).length,
        lastVisit: u.visits[0]?.checkedInAt || null
      };
    })
  });
}));

const AddDaysBody = z.object({ days: z.coerce.number().int().min(1).max(60) });
r.post('/space/passes/:id/add-days', ah(async (req, res) => {
  const { days } = parse(AddDaysBody, req.body);
  const pass = await prisma.pass.findUnique({ where: { id: req.params.id } });
  if (!pass) throw notFound('Pass');
  const data = pass.daysTotal == null ? { validUntil: addDays(pass.validUntil, days) } : { daysTotal: pass.daysTotal + days };
  res.json({ pass: await prisma.pass.update({ where: { id: pass.id }, data }) });
}));

r.get('/space/settings', ah(async (_req, res) => res.json({ settings: await getSettings(), rooms: await prisma.room.findMany() })));

const SettingsBody = z.object({
  desks: z.coerce.number().int().min(1),
  dayPass: z.coerce.number().int().positive(),
  weekly: z.coerce.number().int().positive(),
  monthly: z.coerce.number().int().positive(),
  studentDiscount: z.coerce.number().int().min(0).max(100),
  refreshments: z.coerce.number().int().min(0),
  hallPackages: z.array(z.object({ id: z.string(), name: z.string(), start: z.number().int(), end: z.number().int(), price: z.number().int() })),
  addons: z.array(z.object({ id: z.string(), name: z.string(), price: z.number().int(), perGuest: z.boolean() })),
  rooms: z.array(z.object({ id: z.string(), dayRate: z.coerce.number().int().min(0), capacity: z.coerce.number().int().min(1) })).optional()
}).partial();

r.patch('/space/settings', ah(async (req, res) => {
  const { rooms, ...body } = parse(SettingsBody, req.body);
  const settings = await prisma.spaceSettings.update({ where: { id: 1 }, data: body });
  for (const room of rooms || []) await prisma.room.update({ where: { id: room.id }, data: { dayRate: room.dayRate, capacity: room.capacity } });
  res.json({ settings });
}));

export default r;
