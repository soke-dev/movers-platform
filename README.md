# Movers Learn and Movers Space

One codebase for both businesses, sharing one database and one login (a "Movers account").

| Part | Folder | Address | What it is |
| --- | --- | --- | --- |
| Learn website + student dashboard | `apps/learn` | learn.moverstech.xyz | Class info, skills, sign-up, payments, quizzes, projects, attendance, certificate |
| Space website + member dashboard | `apps/space` | space.moverstech.xyz | Prices, event hall, booking, passes, check-in, visits, payments, referrals |
| Staff admin | `apps/admin` | admin.moverstech.xyz | Payments to confirm, classes, skills, students, grading, attendance, announcements, front desk, bookings, prices |
| API | `apps/api` | api.moverstech.xyz | Node.js + Express + Prisma, talks to Postgres and Money Moves |
| Shared design and parts | `packages/ui` | – | Styles, payment screen, login, dashboard layout |

Accounts: sign up with email and password (the email must be confirmed before the first log in), or
**Continue with Google / Apple**. Emails (confirmation, password reset, receipts) go out through **Resend**.

Payments: online through **Money Moves** (bank transfer, Money Moves app, stablecoin), on **WhatsApp**
(staff confirm the transfer in admin), **at the office** (cash/POS, staff mark it paid), or **pay later**.

---

## Run it on your computer

You need Node.js 20+. Nothing else: a Postgres database comes with the project.

```bash
npm install
npm run dev
```

`npm run dev` starts a local database (kept in `.pgdata/`), creates the `.env` files with local settings the
first time, updates the tables, adds the starting data, then runs everything:

| | |
| --- | --- |
| Learn | http://localhost:5173 |
| Space | http://localhost:5174 |
| Admin | http://localhost:5175 (log in as `admin@movers.local` / `movers-admin`) |
| API | http://localhost:4000 |

Ctrl+C stops it all. To start again from an empty database, stop it and delete `.pgdata/`.
To run the parts one at a time: `npm run db:local`, then `npm run dev:api`, `dev:learn`, `dev:space`, `dev:admin`.

With `DEV_FAKE_PAYMENTS=true` in `apps/api/.env` (the local default), "Pay online" succeeds straight away so you
can test without Money Moves. Remove it once you add your Money Moves test key.

Without `RESEND_API_KEY`, emails aren't sent: the API prints each one (with its link) in its console, and
`http://localhost:4000/auth/dev-outbox` lists them.

---

## Deploy on Railway

### 1. Put the code on GitHub
Push this `movers-platform` folder to a GitHub repository (private is fine).

### 2. Create the Railway project
1. New Project → **Deploy PostgreSQL**. This is your database.
2. In the same project, add **four services** from your GitHub repo (New → GitHub Repo, pick the repo each time).
   Name them `api`, `learn`, `space`, `admin`.
3. For each service, open **Settings** and set (replace `X` with `api`, `learn`, `space` or `admin`):
   - **Root directory:** leave empty (the repo root). The apps share code, so they build from the top.
   - **Build command:** `npm run build -w apps/X`
   - **Start command:** `npm run start -w apps/X`
   - api only: **Healthcheck path** `/health`

### 3. Variables
**api** service:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (Railway fills it in) |
| `JWT_SECRET` | a long random string: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `COOKIE_DOMAIN` | `.moverstech.xyz` |
| `CORS_ORIGINS` | `https://learn.moverstech.xyz,https://space.moverstech.xyz,https://admin.moverstech.xyz` |
| `MONEYMOVES_SECRET_KEY` | your Money Moves secret key (`sk_test_...` first, `sk_live_...` when ready) |
| `MONEYMOVES_WEBHOOK_SECRET` | the webhook signing secret (`whsec_...`), see step 6 |
| `WHATSAPP_NUMBER` | `2348165468975` |
| `PUBLIC_API_URL` | `https://api.moverstech.xyz` |
| `LEARN_URL`, `SPACE_URL`, `ADMIN_URL` | `https://learn.moverstech.xyz`, `https://space.moverstech.xyz`, `https://admin.moverstech.xyz` |
| `RESEND_API_KEY` | from Resend → API keys (see step 7) |
| `EMAIL_FROM` | `Movers <no-reply@moverstech.xyz>` |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | optional, see step 8 |
| `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` | optional, see step 8 |
| `ADMIN_EMAIL`, `ADMIN_NAME` | your first admin |
| `NODE_ENV` | `production` |
| `TZ` | `Africa/Lagos` |

Do **not** set `DEV_FAKE_PAYMENTS` on Railway.

**learn**, **space** and **admin** services (the same values for all three):

| Variable | Value |
| --- | --- |
| `VITE_API_URL` | `https://api.moverstech.xyz` |
| `VITE_LEARN_URL` | `https://learn.moverstech.xyz` |
| `VITE_SPACE_URL` | `https://space.moverstech.xyz` |
| `VITE_ADMIN_URL` | `https://admin.moverstech.xyz` |
| `VITE_WHATSAPP` | `2348165468975` |
| `VITE_PHONE_DISPLAY` | `0816 546 8975` |

These are built into the websites, so **redeploy** a site after changing one.

### 4. Domains
In each service → Settings → Networking → **Custom Domain**, add:
`api.moverstech.xyz`, `learn.moverstech.xyz`, `space.moverstech.xyz`, `admin.moverstech.xyz`.
Railway shows a CNAME record for each; add those at your domain registrar. HTTPS is automatic.

All four must be on `moverstech.xyz` so one login works across them.

### 5. First run
Every time the API starts it updates the tables and fills in any missing starting data (the class, 12 skills,
Space prices and rooms, and the admin from `ADMIN_EMAIL`). Nothing you've edited in admin is overwritten.

The first start after `RESEND_API_KEY` is set emails `ADMIN_EMAIL` a link to choose a password (it works for 24 hours, and also confirms the email).
After that, log in at admin.moverstech.xyz. If the link expires, restart the api service and a new one is sent.

### 6. Money Moves
1. Money Moves dashboard → **Developers → API keys**: copy the secret key into `MONEYMOVES_SECRET_KEY`.
2. **Developers → Webhooks** → add endpoint `https://api.moverstech.xyz/payments/moneymoves/webhook`,
   choose the **payment.successful**, **refund.created** and **refund.completed** events, and copy its signing
   secret into `MONEYMOVES_WEBHOOK_SECRET`.
3. Test with your test key and a test payment, then switch both the key and the webhook secret to live.
   Test and live have different secrets.

When someone pays online they go to a Money Moves checkout page and come back to
`/payments/callback` on the site they started from. The payment is marked paid by the webhook (and also
checked when they return), never just by the visit back.

### 7. Resend (email)
1. Resend → **Domains → Add domain** → `moverstech.xyz`. Add the DNS records it shows (MX, TXT for SPF,
   TXT for DKIM, optional DMARC) at your registrar, then press **Verify**.
2. Resend → **API keys** → create one with sending access and put it in `RESEND_API_KEY`.

### 8. Google and Apple sign-in (optional)
The buttons only show once the keys are set.

**Google:** Google Cloud console → APIs & Services → OAuth consent screen (External, app name "Movers"),
then Credentials → Create OAuth client ID → Web application.
Authorised redirect URI: `https://api.moverstech.xyz/auth/google/callback`.

**Apple** (needs a paid Apple Developer account):
1. Identifiers → App ID with "Sign in with Apple".
2. Identifiers → **Services ID** (this is `APPLE_CLIENT_ID`, e.g. `xyz.moverstech.signin`). Turn on Sign in with
   Apple, domain `api.moverstech.xyz`, return URL `https://api.moverstech.xyz/auth/apple/callback`.
3. Keys → new key with Sign in with Apple → download the `.p8`. Its ID is `APPLE_KEY_ID`; your Team ID is top
   right. Put the `.p8` text in `APPLE_PRIVATE_KEY` (Railway accepts it on several lines).

---

## Day-to-day in admin

- **Payments → Waiting to confirm:** WhatsApp and office payments. "Confirm received" marks it paid and the
  student or member sees it straight away. "Not received" sends it back to unpaid.
- **Payments → Record a payment:** cash or POS at the desk. Pick the person and mark what they owe as paid.
- **Classes:** dates, days and times, seats, prices, two-payment option, laptop, support and mentorship
  notes. "Show on website" picks which class people sign up for. Class days drive the attendance register.
- **Skills:** add, edit, hide; weeks place each skill on the 8-week plan.
- **Quizzes & tasks:** set quizzes and projects, grade, request changes, see who hasn't taken a quiz and
  remind them on WhatsApp.
- **Payments → Paid → Refund** (admins only): online payments go back through Money Moves the way the person
  paid. You get a one-time bank account and an amount: transfer it from the business account and Money Moves
  sends the money on (Money Moves returns its fee, so you send a little less). Cash, POS and WhatsApp payments
  you pay back yourself, then record here. Either way the person gets an email. **Payments → Refunds** shows
  each one, its transfer details and "Check now". Paid bookings that were cancelled show "refund due".
- **Space today:** check people in (by name, or scan their code), sell a day pass at the desk, check them out.
- **Door scanner:** leave it open on a phone or tablet at the door. Members scan the code on their dashboard
  on the way in and again on the way out. Works with the camera, or a handheld scanner.
- **Team** (admins only): give staff access. Staff sign up on either website first.

## Automatic reminders
Once `RESEND_API_KEY` is set, the API emails reminders between 8:00 and 20:00, each one once:
class fees and hall balances due in 3 days or overdue, quizzes closing and projects due within a day (for
students who haven't done them), room and hall bookings the next day, and monthly passes or dedicated desks
ending in 3 days. Set `REMINDERS=off` on the api service to stop them.

## Things to add later
- Automatic WhatsApp messages (needs a WhatsApp Business API account). Today WhatsApp reminders open with the
  message filled in and staff press send.
