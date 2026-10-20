// All dates and class times are Lagos time. Set before anything creates a Date.
process.env.TZ = process.env.TZ || 'Africa/Lagos';

const list = (s) => (s || '').split(',').map((x) => x.trim()).filter(Boolean);

export const env = {
  port: Number(process.env.PORT) || 4000,
  isProd: process.env.NODE_ENV === 'production',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  // ".moverstech.xyz" in production so one login works on learn., space. and admin.
  cookieDomain: process.env.COOKIE_DOMAIN || undefined,
  origins: list(process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:5174,http://localhost:5175'),
  // Money Moves Business (online payments). Secret key: sk_test_... or sk_live_...
  moneyMovesKey: process.env.MONEYMOVES_SECRET_KEY || '',
  // Webhook signing secret (whsec_...), from Developers → Webhooks in the Money Moves dashboard.
  moneyMovesWebhookSecret: process.env.MONEYMOVES_WEBHOOK_SECRET || '',
  moneyMovesBase: (process.env.MONEYMOVES_API_URL || 'https://business.usemoneymoves.xyz/api/v1').replace(/\/$/, ''),
  // Lets "Pay online" succeed without Money Moves while testing. Never set in production.
  fakePayments: process.env.DEV_FAKE_PAYMENTS === 'true',
  whatsappNumber: process.env.WHATSAPP_NUMBER || '2348165468975',

  // This API's own public address, used for the Google sign-in callback.
  publicApiUrl: (process.env.PUBLIC_API_URL || 'http://localhost:4000').replace(/\/$/, ''),
  learnUrl: (process.env.LEARN_URL || 'http://localhost:5173').replace(/\/$/, ''),
  spaceUrl: (process.env.SPACE_URL || 'http://localhost:5174').replace(/\/$/, ''),
  adminUrl: (process.env.ADMIN_URL || 'http://localhost:5175').replace(/\/$/, ''),

  // Resend (email). Without a key, emails are printed to the console in development.
  resendKey: process.env.RESEND_API_KEY || '',
  emailFrom: process.env.EMAIL_FROM || 'Movers <no-reply@moverstech.xyz>',

  google: { clientId: process.env.GOOGLE_CLIENT_ID || '', clientSecret: process.env.GOOGLE_CLIENT_SECRET || '' }
};

if (env.isProd && env.jwtSecret === 'dev-secret-change-me') {
  throw new Error('JWT_SECRET must be set in production.');
}
