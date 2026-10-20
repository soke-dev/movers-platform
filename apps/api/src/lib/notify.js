// Personal notifications for the bell. Failing to save one never stops what triggered it.
import { prisma } from '../db.js';
import { env } from '../env.js';

/** Learn payments are class fees; everything else is Movers Space. */
export const siteForPurpose = (purpose) => (purpose === 'ENROLLMENT' ? 'learn' : 'space');

/** n: { title, body?, site?, path? } */
export function notify(userId, n) {
  return prisma.notification.create({ data: { userId, ...n } }).catch((e) => console.error('Notification failed', e));
}

export function notifyMany(userIds, n) {
  if (!userIds.length) return Promise.resolve();
  return prisma.notification.createMany({ data: userIds.map((userId) => ({ userId, ...n })) }).catch((e) => console.error('Notifications failed', e));
}

/** Turns a full link like https://learn.moverstech.xyz/dashboard/tasks into { site, path }. */
export function placeOf(link = '') {
  for (const [site, base] of [['learn', env.learnUrl], ['space', env.spaceUrl]]) {
    if (link.startsWith(base)) return { site, path: link.slice(base.length) || '/dashboard' };
  }
  return { site: '', path: '' };
}
