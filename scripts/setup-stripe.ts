/**
 * Secure Stripe Product & Price Setup Utility for LeadFlow Pro
 *
 * Requirements:
 * - Product Name: LeadFlow Pro
 * - Price: $197 USD / month
 * - Trial: 30 days completely free
 *
 * Usage:
 *   npx tsx scripts/setup-stripe.ts
 *
 * NOTE: Credentials are never hardcoded and must be provided via environment variables.
 */

import "dotenv/config";
import Stripe from "stripe";

async function main() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const publicUrl = process.env.PUBLIC_URL || "https://www.learnleadflow.com";

  console.log("=================================================");
  console.log(" LeadFlow AI — Stripe Billing Configuration Setup");
  console.log("=================================================\n");

  if (!secretKey) {
    console.log("No STRIPE_SECRET_KEY detected in current environment.\n");
    console.log("If creating manually in the Stripe Dashboard (https://dashboard.stripe.com/products):");
    console.log("--------------------------------------------------");
    console.log("1. Product Name:      LeadFlow Pro");
    console.log("2. Pricing model:     Standard pricing");
    console.log("3. Price:             $197.00 USD");
    console.log("4. Billing period:    Monthly (recurring)");
    console.log("5. Free trial:        30 days (configured in Stripe Checkout / Price)");
    console.log("--------------------------------------------------\n");
    console.log("Webhook Endpoint configuration (https://dashboard.stripe.com/webhooks):");
    console.log("--------------------------------------------------");
    console.log(`Endpoint URL:         ${publicUrl}/api/webhooks/stripe`);
    console.log("Events to listen for:");
    console.log("  - checkout.session.completed");
    console.log("  - customer.subscription.created");
    console.log("  - customer.subscription.updated");
    console.log("  - customer.subscription.deleted");
    console.log("  - invoice.payment_failed");
    console.log("  - invoice.paid");
    console.log("--------------------------------------------------\n");
    console.log("Required Railway / Production Environment Variables:");
    console.log("  STRIPE_SECRET_KEY      (from Stripe API Keys)");
    console.log("  STRIPE_WEBHOOK_SECRET  (from Stripe Webhook Signing Secret)");
    console.log("  STRIPE_PRICE_ID        (Price ID e.g. price_1Q...)");
    console.log("=================================================");
    return;
  }

  console.log("Connecting to Stripe securely using STRIPE_SECRET_KEY...");
  const stripe = new Stripe(secretKey, { apiVersion: "2025-02-24.acacia" as any });

  try {
    // 1. Search for existing LeadFlow Pro product
    const products = await stripe.products.list({ limit: 100, active: true });
    let product = products.data.find(
      (p) => p.name.toLowerCase().trim() === "leadflow pro"
    );

    if (product) {
      console.log(`Found existing product: "${product.name}" (${product.id})`);
    } else {
      console.log("Creating new Product: LeadFlow Pro...");
      product = await stripe.products.create({
        name: "LeadFlow Pro",
        description: "Autonomous AI Lead Engagement & Conversational Booking Platform",
        metadata: {
          platform: "LeadFlow AI",
          plan: "professional",
        },
      });
      console.log(`Created product: "${product.name}" (${product.id})`);
    }

    // 2. Search for existing $197/mo recurring price
    const prices = await stripe.prices.list({
      product: product.id,
      limit: 50,
      active: true,
    });

    let price = prices.data.find(
      (p) =>
        p.currency === "usd" &&
        p.unit_amount === 19700 &&
        p.recurring?.interval === "month"
    );

    if (price) {
      console.log(`Found existing recurring price: $197/mo (${price.id})`);
    } else {
      console.log("Creating recurring price: $197.00 USD / month...");
      price = await stripe.prices.create({
        product: product.id,
        unit_amount: 19700, // $197.00
        currency: "usd",
        recurring: {
          interval: "month",
        },
        metadata: {
          plan: "professional",
          trial_days: "30",
        },
      });
      console.log(`Created recurring price: $197.00/mo (${price.id})`);
    }

    console.log("\n=================================================");
    console.log("SUCCESS: Stripe Configuration Ready");
    console.log("=================================================");
    console.log(`Product Name:      ${product.name}`);
    console.log(`Product ID:        ${product.id}`);
    console.log(`Price ID:          ${price.id}`);
    console.log("Price Amount:      $197.00 USD / month");
    console.log("Free Trial:        30 days");
    console.log("\nAction Required:");
    console.log(`Set STRIPE_PRICE_ID=${price.id} in your environment variables.`);
    console.log("=================================================");
  } catch (err: any) {
    console.error("Stripe setup error:", err.message);
    process.exitCode = 1;
  }
}

main();

