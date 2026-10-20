import { prisma } from '../db.js';
import { addDays } from './util.js';

export const getCurrentCohort = () =>
  prisma.cohort.findFirst({ where: { isCurrent: true }, orderBy: { startDate: 'desc' } });

/** A full-class seat counts once at least one payment for it is made. */
export async function seatsTaken(cohortId) {
  return prisma.enrollment.count({
    where: { cohortId, kind: 'FULL', payments: { some: { status: 'PAID' } } }
  });
}

export function classDates(cohort) {
  const out = [];
  for (let i = 0; i < cohort.weeks * 7; i++) {
    const d = addDays(cohort.startDate, i);
    if (cohort.days.includes(d.getDay())) out.push(d);
  }
  return out;
}

const weekOf = (cohort, date) => Math.floor((date - cohort.startDate) / (7 * 864e5)) + 1;

/** Creates class sessions for every class day, and removes unused ones if the dates change. */
export async function syncSessions(cohort) {
  const skills = await prisma.skill.findMany({ where: { visible: true }, orderBy: { sortOrder: 'asc' } });
  const dates = classDates(cohort);
  await prisma.classSession.deleteMany({
    where: { cohortId: cohort.id, date: { notIn: dates }, attendance: { none: {} } }
  });
  for (const date of dates) {
    const w = weekOf(cohort, date);
    const topic = skills.filter((s) => w >= s.weekStart && w <= s.weekEnd && s.weekEnd - s.weekStart < 3).map((s) => s.name).join(' and ');
    await prisma.classSession.upsert({
      where: { cohortId_date: { cohortId: cohort.id, date } },
      create: { cohortId: cohort.id, date, topic },
      update: {}
    });
  }
}

export function cohortView(c, taken = 0) {
  return {
    id: c.id,
    name: c.name,
    code: c.code,
    startDate: c.startDate,
    demoDate: c.demoDate,
    weeks: c.weeks,
    days: c.days,
    scheduleText: c.scheduleText,
    saturdayNote: c.saturdayNote,
    location: c.location,
    seats: c.seats,
    seatsLeft: Math.max(0, c.seats - taken),
    fullPrice: c.fullPrice,
    skillPrice: c.skillPrice,
    allowTwoPayments: c.allowTwoPayments,
    supportNote: c.supportNote,
    mentorshipNote: c.mentorshipNote,
    laptopNote: c.laptopNote
  };
}

export const skillView = (s) => ({
  id: s.id,
  slug: s.slug,
  name: s.name,
  description: s.description,
  weekStart: s.weekStart,
  weekEnd: s.weekEnd,
  group: s.group,
  icon: s.icon,
  color: s.color,
  topics: s.topics,
  visible: s.visible,
  sortOrder: s.sortOrder
});
