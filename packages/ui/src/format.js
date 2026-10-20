export const naira = (n) => '₦' + Math.round(Number(n) || 0).toLocaleString('en-NG');

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const d = (x) => (x instanceof Date ? x : new Date(x));

/** "Mon 26 Oct" */
export const fmtDay = (x) => {
  const t = d(x);
  return `${DOW[t.getDay()]} ${t.getDate()} ${MON[t.getMonth()]}`;
};
/** "26 Oct" */
export const fmtShort = (x) => {
  const t = d(x);
  return `${t.getDate()} ${MON[t.getMonth()]}`;
};
/** "26 Oct 2026" */
export const fmtDate = (x) => {
  const t = d(x);
  return `${t.getDate()} ${MON[t.getMonth()]} ${t.getFullYear()}`;
};
/** "09:14" */
export const fmtTime = (x) => {
  const t = d(x);
  return `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
};
export const monthName = (x) => d(x).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
export const dayNum = (x) => d(x).getDate();
export const monShort = (x) => MON[d(x).getMonth()];

/** Whole calendar days from today to x (negative when past). */
export function daysUntil(x) {
  const a = new Date();
  a.setHours(0, 0, 0, 0);
  const b = d(x);
  const bb = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((bb - a) / 864e5);
}

export function dueText(x) {
  const n = daysUntil(x);
  if (n < 0) return 'Overdue';
  if (n === 0) return 'Due today';
  if (n === 1) return 'Due tomorrow';
  return `Due in ${n} days`;
}

export const weekLabel = (a, b) => (a === b ? `Week ${a}` : `Weeks ${a}–${b}`);

export function isoDate(x = new Date()) {
  const t = d(x);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

export const initials = (name = '') => name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');

export const phoneToWa = (p) => {
  const x = String(p || '').replace(/\D/g, '');
  return x.startsWith('234') ? x : x.startsWith('0') ? '234' + x.slice(1) : x;
};

export const hm = (mins) => `${Math.floor(mins / 60)}h ${String(Math.round(mins % 60)).padStart(2, '0')}m`;

export const COLORS = {
  amber: ['var(--amber)', 'var(--amber-soft)'],
  violet: ['var(--violet)', 'var(--violet-soft)'],
  pink: ['var(--pink)', 'var(--pink-soft)'],
  lime: ['#8DB000', 'var(--lime-soft)'],
  blue: ['var(--blue)', 'var(--blue-mist)']
};
export const GROUPS = { code: 'Coding', web3ai: 'Web3 & AI', design: 'Design & product', ops: 'Cloud, security & data', career: 'Career' };

export const PAY_STATUS = {
  PAID: ['ok', 'Paid'],
  PENDING: ['wait', 'Being confirmed'],
  UNPAID: ['due', 'Unpaid'],
  REJECTED: ['due', 'Not received'],
  CANCELLED: ['lock', 'Cancelled']
};
export const METHOD = { ONLINE: 'Online', WHATSAPP: 'WhatsApp', OFFICE: 'At the office' };
