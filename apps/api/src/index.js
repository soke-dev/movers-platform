import { env } from './env.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { prisma } from './db.js';
import { loadUser } from './lib/auth.js';
import authRoutes from './routes/auth.js';
import publicRoutes from './routes/public.js';
import learnRoutes from './routes/learn.js';
import spaceRoutes from './routes/space.js';
import paymentRoutes, { moneyMovesWebhook } from './routes/payments.js';
import adminRoutes from './routes/admin.js';

const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: env.origins, credentials: true }));

// Money Moves signs the raw body, so this route must come before express.json().
app.post('/payments/moneymoves/webhook', express.raw({ type: '*/*', limit: '1mb' }), moneyMovesWebhook);

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(loadUser);

app.get('/health', async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ ok: true });
});

app.use('/auth', authRoutes);
app.use('/public', publicRoutes);
app.use('/learn', learnRoutes);
app.use('/space', spaceRoutes);
app.use('/payments', paymentRoutes);
app.use('/admin', adminRoutes);

app.use((_req, res) => res.status(404).json({ error: 'Not found.' }));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Something went wrong on our side. Try again in a moment.' : err.message });
});

app.listen(env.port, () => console.log(`Movers API on :${env.port}`));
