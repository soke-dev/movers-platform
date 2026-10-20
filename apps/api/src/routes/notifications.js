import { Router } from 'express';
import { prisma } from '../db.js';
import { ah } from '../lib/util.js';
import { requireAuth } from '../lib/auth.js';

const r = Router();
r.use(requireAuth);

/** Announcements for this person on this site. Learn: everyone, students, their classes. Space: everyone, Space. */
async function announcementsFor(user, site) {
  if (site === 'space') return { OR: [{ audience: 'EVERYONE' }, { audience: 'SPACE' }] };
  const cohortIds = (await prisma.enrollment.findMany({ where: { userId: user.id }, select: { cohortId: true } })).map((e) => e.cohortId);
  return {
    OR: [
      { audience: 'EVERYONE' },
      ...(cohortIds.length ? [{ audience: 'ALL_STUDENTS' }, { audience: 'COHORT', cohortId: { in: cohortIds } }] : [])
    ]
  };
}

/** The bell: announcements for the site plus their own notifications, newest first, and how many are new. */
r.get('/', ah(async (req, res) => {
  const site = req.query.site === 'space' ? 'space' : 'learn';
  const user = req.user;
  // Announcements from before they joined aren't "new" to them.
  const seen = new Date(Math.max(user.notificationsSeenAt?.getTime() || 0, user.createdAt.getTime()));
  const [mine, anns, unreadMine] = await Promise.all([
    prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 30 }),
    prisma.announcement.findMany({ where: await announcementsFor(user, site), orderBy: { createdAt: 'desc' }, take: 20 }),
    prisma.notification.count({ where: { userId: user.id, readAt: null } })
  ]);
  const items = [
    ...mine.map((n) => ({ id: n.id, kind: 'personal', title: n.title, body: n.body, site: n.site, path: n.path, at: n.createdAt, unread: !n.readAt })),
    ...anns.map((a) => ({ id: a.id, kind: 'announcement', title: a.title, body: a.body, site, path: '', at: a.createdAt, unread: a.createdAt > seen }))
  ].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 40);
  res.json({ items, unread: unreadMine + anns.filter((a) => a.createdAt > seen).length });
}));

/** Opening the bell marks everything in it as seen. */
r.post('/seen', ah(async (req, res) => {
  const now = new Date();
  await Promise.all([
    prisma.user.update({ where: { id: req.user.id }, data: { notificationsSeenAt: now } }),
    prisma.notification.updateMany({ where: { userId: req.user.id, readAt: null }, data: { readAt: now } })
  ]);
  res.json({ ok: true });
}));

export default r;
