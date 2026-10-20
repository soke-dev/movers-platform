import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { ah, parse, bad, notFound, HttpError, addDays } from '../lib/util.js';
import { requireAuth } from '../lib/auth.js';
import { getCurrentCohort, seatsTaken, cohortView, skillView } from '../lib/cohorts.js';
import { newPayment, paymentView } from '../lib/payments.js';

const r = Router();
r.use(requireAuth);

const EnrollBody = z.object({
  kind: z.enum(['FULL', 'SINGLE']),
  plan: z.enum(['FULL', 'TWO']).default('FULL'),
  skillIds: z.array(z.string()).default([])
});

r.post('/enroll', ah(async (req, res) => {
  const body = parse(EnrollBody, req.body);
  const cohort = await getCurrentCohort();
  if (!cohort) throw bad('There is no class open for registration right now.');

  const existing = await prisma.enrollment.findUnique({
    where: { userId_cohortId: { userId: req.user.id, cohortId: cohort.id } },
    include: { payments: true }
  });
  if (existing) {
    if (existing.payments.some((p) => p.status === 'PAID' || p.status === 'PENDING')) {
      throw new HttpError(409, `You’re already registered for ${cohort.code}. Open your dashboard to see it.`);
    }
    // Nothing paid yet: let them change their choice.
    await prisma.enrollment.delete({ where: { id: existing.id } });
  }

  const label = `${cohort.name}, ${cohort.code}`;
  let total;
  let payments;
  let skillIds = [];
  if (body.kind === 'FULL') {
    if ((await seatsTaken(cohort.id)) >= cohort.seats) throw bad('This class is full. Ask us about the next one.');
    total = cohort.fullPrice;
    if (body.plan === 'TWO' && cohort.allowTwoPayments) {
      const half = Math.round(total / 2);
      payments = [
        { amount: half, description: `${label} (payment 1 of 2)`, dueDate: new Date() },
        { amount: total - half, description: `${label} (payment 2 of 2)`, dueDate: addDays(cohort.startDate, 21) }
      ];
    } else {
      payments = [{ amount: total, description: `${label} (paid in full)`, dueDate: new Date() }];
    }
  } else {
    const skills = await prisma.skill.findMany({ where: { id: { in: body.skillIds }, visible: true } });
    if (!skills.length) throw bad('Pick at least one skill.');
    skillIds = skills.map((s) => s.id);
    total = skills.length * cohort.skillPrice;
    payments = [{ amount: total, description: `${cohort.code} single skills: ${skills.map((s) => s.name).join(', ')}`, dueDate: new Date() }];
  }

  const enrollment = await prisma.enrollment.create({
    data: {
      userId: req.user.id,
      cohortId: cohort.id,
      kind: body.kind,
      plan: body.kind === 'FULL' && body.plan === 'TWO' && cohort.allowTwoPayments ? 'TWO' : 'FULL',
      total,
      skills: { create: skillIds.map((skillId) => ({ skillId })) }
    }
  });
  const created = [];
  for (const p of payments) {
    created.push(await newPayment({ ...p, userId: req.user.id, purpose: 'ENROLLMENT', enrollmentId: enrollment.id }));
  }
  res.status(201).json({ enrollmentId: enrollment.id, payment: paymentView(created[0]), payments: created.map(paymentView) });
}));

const weekOf = (cohort, date) => Math.floor((date - cohort.startDate) / (7 * 864e5)) + 1;

r.get('/me', ah(async (req, res) => {
  const enrollment = await prisma.enrollment.findFirst({
    where: { userId: req.user.id },
    orderBy: { cohort: { startDate: 'desc' } },
    include: { cohort: true, skills: { include: { skill: true } }, payments: { orderBy: { createdAt: 'asc' }, include: { refunds: true } } }
  });
  const allSkills = (await prisma.skill.findMany({ where: { visible: true }, orderBy: { sortOrder: 'asc' } })).map(skillView);
  const announcementsWhere = { OR: [{ audience: 'EVERYONE' }, { audience: 'ALL_STUDENTS' }] };
  if (!enrollment) {
    const announcements = await prisma.announcement.findMany({ where: announcementsWhere, orderBy: { createdAt: 'desc' }, take: 10 });
    return res.json({ enrollment: null, skills: allSkills, announcements });
  }

  const cohort = enrollment.cohort;
  const mySkills = enrollment.skills.map((s) => s.skill);
  const inMyWeeks = (week) => enrollment.kind === 'FULL' || mySkills.some((s) => week >= s.weekStart && week <= s.weekEnd);

  const [sessions, assignments, quizzes, announcements] = await Promise.all([
    prisma.classSession.findMany({ where: { cohortId: cohort.id }, orderBy: { date: 'asc' }, include: { attendance: { where: { userId: req.user.id } } } }),
    prisma.assignment.findMany({ where: { cohortId: cohort.id }, orderBy: { dueAt: 'asc' }, include: { submissions: { where: { userId: req.user.id } } } }),
    prisma.quiz.findMany({ where: { cohortId: cohort.id }, orderBy: { closesAt: 'asc' }, include: { _count: { select: { questions: true } }, attempts: { where: { userId: req.user.id } } } }),
    prisma.announcement.findMany({ where: { OR: [...announcementsWhere.OR, { audience: 'COHORT', cohortId: cohort.id }] }, orderBy: { createdAt: 'desc' }, take: 10 })
  ]);

  const mySkillNames = new Set(mySkills.map((s) => s.name));
  res.json({
    enrollment: {
      id: enrollment.id,
      kind: enrollment.kind,
      plan: enrollment.plan,
      total: enrollment.total,
      createdAt: enrollment.createdAt,
      skills: mySkills.map(skillView),
      payments: enrollment.payments.map(paymentView)
    },
    cohort: cohortView(cohort),
    skills: allSkills,
    sessions: sessions
      .filter((s) => inMyWeeks(weekOf(cohort, s.date)))
      .map((s) => ({ id: s.id, date: s.date, topic: s.topic, week: weekOf(cohort, s.date), status: s.attendance[0]?.status || null, checkedInAt: s.attendance[0]?.checkedInAt || null })),
    assignments: assignments
      .filter((a) => enrollment.kind === 'FULL' || !a.skillName || mySkillNames.has(a.skillName))
      .map((a) => ({ id: a.id, title: a.title, skillName: a.skillName, instructions: a.instructions, dueAt: a.dueAt, maxScore: a.maxScore, submission: a.submissions[0] || null })),
    quizzes: quizzes.map((q) => ({ id: q.id, title: q.title, closesAt: q.closesAt, minutes: q.minutes, questionCount: q._count.questions, attempt: q.attempts[0] ? { score: q.attempts[0].score, total: q.attempts[0].total } : null })),
    announcements
  });
}));

async function myEnrollmentIn(userId, cohortId) {
  return prisma.enrollment.findUnique({ where: { userId_cohortId: { userId, cohortId } } });
}

r.get('/quizzes/:id', ah(async (req, res) => {
  const quiz = await prisma.quiz.findUnique({ where: { id: req.params.id }, include: { questions: { orderBy: { order: 'asc' } } } });
  if (!quiz || !(await myEnrollmentIn(req.user.id, quiz.cohortId))) throw notFound('Quiz');
  if (quiz.closesAt < new Date()) throw bad('This quiz has closed.');
  if (await prisma.quizAttempt.findUnique({ where: { quizId_userId: { quizId: quiz.id, userId: req.user.id } } })) throw bad('You’ve already taken this quiz.');
  res.json({ quiz: { id: quiz.id, title: quiz.title, minutes: quiz.minutes, closesAt: quiz.closesAt, questions: quiz.questions.map((q) => ({ id: q.id, text: q.text, options: q.options })) } });
}));

const AttemptBody = z.object({ answers: z.array(z.number().int().min(-1)) });

r.post('/quizzes/:id/attempt', ah(async (req, res) => {
  const { answers } = parse(AttemptBody, req.body);
  const quiz = await prisma.quiz.findUnique({ where: { id: req.params.id }, include: { questions: { orderBy: { order: 'asc' } } } });
  if (!quiz || !(await myEnrollmentIn(req.user.id, quiz.cohortId))) throw notFound('Quiz');
  // A short grace period covers slow connections at the deadline.
  if (quiz.closesAt.getTime() + 5 * 60e3 < Date.now()) throw bad('This quiz has closed.');
  const score = quiz.questions.reduce((s, q, i) => s + (answers[i] === q.answer ? 1 : 0), 0);
  try {
    await prisma.quizAttempt.create({ data: { quizId: quiz.id, userId: req.user.id, answers, score, total: quiz.questions.length } });
  } catch {
    throw bad('You’ve already taken this quiz.');
  }
  res.json({
    score,
    total: quiz.questions.length,
    review: quiz.questions.map((q, i) => ({ text: q.text, options: q.options, answer: q.answer, chosen: answers[i] ?? -1 }))
  });
}));

const SubmitBody = z.object({
  repoUrl: z.string().trim().url('Paste the full GitHub link, starting with https://'),
  liveUrl: z.union([z.literal(''), z.string().trim().url('Paste the full live link, starting with https://')]).default(''),
  note: z.string().trim().max(1000).default('')
});

r.post('/assignments/:id/submit', ah(async (req, res) => {
  const body = parse(SubmitBody, req.body);
  const a = await prisma.assignment.findUnique({ where: { id: req.params.id } });
  if (!a || !(await myEnrollmentIn(req.user.id, a.cohortId))) throw notFound('Assignment');
  const data = { ...body, score: null, changesRequested: false, feedback: '', submittedAt: new Date() };
  const submission = await prisma.submission.upsert({
    where: { assignmentId_userId: { assignmentId: a.id, userId: req.user.id } },
    create: { ...data, assignmentId: a.id, userId: req.user.id },
    update: data
  });
  res.json({ submission });
}));

export default r;
