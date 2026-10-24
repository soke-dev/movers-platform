import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { ah, parse, dateOnly, addDays, startOfDay, sameDay, isSunday, CLOSED_SUNDAY } from '../lib/util.js';
import { getCurrentCohort, seatsTaken, cohortView, skillView } from '../lib/cohorts.js';
import { getSettings, quoteDesk, quoteRoom, quoteHall, bookingWindow, conflicts, pickRoom } from '../lib/pricing.js';

const r = Router();

r.get('/class', ah(async (_req, res) => {
  const cohort = await getCurrentCohort();
  const skills = await prisma.skill.findMany({ where: { visible: true }, orderBy: { sortOrder: 'asc' } });
  res.json({
    cohort: cohort ? cohortView(cohort, await seatsTaken(cohort.id)) : null,
    skills: skills.map(skillView)
  });
}));

r.get('/space', ah(async (_req, res) => {
  const [settings, rooms] = await Promise.all([getSettings(), prisma.room.findMany({ orderBy: { capacity: 'asc' } })]);
  res.json({ settings, rooms });
}));

const DateQuery = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-10-23') });

r.get('/availability', ah(async (req, res) => {
  const { date } = parse(DateQuery, req.query);
  const from = dateOnly(date);
  const to = addDays(from, 1);
  const [rooms, bookings, settings] = await Promise.all([
    prisma.room.findMany(),
    prisma.booking.findMany({ where: { status: { in: ['HELD', 'CONFIRMED'] }, start: { lt: to }, end: { gt: from } } }),
    getSettings()
  ]);
  const inNow = sameDay(from, new Date())
    ? await prisma.visit.count({ where: { checkedInAt: { gte: startOfDay() }, checkedOutAt: null } })
    : 0;
  res.json({
    date,
    desksFree: Math.max(0, settings.desks - inNow),
    desks: settings.desks,
    rooms: rooms.map((room) => ({
      slug: room.slug,
      busy: bookings.filter((b) => b.roomId === room.id).map((b) => [b.start.getHours() + b.start.getMinutes() / 60, b.end.getHours() + b.end.getMinutes() / 60])
    }))
  });
}));

export const BookingInput = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('desk'),
    pass: z.enum(['day', 'weekly', 'monthly']),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    people: z.coerce.number().int().min(1).max(10)
  }),
  z.object({
    type: z.literal('room'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    people: z.coerce.number().int().min(1).max(200),
    addons: z.record(z.boolean()).optional()
  }),
  z.object({
    type: z.literal('hall'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    pkg: z.string(),
    guests: z.coerce.number().int().min(1).max(200),
    layout: z.string(),
    addons: z.record(z.boolean()).optional(),
    deposit: z.boolean().optional()
  })
]);

/** Prices a booking. The same function decides the price when the booking is made. */
export async function quoteBooking(input, user) {
  const s = await getSettings();
  if (isSunday(dateOnly(input.date))) return { error: CLOSED_SUNDAY };
  // The student rate is automatic for anyone who has attended a Movers Learn class; nobody can just claim it.
  if (input.type === 'desk') return { ...quoteDesk(s, { ...input, student: Boolean(user?.isStudent) }), what: null };
  const rooms = await prisma.room.findMany();
  const { start, end } = bookingWindow(s, input);
  if ((end - dateOnly(input.date)) / 3600e3 > 22) return { error: 'Bookings must end by 22:00. Pick an earlier start or fewer hours.' };
  // A meeting room day can be booked until it ends; hall blocks until they start.
  if ((input.type === 'room' ? end : start) < new Date()) return { error: input.type === 'room' ? 'Pick today or a later date.' : 'Pick a time that hasn’t passed yet.' };
  if (input.type === 'room') {
    const room = pickRoom(rooms, input.people);
    if (!room) {
      const hall = rooms.find((x) => x.kind === 'HALL');
      return { error: `The space holds up to ${hall?.capacity || 30} people. For a bigger group, call or WhatsApp us.` };
    }
    const clash = (await conflicts(room.id, start, end)).length > 0;
    return { ...quoteRoom(s, room, input), room, start, end, clash };
  }
  const hall = rooms.find((x) => x.kind === 'HALL');
  const q = quoteHall(s, input);
  const clash = (await conflicts(hall.id, start, end)).length > 0;
  return { ...q, room: hall, start, end, clash };
}

r.post('/quote', ah(async (req, res) => {
  const input = parse(BookingInput, req.body);
  const user = req.user ? { ...req.user, isStudent: await isStudent(req.user.id) } : null;
  try {
    const q = await quoteBooking(input, user);
    res.json({ ...q, room: q.room ? { name: q.room.name, slug: q.room.slug } : undefined, studentApplied: input.type === 'desk' && Boolean(user?.isStudent) });
  } catch (e) {
    if (e.status === 400) return res.json({ error: e.message });
    throw e;
  }
}));

/** A Movers Learn student for the Space rate: marked present (or late) at one or more Movers Learn classes. */
export async function isStudent(userId) {
  return (await prisma.attendance.count({ where: { userId, status: { in: ['PRESENT', 'LATE'] } } })) > 0;
}

export default r;
