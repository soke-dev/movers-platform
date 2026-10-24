import { prisma } from '../db.js';
import { atHour, bad, dateOnly, addDays } from './util.js';

export const getSettings = () => prisma.spaceSettings.findUniqueOrThrow({ where: { id: 1 } });

// Prices include everything; there's no VAT on top. `vat` stays 0 so old bookings and receipts still add up.
const finish = (s, lines, sub, payNowShare = 1) => ({ lines, subtotal: sub, vat: 0, total: sub, payNow: Math.round(sub * payNowShare) });

export const PASS_INFO = {
  day: { kind: 'DAY', label: 'Day pass', days: 1, validDays: 1 },
  // 6 open days, Monday to Saturday: any 7 days in a row hold exactly one Sunday, when we're closed.
  weekly: { kind: 'WEEKLY', label: 'Weekly pass (6 days)', days: null, validDays: 7 },
  monthly: { kind: 'MONTHLY', label: 'Monthly hot desk', days: null, validDays: 30 }
};

export function quoteDesk(s, { pass, people, student }) {
  const info = PASS_INFO[pass];
  if (!info) throw bad('Choose a plan.');
  const unit = { day: s.dayPass, weekly: s.weekly, monthly: s.monthly }[pass];
  const lines = [[`${info.label}${people > 1 ? ` × ${people} people` : ''}`, unit * people]];
  let sub = unit * people;
  if (student) {
    const off = Math.round((unit * s.studentDiscount) / 100);
    lines.push([`Movers Learn student, ${s.studentDiscount}% off (1 person)`, -off]);
    sub -= off;
  }
  return finish(s, lines, sub);
}

/** The meeting room is booked for the whole day. */
export const ROOM_DAY = { open: 9, close: 18 };

/** The chosen add-ons (one list for the meeting room and the hall) as price lines. Per-guest ones × people. */
function addonLines(s, addons = {}, people) {
  return s.addons.filter((a) => addons[a.id]).map((a) => (a.perGuest ? [`${a.name} × ${people}`, a.price * people] : [a.name, a.price]));
}

export function quoteRoom(s, room, { people, addons }) {
  const lines = [[`${room.name} · full day`, room.dayRate], ...addonLines(s, addons, people)];
  return finish(s, lines, lines.reduce((t, [, amt]) => t + amt, 0));
}

export function quoteHall(s, { pkg, guests, layout, addons = {}, deposit }) {
  const p = s.hallPackages.find((x) => x.id === pkg);
  if (!p) throw bad('Choose a time block.');
  const l = s.layouts.find((x) => x.id === layout);
  if (!l) throw bad('Choose a layout.');
  if (guests > l.capacity) throw bad(`${l.name} seats ${l.capacity}. Pick another layout or fewer guests.`);
  const lines = [[`${p.name} · ${l.name}`, p.price], ...addonLines(s, addons, guests)];
  return { ...finish(s, lines, lines.reduce((t, [, amt]) => t + amt, 0), deposit ? 0.5 : 1), package: p, layout: l };
}

/** Works out the time window of a room or hall booking. */
export function bookingWindow(s, input) {
  if (input.type === 'room') return { start: atHour(input.date, ROOM_DAY.open), end: atHour(input.date, ROOM_DAY.close) };
  const p = s.hallPackages.find((x) => x.id === input.pkg);
  if (!p) throw bad('Choose a time block.');
  return { start: atHour(input.date, p.start), end: atHour(input.date, p.end) };
}

export async function conflicts(roomId, start, end, excludeId) {
  return prisma.booking.findMany({
    where: { roomId, status: { in: ['HELD', 'CONFIRMED'] }, start: { lt: end }, end: { gt: start }, ...(excludeId ? { id: { not: excludeId } } : {}) }
  });
}

export const pickRoom = (rooms, people) =>
  rooms.filter((r) => r.kind === 'MEETING' && r.capacity >= people).sort((a, b) => a.capacity - b.capacity)[0];

export function passWindow(pass, dateStr) {
  const info = PASS_INFO[pass];
  const from = dateOnly(dateStr);
  return { from, until: addDays(from, info.validDays) };
}
