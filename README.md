# LeadFlow AI — Production Setup & Deployment Guide

This repository contains the full source code for LeadFlow AI, a multi-tenant AI Receptionist SaaS platform with integrated CRM pipelines, unified inbox SMS/Email threads, Stripe subscription management, Cloud storage file attachments, and browser-based VoIP voice calling.

---

## 🛠️ Production Environment Setup

To run this application in production, duplicate `.env.example` to `.env` and configure the following keys:

```env
# Database Credentials
DATABASE_URL="mysql://username:password@hostname:3306/dbname"

# JWT Secret Key
JWT_SECRET="your-ultra-secure-jwt-secret-key"

# OpenAI Credentials
OPENAI_API_KEY="sk-proj-..."

# S3 / R2 Storage Bucket (for Lead/Customer file attachments)
S3_BUCKET="your-storage-bucket-name"
S3_REGION="us-east-1"
S3_ACCESS_KEY_ID="AKIA..."
S3_SECRET_ACCESS_KEY="..."
# Optional endpoint if using Cloudflare R2 or MinIO
S3_ENDPOINT="https://<account-id>.r2.cloudflarestorage.com"

# Twilio Credentials (for SMS & browser calling)
TWILIO_ACCOUNT_SID="AC..."
TWILIO_AUTH_TOKEN="..."
TWILIO_PHONE_NUMBER="+1..."
# Create a TwiML App in Twilio Console under Voice -> TwiML Apps
TWILIO_TWIML_APP_SID="AP..."

# Stripe Billing Credentials
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_PRICE_STARTER="price_..."
STRIPE_PRICE_PRO="price_..."
STRIPE_PRICE_ENTERPRISE="price_..."

# SMTP Email routing (for customer follow-ups)
SMTP_HOST="smtp.sendgrid.net"
SMTP_PORT=587
SMTP_USER="apikey"
SMTP_PASS="your_password"
SMTP_FROM_EMAIL="support@yourdomain.com"
```

---

## 📞 1. Twilio Voice App Setup

To enable browser-based calling:
1. Log into your **Twilio Console**.
2. Navigate to **Voice ➜ TwiML Apps** and click **Create new TwiML App**.
3. Name your app (e.g., `LeadFlow AI Production`).
4. Set the **Voice Request URL** to:
   `https://yourdomain.com/api/webhooks/voice`
   *(Must be set to POST format)*
5. Copy the generated **TwiML App SID** (starts with `AP...`) and paste it as `TWILIO_TWIML_APP_SID` in your `.env`.
6. Ensure the phone number you purchased under **Phone Numbers ➜ Active Numbers** has the **Voice** capability enabled, and configure it to point inbound calls to this TwiML App.

---

## 💳 2. Stripe Webhook Registration

To automate customer plan upgrades:
1. Log into your **Stripe Dashboard**.
2. Navigate to **Developers ➜ Webhooks** and click **Add Endpoint**.
3. Set the endpoint URL to:
   `https://yourdomain.com/api/webhooks/stripe`
4. Choose the following events to listen to:
   * `checkout.session.completed`
5. Save the endpoint and copy the **Signing Secret** (`whsec_...`). Save it as `STRIPE_WEBHOOK_SECRET` in `.env`.
6. **Promotion Codes & Discounts**: To support Stripe promotion codes during checkout, configure your discount coupons in the Stripe Dashboard. The webhook will automatically sync active subscription discounts to the local subscription records.

---

## 🚀 Local Quickstart

### **1. Install Dependencies**
```bash
npm install
```

### **2. Synchronize Database Models**
Run the database repair utility to align any missing schemas in MySQL:
```bash
npm run db:repair
```

### **3. Start Development Server**
```bash
npm run dev
```
Open `http://localhost:3000` in your web browser.
