import { daysUntil } from '@movers/ui';

/** Works out what the student needs to see from the /learn/me response. */
export function derive(data) {
  const now = new Date();
  const e = data.enrollment;
  const payments = e?.payments || [];
  const owing = payments.filter((p) => p.status === 'UNPAID' || p.status === 'PENDING');
  const quizzes = data.quizzes || [];
  const assignments = data.assignments || [];
  const sessions = data.sessions || [];
  const openQuizzes = quizzes.filter((q) => !q.attempt && new Date(q.closesAt) >= now);
  const dueTasks = assignments.filter((a) => {
    const s = a.submission;
    if (s?.changesRequested) return true;
    return !s && daysUntil(a.dueAt) <= 7;
  });
  const past = sessions.filter((s) => new Date(s.date) <= now);
  const marked = past.filter((s) => s.status);
  const attended = marked.filter((s) => s.status !== 'ABSENT').length;
  const nextClass = sessions.find((s) => new Date(s.date) >= new Date(now.getFullYear(), now.getMonth(), now.getDate()) && !s.status);
  const c = data.cohort;
  const week = c ? Math.min(c.weeks, Math.max(0, Math.floor((now - new Date(c.startDate)) / (7 * 864e5)) + 1)) : 0;
  const submitted = assignments.filter((a) => a.submission).length;
  const graded = assignments.filter((a) => a.submission?.score != null);
  return {
    owing,
    paid: payments.filter((p) => p.status === 'PAID'),
    secured: payments.some((p) => p.status === 'PAID'),
    feesCleared: payments.length > 0 && payments.every((p) => p.status === 'PAID'),
    openQuizzes,
    dueTasks,
    todo: [...openQuizzes, ...dueTasks],
    attendanceRate: marked.length ? Math.round((attended / marked.length) * 100) : null,
    marked,
    attended,
    late: marked.filter((s) => s.status === 'LATE').length,
    absent: marked.filter((s) => s.status === 'ABSENT').length,
    nextClass,
    week,
    progress: c ? Math.min(100, Math.round((Math.max(0, week - (now < new Date(c.startDate) ? 1 : 0)) / c.weeks) * 100)) : 0,
    submitted,
    graded,
    average: graded.length ? Math.round(graded.reduce((s, a) => s + (a.submission.score / a.maxScore) * 100, 0) / graded.length) : null
  };
}

/**
 * Whether they can still change their plan or skills: registration is open (the class hasn't started)
 * and nothing is paid or waiting to be confirmed. With a payment waiting, they cancel it first.
 */
export function planChange(payments, startDate, isOpen = true) {
  if (payments.some((p) => p.status === 'PAID')) return { can: false, why: '' };
  if (!isOpen || new Date() >= new Date(startDate)) return { can: false, why: 'Registration has closed, so the plan can’t change now.' };
  if (payments.some((p) => p.status === 'PENDING')) return { can: false, why: 'To change your plan or skills, cancel the payment being confirmed first.' };
  return { can: true, why: '' };
}
