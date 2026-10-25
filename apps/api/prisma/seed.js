// Sets up the first class, the 12 skills, Movers Space prices and rooms,
// and an admin login. Runs on every API start: it only fills what is missing.
// `node prisma/seed.js --resend` emails a new admin the welcome again.
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { newReferralCode } from '../src/lib/util.js';

process.env.TZ = process.env.TZ || 'Africa/Lagos';
const prisma = new PrismaClient();

const SKILLS = [
  ['web-development', 'Web Development', 'HTML, CSS, JavaScript, React, Next.js', 1, 2, 'code', 'code', 'amber', ['HTML and CSS layouts', 'JavaScript you’ll actually use', 'React components and state', 'Next.js pages and deployment']],
  ['backend-development', 'Backend Development', 'Node.js, Python, databases, APIs', 3, 3, 'code', 'db', 'violet', ['Node.js and Express', 'Python basics', 'REST APIs and logins', 'Databases with PostgreSQL']],
  ['mobile-app-development', 'Mobile App Development', 'Flutter, React Native', 5, 5, 'code', 'phone', 'pink', ['Dart and Flutter', 'React Native for JavaScript devs', 'Publishing to the Play Store and App Store']],
  ['blockchain-web3', 'Blockchain & Web3', 'Smart contracts, Solidity, dApps, Move, wallets', 6, 6, 'web3ai', 'cube', 'lime', ['How blockchains and wallets work', 'Smart contracts in Solidity and Move', 'Building a dApp front end']],
  ['ai-machine-learning', 'AI & Machine Learning', 'Prompt engineering, AI tools, automation', 7, 7, 'web3ai', 'brain', 'violet', ['How AI models work', 'Prompt engineering', 'AI tools for everyday work']],
  ['ui-ux-design', 'UI/UX Design', 'Figma, product design', 1, 1, 'design', 'pen', 'amber', ['Design basics and Figma', 'User research', 'Wireframes to clickable prototypes']],
  ['cloud-devops', 'Cloud & DevOps', 'Git, Docker, hosting, deployment', 4, 4, 'ops', 'cloud', 'pink', ['Git and GitHub workflows', 'Docker', 'Hosting and automatic deploys']],
  ['product-building', 'Product Building', 'From idea to live project', 2, 8, 'design', 'chart', 'lime', ['Finding a problem worth solving', 'Planning features and scope', 'Shipping, feedback and iteration']],
  ['career-growth', 'Career Growth', 'Portfolio, CV, job readiness', 6, 8, 'career', 'briefcase', 'violet', ['Portfolio and GitHub clean-up', 'CV clinic and LinkedIn', 'Mock interviews']],
  ['cybersecurity', 'Cybersecurity', 'Secure and protect systems', 8, 8, 'ops', 'shield', 'amber', ['Passwords, phishing and safe habits', 'Securing web apps', 'Finding and fixing weak spots']],
  ['data-management', 'Data Management', 'Store, manage and optimise data', 4, 4, 'ops', 'layers', 'violet', ['SQL from zero', 'Modelling and cleaning data', 'Dashboards that answer questions']],
  ['automation', 'Automation', 'Build tools that save time', 7, 7, 'web3ai', 'zap', 'pink', ['Spotting work worth automating', 'No-code automation tools', 'Scripts and bots']]
];

async function main() {
  for (const [i, [slug, name, description, weekStart, weekEnd, group, icon, color, topics]] of SKILLS.entries()) {
    await prisma.skill.upsert({ where: { slug }, update: {}, create: { slug, name, description, weekStart, weekEnd, group, icon, color, topics, sortOrder: i } });
  }

  if (!(await prisma.cohort.count())) {
    const cohort = await prisma.cohort.create({
      data: {
        name: 'Full-Stack Tech Class',
        code: 'Cohort 01',
        startDate: new Date(2026, 9, 26),
        demoDate: new Date(2026, 11, 19),
        weeks: 8,
        days: [1, 3, 5, 6],
        scheduleText: 'Mon, Wed, Fri 10:00–15:00 · Sat 10:00–17:00',
        saturdayNote: 'Saturday’s class also covers revision for missed sessions',
        location: 'Movers Hub, 20A Etete Road, GRA, Benin City',
        seats: 25,
        fullPrice: 250000,
        skillPrice: 50000,
        allowTwoPayments: true,
        supportNote: 'Online support while you learn',
        mentorshipNote: '3 months of mentorship after the class',
        laptopNote: 'Bring your own laptop to every class, charged, with its charger. Windows, Mac or Linux all work.',
        isCurrent: true
      }
    });
    const { syncSessions } = await import('../src/lib/cohorts.js');
    await syncSessions(cohort);
  }

  await prisma.spaceSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      desks: 24,
      dayPass: 3000,
      weekly: 15000,
      monthly: 45000,
      studentDiscount: 20,
      // The hall is booked by the day.
      hallPackages: [{ id: 'day', name: 'Full day', start: 8, end: 20, price: 100000 }],
      addons: [
        { id: 'tv', name: '55-inch TV', price: 5000, perGuest: false },
        { id: 'sound', name: 'Sound system with mic', price: 5000, perGuest: false },
        { id: 'food', name: 'Refreshments', price: 1500, perGuest: true },
        { id: 'cleaning', name: 'Extra cleaning', price: 2000, perGuest: false }
      ],
      layouts: [
        { id: 'theatre', name: 'Theatre', capacity: 30 },
        { id: 'classroom', name: 'Classroom', capacity: 30 },
        { id: 'board', name: 'Boardroom', capacity: 16 },
        { id: 'mixer', name: 'Mixer', capacity: 30 }
      ]
    }
  });

  const rooms = [
    { slug: 'meeting-room', name: 'Meeting room', kind: 'MEETING', capacity: 10, dayRate: 30000 },
    { slug: 'hall', name: 'Entire space', kind: 'HALL', capacity: 30, dayRate: 0 }
  ];
  for (const room of rooms) await prisma.room.upsert({ where: { slug: room.slug }, update: {}, create: room });

  // First admin. Without ADMIN_PASSWORD they get one welcome email: they choose a password with
  // "Forgot your password?" on the admin login, and the code they get confirms the email too.
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  if (email) {
    const { sendAdminWelcomeEmail } = await import('../src/lib/email.js');
    const { env } = await import('../src/env.js');
    let admin = await prisma.user.findUnique({ where: { email } });
    if (!admin) {
      admin = await prisma.user.create({
        data: {
          email,
          name: process.env.ADMIN_NAME || 'Movers Admin',
          passwordHash: password ? await bcrypt.hash(password, 10) : null,
          // On your own computer, a password in .env is enough to log in. In production, logging in sends a code first.
          emailVerifiedAt: password && process.env.NODE_ENV !== 'production' ? new Date() : null,
          role: 'ADMIN',
          referralCode: newReferralCode()
        }
      });
    } else if (admin.role !== 'ADMIN') {
      admin = await prisma.user.update({ where: { email }, data: { role: 'ADMIN' } });
    }
    const key = `admin-welcome:${admin.id}`;
    if (process.argv.includes('--resend')) await prisma.reminderSent.deleteMany({ where: { key } });
    if (admin.passwordHash) {
      console.log(`Admin ${email} is ready. Log in at ${env.adminUrl}/login`);
    } else if (await prisma.reminderSent.findUnique({ where: { key } })) {
      console.log(`Admin ${email} was emailed already. They choose a password with "Forgot your password?" at ${env.adminUrl}/login`);
    } else if (await sendAdminWelcomeEmail(admin, `${env.adminUrl}/login`)) {
      await prisma.reminderSent.create({ data: { key } });
      console.log(`Emailed ${email}: choose a password with "Forgot your password?" at ${env.adminUrl}/login`);
    } else {
      // Tried again on the next start.
      console.log(`Could not email ${email}. Check RESEND_API_KEY and EMAIL_FROM.`);
    }
  } else {
    console.log('Set ADMIN_EMAIL to create the first admin login.');
  }
  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(process.exitCode || 0);
  });
