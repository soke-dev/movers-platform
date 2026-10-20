import { prisma } from '../db.js';
import { atHour, bad, dateOnly, addDays } from './util.js';

export const getSettings = () => prisma.spaceSettings.findUniqueOrThrow({ where: { id: 1 } });

const vatOf = (s, sub) => Math.round((sub * s.vatPercent) / 100);
const finish = (s, lines, sub, payNowShare = 1) => {
  const vat = vatOf(s, sub);
  const total = sub + vat;
  return { lines, subtotal: sub, vat, total, payNow: Math.round(total * payNowShare) };
};

export const PASS_INFO = {
  day: { kind: 'DAY', label: 'Day pass', days: 1, validDays: 1 },
  bundle: { kind: 'BUNDLE', label: '10-day bundle', days: 10, validDays: 60 },
  monthly: { kind: 'MONTHLY', label: 'Monthly hot desk', days: null, validDays: 30 },
  dedicated: { kind: 'DEDICATED', label: 'Dedicated desk, monthly', days: null, validDays: 30 }
};

export function quoteDesk(s, { pass, people, student }) {
  const info = PASS_INFO[pass];
  if (!info) throw bad('Choose a plan.');
  const unit = { day: s.dayPass, bundle: s.bundle10, monthly: s.monthly, dedicated: s.dedicated }[pass];
  const lines = [[`${info.label}${people > 1 ? ` × ${people} people` : ''}`, unit * people]];
  let sub = unit * people;
  if (student && pass !== 'dedicated') {
    const off = Math.round((unit * s.studentDiscount) / 100);
    lines.push([`Movers Learn student, ${s.studentDiscount}% off (1 person)`, -off]);
    sub -= off;
  }
  return finish(s, lines, sub);
}

export function quoteRoom(s, room, { hours, people, tea }) {
  const lines = [[`${room.name} · ${hours} h × ₦${room.hourlyRate.toLocaleString('en-NG')}`, room.hourlyRate * hours]];
  let sub = room.hourlyRate * hours;
  if (tea) {
    lines.push([`Tea and water × ${people}`, s.teaPerPerson * people]);
    sub += s.teaPerPerson * people;
  }
  return finish(s, lines, sub);
}

export function quoteHall(s, { pkg, guests, layout, addons = {}, deposit }) {
  const p = s.hallPackages.find((x) => x.id === pkg);
  if (!p) throw bad('Choose a time block.');
  const l = s.layouts.find((x) => x.id === layout);
  if (!l) throw bad('Choose a layout.');
  if (guests > l.capacity) throw bad(`${l.name} seats ${l.capacity}. Pick another layout or fewer guests.`);
  const lines = [[`${p.name} · ${l.name}`, p.price]];
  let sub = p.price;
  for (const a of s.addons) {
    if (!addons[a.id]) continue;
    const amt = a.perGuest ? a.price * guests : a.price;
    lines.push([a.perGuest ? `${a.name} × ${guests}` : a.name, amt]);
    sub += amt;
  }
  return { ...finish(s, lines, sub, deposit ? 0.5 : 1), package: p, layout: l };
}

/** Works out the time window of a room or hall booking. */
export function bookingWindow(s, input) {
  if (input.type === 'room') {
    const start = atHour(input.date, input.start);
    return { start, end: new Date(start.getTime() + input.hours * 3600e3) };
  }
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
