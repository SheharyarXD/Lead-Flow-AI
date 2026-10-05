# LeadFlow AI — Setup & Deployment Guide

A multi-tenant AI receptionist platform: CRM pipelines, a unified SMS/email inbox,
Twilio voice with call recording, Stripe subscription billing, and file attachments.

One deployment serves many businesses. Each business ("organization") signs up,
completes onboarding, and supplies **its own** Twilio, OpenAI and SMTP credentials
through Settings → Integrations. Platform-wide credentials in the environment are
used only as a fallback for organizations that have not configured their own.

---

## 1. Requirements

- Node.js 20 or newer
- A MySQL 8 database
- (Optional, per feature) Twilio, OpenAI, Stripe and S3-compatible storage accounts

---

## 2. Environment variables

Copy `.env.example` to `.env` and fill it in.

### Required — the server will not start in production without these

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | MySQL connection string, `mysql://user:pass@host:3306/dbname` |
| `APP_SECRET` | Signs session tokens **and** derives the encryption key for stored tenant credentials. Minimum 32 characters. See the warning below. |
| `NODE_ENV` | Must be `production` in a deployed environment. |
| `PUBLIC_URL` | Public base URL, e.g. `https://app.example.com`. Used to build Twilio callback URLs, Stripe return URLs and password-reset links. Defaults to `http://localhost:3000` if unset, which will break those callbacks. |

> **Do not change `APP_SECRET` after the first run.** Twilio auth tokens, SMTP
> passwords and OpenAI keys entered by tenants are encrypted with a key derived
> from it. Changing it makes every stored credential permanently undecryptable
> and silently logs users out.

Generate one with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

### Optional — platform settings

| Variable | Purpose |
| --- | --- |
| `PORT` | HTTP port. Defaults to `3000`. |
| `ADMIN_EMAIL` | The account registering with this address becomes the platform operator (role `admin`), which unlocks `/admin`. **If unset, the first account ever registered becomes the operator instead.** Set this explicitly on any publicly reachable deployment. |

### Optional — platform fallback integrations

Used only by organizations that have not entered their own credentials in the UI.
Leave them blank and the corresponding feature is simply inert — nothing crashes.

```env
# Twilio (SMS + Voice)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
TWILIO_TWIML_APP_SID=

# AI
OPENAI_API_KEY=

# Outbound email. Also used for account-level mail such as password resets
# and team invitations, which are not tied to any one organization.
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
SMTP_FROM_EMAIL=

# Inbound email webhook shared secret (required to accept inbound email)
EMAIL_WEBHOOK_SECRET=
```

### Optional — Stripe billing (one central platform account)

```env
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_ID=
STRIPE_PRICE_STARTER=
STRIPE_PRICE_PRO=
STRIPE_PRICE_ENTERPRISE=
```

### Optional — file storage (S3, Cloudflare R2 or MinIO)

Without these, uploads are written to a local `uploads/` directory, which does
not survive a redeploy on most hosts. Configure storage for any real deployment.

```env
S3_BUCKET=
S3_REGION=                 # defaults to us-east-1
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_ENDPOINT=               # only for R2 / MinIO; omit for AWS
```

The bucket should stay **private**. Downloads are served through short-lived
signed URLs issued after an organization-membership check.

---

## 3. Installation

```bash
npm install
npm run db:migrate     # creates the full schema — run this against an empty database
npm run build
npm start
```

> `npm run db:migrate` is the only schema command you need. It is safe to re-run;
> already-applied migrations are skipped.
>
> Do **not** run `npm run db:seed` on a production database — it inserts a demo
> "Acme Dental Care" tenant with sample leads and conversations, intended for
> local development only.

For local development:

```bash
npm run dev            # http://localhost:3000
```

### First run

1. Open the app and register an account.
2. That account becomes the platform operator if `ADMIN_EMAIL` matches it, or if
   it is the first account in the database.
3. Complete the five-step onboarding wizard for your organization.
4. Add integration credentials under Settings.

---

## 4. Twilio setup

Per organization, in **Settings → Integrations**: Account SID, Auth Token, phone
number and TwiML App SID. Then, in the Twilio Console:

1. **Voice → TwiML Apps → Create new TwiML App.** Set the Voice Request URL to
   `https://yourdomain.com/api/webhooks/voice` (HTTP POST). Copy the resulting
   `AP...` SID into the app.
2. **Phone Numbers → Active Numbers →** your number:
   - Voice: handled by the TwiML App above.
   - Messaging: `https://yourdomain.com/api/webhooks/sms` (HTTP POST).

> **Important:** inbound calls and texts are routed to a tenant by matching the
> receiving number against that organization's **business profile phone number**.
> Enter it in E.164 form (`+15551234567`) — exactly as Twilio sends it — or
> inbound traffic will not be matched to the organization.

Inbound calls play a greeting and record a voicemail, then create a call record,
a recording and a follow-up task. There is no live AI conversation on a phone
call and no call transfer. The AI receptionist answers **SMS and email**.

---

## 5. Stripe setup

Billing uses a single central Stripe account: the platform bills its tenants.
Tenants do not connect Stripe accounts of their own.

1. In **Product catalog → Add product**, create **LeadFlow Pro** with a
   recurring price of **$197 USD per month**. Copy its Price ID (`price_...`)
   into `STRIPE_PRICE_ID` (or the backwards-compatible `STRIPE_PRICE_PRO`).
   Checkout applies the 30-day trial in the app; do not add a second trial to
   the Stripe Price.
2. Put your Stripe **test secret key** (`sk_test_...`) in `STRIPE_SECRET_KEY`
   while setting up and testing. Use the live secret key (`sk_live_...`) only
   when you are ready to accept live payments.
3. **Developers → Webhooks → Add endpoint:**
   `https://yourdomain.com/api/webhooks/stripe`. Subscribe to
   `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`,
   `invoice.payment_failed` and `invoice.paid`.
4. Copy the endpoint signing secret (`whsec_...`) into
   `STRIPE_WEBHOOK_SECRET`. Test and live webhook endpoints have different
   signing secrets; use the one matching the API key mode.

For local setup, copy `.env.example` to `.env` and fill in the Stripe values.
The helper `npx tsx scripts/setup-stripe.ts` can create or reuse the LeadFlow
Pro product and its $197/month recurring Price in the Stripe account selected
by `STRIPE_SECRET_KEY`, then prints the Price ID to save as `STRIPE_PRICE_ID`.
For webhook testing on localhost, use Stripe CLI forwarding to
`http://localhost:3000/api/webhooks/stripe` and put the CLI-provided signing
secret in `STRIPE_WEBHOOK_SECRET`.

Promotion codes are enabled at checkout; create coupons in the Stripe Dashboard.

Displayed prices and plan quotas are currently defined in code —
`src/pages/Settings.tsx` for the pricing cards and `api/lib/billing.ts` for the
limits. Changing tiers means editing both.

---

## 6. Deploying to Railway

1. Provision a **MySQL** service and reference its connection string as
   `DATABASE_URL=${{MySQL.MYSQL_URL}}`.
2. Set `NODE_ENV=production`, a strong `APP_SECRET`, and
   `PUBLIC_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}`.
3. Make sure the generated domain's **target port matches the port the app
   listens on**. The app honours Railway's injected `PORT` (8080 by default),
   so either leave the domain to that port or pin both to the same value.
   A mismatch shows up as a 502 with the app itself reporting healthy.
4. Deploy. Migrations run automatically: `npm start` triggers the `prestart`
   script, which applies any pending migrations and aborts the boot if they
   fail. No platform-specific config file is required.

The scheduler (overdue tasks, stale leads, unanswered conversations) runs
in-process on a five-minute cron. Run a **single instance**; multiple replicas
would duplicate time-based automation runs.

---

## 7. Notes

- `db/repair.ts` is a legacy one-off patch script for a database that predates
  migrations. It cannot create the schema. Use `npm run db:migrate`.
- There is currently no automated test suite; `npm test` passes vacuously.
