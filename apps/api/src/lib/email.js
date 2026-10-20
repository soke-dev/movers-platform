// Sends email through Resend (https://resend.com). Without RESEND_API_KEY, emails are
// printed to the console and kept in a small outbox so you can test locally.
import { env } from '../env.js';

export const devOutbox = [];

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function layout({ title, intro, button, link, outro }) {
  return `<!doctype html><html><body style="margin:0;background:#F6F4FB;font-family:Segoe UI,Arial,sans-serif;color:#120D24">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" style="max-width:520px;background:#fff;border:1px solid #E7E3F0;border-radius:16px;padding:28px">
<tr><td style="font:800 18px Arial,sans-serif">movers</td></tr>
<tr><td style="padding-top:20px;font:800 22px Arial,sans-serif">${esc(title)}</td></tr>
<tr><td style="padding-top:12px;font-size:15px;line-height:1.55;color:#4A4560">${intro}</td></tr>
${button ? `<tr><td style="padding-top:22px"><a href="${esc(link)}" style="display:inline-block;background:#FF1A8C;color:#fff;text-decoration:none;font-weight:700;padding:13px 20px;border-radius:10px">${esc(button)}</a></td></tr>
<tr><td style="padding-top:16px;font-size:12px;color:#86829C;word-break:break-all">Or paste this link into your browser:<br>${esc(link)}</td></tr>` : ''}
${outro ? `<tr><td style="padding-top:18px;font-size:13px;color:#86829C">${outro}</td></tr>` : ''}
<tr><td style="padding-top:24px;font-size:12px;color:#86829C">Movers Tech · 20A Etete Road, GRA, Benin City</td></tr>
</table></td></tr></table></body></html>`;
}

export async function sendEmail({ to, subject, html, text }) {
  if (!env.resendKey) {
    if (env.isProd) {
      console.error(`RESEND_API_KEY is not set; could not send "${subject}" to ${to}`);
      return false;
    }
    devOutbox.unshift({ to, subject, text, at: new Date().toISOString() });
    devOutbox.length = Math.min(devOutbox.length, 50);
    console.log(`\n[email to ${to}] ${subject}\n${text}\n`);
    return true;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.emailFrom, to: [to], subject, html, text })
  });
  if (!res.ok) {
    console.error('Resend error', res.status, await res.text().catch(() => ''));
    return false;
  }
  return true;
}

export const sendVerifyEmail = (user, link) =>
  sendEmail({
    to: user.email,
    subject: 'Confirm your email for Movers',
    text: `Hi ${user.name.split(' ')[0]}, confirm your email to finish setting up your Movers account: ${link}\nThe link works for 24 hours.`,
    html: layout({ title: 'Confirm your email', intro: `Hi ${esc(user.name.split(' ')[0])}, tap the button to confirm your email and finish setting up your Movers account.`, button: 'Confirm my email', link, outro: 'The link works for 24 hours. If you didn’t sign up, you can ignore this email.' })
  });

export const sendResetEmail = (user, link) =>
  sendEmail({
    to: user.email,
    subject: 'Reset your Movers password',
    text: `Hi ${user.name.split(' ')[0]}, set a new password here: ${link}\nThe link works for 1 hour.`,
    html: layout({ title: 'Reset your password', intro: `Hi ${esc(user.name.split(' ')[0])}, tap the button to choose a new password.`, button: 'Choose a new password', link, outro: 'The link works for 1 hour. If you didn’t ask for this, you can ignore this email.' })
  });

export const sendSetPasswordEmail = (user, link) =>
  sendEmail({
    to: user.email,
    subject: 'Set your Movers admin password',
    text: `Hi ${user.name.split(' ')[0]}, an admin account was created for you. Choose your password here: ${link}\nThe link works for 24 hours.`,
    html: layout({ title: 'Set your admin password', intro: `Hi ${esc(user.name.split(' ')[0])}, an admin account was created for you on Movers. Choose a password to confirm your email and log in.`, button: 'Choose my password', link, outro: 'The link works for 24 hours.' })
  });

export const sendReceiptEmail = (user, payment) =>
  sendEmail({
    to: user.email,
    subject: `Payment received: ₦${payment.amount.toLocaleString('en-NG')}`,
    text: `Hi ${user.name.split(' ')[0]}, we received ₦${payment.amount.toLocaleString('en-NG')} for ${payment.description}. Reference: ${payment.reference}.`,
    html: layout({ title: 'Payment received', intro: `Hi ${esc(user.name.split(' ')[0])}, we received <b>₦${payment.amount.toLocaleString('en-NG')}</b> for ${esc(payment.description)}.<br><br>Reference: <b>${esc(payment.reference)}</b>`, outro: 'You can see all your receipts in your dashboard.' })
  });

export const sendRefundEmail = (user, payment, refund) => {
  const amount = `₦${refund.amount.toLocaleString('en-NG')}`;
  const where = refund.viaMoneyMoves ? 'It’s on its way back the way you paid: your bank account, Money Moves app or wallet.' : 'Our team will pay it back to you, or already has.';
  return sendEmail({
    to: user.email,
    subject: `Refund: ${amount}`,
    text: `Hi ${user.name.split(' ')[0]}, we've refunded ${amount} of your payment for ${payment.description} (ref ${payment.reference}). ${where}`,
    html: layout({ title: 'Your refund', intro: `Hi ${esc(user.name.split(' ')[0])}, we’ve refunded <b>${amount}</b> of your payment for ${esc(payment.description)}.<br><br>${where}<br><br>Reference: <b>${esc(payment.reference)}</b>`, outro: 'Questions? Reply on WhatsApp or call the office.' })
  });
};

/** Automatic reminders (payments due, quizzes closing, bookings tomorrow...). */
export const sendReminderEmail = (user, { subject, title, intro, button, link }) =>
  sendEmail({
    to: user.email,
    subject,
    text: `Hi ${user.name.split(' ')[0]}, ${intro}${link ? `\n${link}` : ''}`,
    html: layout({ title, intro: `Hi ${esc(user.name.split(' ')[0])}, ${esc(intro)}`, button, link, outro: 'You get this because you have a Movers account.' })
  });
