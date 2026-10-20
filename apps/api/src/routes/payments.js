import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { ah, parse, notFound } from '../lib/util.js';
import { requireAuth } from '../lib/auth.js';
import { startPayment, markPaid, settleOnline, paymentView } from '../lib/payments.js';
import { validSignature } from '../lib/moneymoves.js';

const r = Router();

const PayBody = z.object({
  method: z.enum(['ONLINE', 'WHATSAPP', 'OFFICE', 'LATER']),
  returnUrl: z.string().optional()
});

r.post('/:id/pay', requireAuth, ah(async (req, res) => {
  const body = parse(PayBody, req.body);
  const payment = await prisma.payment.findUnique({ where: { id: req.params.id } });
  if (!payment || payment.userId !== req.user.id) throw notFound('Payment');
  res.json(await startPayment(payment, req.user, body.method, body.returnUrl));
}));

/** The payment page calls this when Money Moves sends the customer back. */
r.get('/verify', requireAuth, ah(async (req, res) => {
  const reference = String(req.query.ref || '');
  const payment = await prisma.payment.findUnique({ where: { reference } });
  if (!payment || payment.userId !== req.user.id) throw notFound('Payment');
  res.json({ payment: paymentView(await settleOnline(payment)) });
}));

/** Money Moves calls this after a payment. The raw body is needed to check the signature. */
export const moneyMovesWebhook = ah(async (req, res) => {
  if (!validSignature(req.body, req.headers['mm-signature'])) return res.sendStatus(401);
  const event = JSON.parse(req.body.toString('utf8'));
  if (event.type === 'payment.successful') {
    const mm = event.data?.object || {};
    const payment = await prisma.payment.findFirst({
      where: { OR: [{ gatewayRef: mm.checkout || '__none__' }, { reference: mm.checkout_reference || '__none__' }] }
    });
    if (payment && payment.status !== 'PAID' && Number(mm.received_ngn ?? mm.amount_ngn) >= payment.amount) {
      await markPaid(payment.id, null, 'ONLINE');
    }
  }
  res.sendStatus(200);
});

export default r;
