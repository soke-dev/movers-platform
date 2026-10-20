// Sets up the first class, the 12 skills, Movers Space prices and rooms,
// and an admin login. Runs on every API start: it only fills what is missing.
// `node prisma/seed.js --resend` emails the admin a fresh link even if one is still valid.
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

process.env.TZ = process.env.TZ || 'Africa/Lagos';
const prisma = new PrismaClient();

const SKILLS = [
  ['web-development', 'Web Development', 'HTML, CSS, JavaScript, React, Next.js', 1, 2, 'code', 'code', 'amber', ['HTML and CSS layouts', 'JavaScript you’ll actually use', 'React components and state', 'Next.js pages and deployment']],
  ['backend-development', 'Backend Development', 'Node.js, Python, databases, APIs', 3, 3, 'code', 'db', 'violet', ['Node.js and Express', 'Python basics', 'REST APIs and logins', 'Databases with PostgreSQL']],
  ['mobile-app-development', 'Mobile App Development', 'Flutter, React Native', 5, 5, 'code', 'phone', 'pink', ['Dart and Flutter', 'React Native for JavaScript devs', 'Publishing to the Play Store']],
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
        code: 'Cohort 04',
        startDate: new Date(2026, 9, 26),
        demoDate: new Date(2026, 11, 19),
        weeks: 8,
        days: [1, 3, 5, 6],
        scheduleText: 'Mon, Wed, Fri 10:00–15:00 · Sat 10:00–17:00',
        saturdayNote: 'Saturday’s class also covers revision for missed sessions',
        location: 'Lab A, 20A Etete Road, GRA, Benin City',
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
      bundle10: 25000,
      monthly: 45000,
      dedicated: 70000,
      vatPercent: 7.5,
      studentDiscount: 20,
      teaPerPerson: 500,
      hallPackages: [
        { id: 'am', name: 'Morning half day', start: 8, end: 12, price: 60000 },
        { id: 'pm', name: 'Afternoon half day', start: 13, end: 17, price: 60000 },
        { id: 'eve', name: 'Evening', start: 17, end: 20, price: 45000 },
        { id: 'full', name: 'Full day', start: 8, end: 20, price: 100000 }
      ],
      addons: [
        { id: 'projector', name: 'Projector and screen', price: 5000, perGuest: false },
        { id: 'pa', name: 'PA system with 2 mics', price: 10000, perGuest: false },
        { id: 'food', name: 'Refreshments', price: 1500, perGuest: true },
        { id: 'cleaning', name: 'Extra cleaning', price: 7500, perGuest: false }
      ],
      layouts: [
        { id: 'theatre', name: 'Theatre', capacity: 50 },
        { id: 'classroom', name: 'Classroom', capacity: 30 },
        { id: 'board', name: 'Boardroom', capacity: 16 },
        { id: 'mixer', name: 'Mixer', capacity: 60 }
      ]
    }
  });

  const rooms = [
    { slug: 'room-a', name: 'Meeting room A', kind: 'MEETING', capacity: 6, hourlyRate: 5000 },
    { slug: 'room-b', name: 'Meeting room B', kind: 'MEETING', capacity: 12, hourlyRate: 7500 },
    { slug: 'hall', name: 'Event hall', kind: 'HALL', capacity: 60, hourlyRate: 0 }
  ];
  for (const room of rooms) await prisma.room.upsert({ where: { slug: room.slug }, update: {}, create: room });

  // First admin. They get an email to choose their password, which also confirms the email.
  // (If ADMIN_PASSWORD is set instead, they get a normal confirmation email.)
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  if (email) {
    const { issueToken } = await import('../src/lib/tokens.js');
    const { sendSetPasswordEmail, sendVerifyEmail } = await import('../src/lib/email.js');
    const { env } = await import('../src/env.js');
    let admin = await prisma.user.findUnique({ where: { email } });
    if (!admin) {
      admin = await prisma.user.create({
        data: {
          email,
          name: process.env.ADMIN_NAME || 'Movers Admin',
          passwordHash: password ? await bcrypt.hash(password, 10) : null,
          role: 'ADMIN',
          referralCode: 'ADMIN-' + Date.now().toString(36).toUpperCase()
        }
      });
    } else if (admin.role !== 'ADMIN') {
      admin = await prisma.user.update({ where: { email }, data: { role: 'ADMIN' } });
    }
    // Don't email again on every restart while an earlier link still works.
    const waiting = await prisma.authToken.findFirst({ where: { userId: admin.id, usedAt: null, expiresAt: { gt: new Date() } } });
    if (admin.emailVerifiedAt && admin.passwordHash) {
      console.log(`Admin ${email} is ready. Log in at ${env.adminUrl}`);
    } else if (waiting && !process.argv.includes('--resend')) {
      console.log(`Admin ${email} has already been emailed a link. Run the seed with --resend to send a new one.`);
    } else {
      const kind = admin.passwordHash ? 'VERIFY_EMAIL' : 'RESET_PASSWORD';
      const token = await issueToken(admin.id, kind, 24 * 3600e3);
      const sent = kind === 'RESET_PASSWORD'
        ? await sendSetPasswordEmail(admin, `${env.adminUrl}/reset-password?token=${token}`)
        : await sendVerifyEmail(admin, `${env.adminUrl}/verify-email?token=${token}&next=%2F`);
      if (sent) console.log(`Emailed ${email} a link to ${kind === 'RESET_PASSWORD' ? 'set their password' : 'confirm their email'}.`);
      else {
        // Try again on the next start.
        await prisma.authToken.deleteMany({ where: { userId: admin.id, usedAt: null } });
        console.log(`Could not email ${email}. Check RESEND_API_KEY and EMAIL_FROM.`);
      }
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
