import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, authedQuery } from "./middleware";
import { eq, count } from "drizzle-orm";
import { subscriptions, leads, organizationMembers } from "@db/schema";
import { getDb } from "./queries/connection";
import {
  requireOnboardedOrganizationMembership as requireOrganizationMembership,
  requireOnboardedOrganizationRole as requireOrganizationRole,
} from "./queries/organizations";
import { env } from "./lib/env";
import { PLAN_PRICES, PLAN_LIMITS } from "./lib/billing";
import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey, { apiVersion: "2025-02-24.acacia" as any }) : null;

export const billingRouter = createRouter({
  getSubscription: authedQuery
    .input(z.object({ organizationId: z.number() }))
    .query(async ({ input, ctx }) => {
      await requireOrganizationMembership(ctx.user.id, input.organizationId);
      const db = getDb();

      let sub = await db.query.subscriptions.findFirst({
        where: eq(subscriptions.organizationId, input.organizationId),
      });

      if (!sub) {
        // Create default starter subscription if missing
        await db.insert(subscriptions).values({
          organizationId: input.organizationId,
          plan: "starter",
          status: "active",
          minutesIncluded: 100,
          minutesUsed: 0,
          leadsLimit: 100,
          usersLimit: 5,
        });
        sub = await db.query.subscriptions.findFirst({
          where: eq(subscriptions.organizationId, input.organizationId),
        });
      }

      return sub;
    }),

  getUsage: authedQuery
    .input(z.object({ organizationId: z.number() }))
    .query(async ({ input, ctx }) => {
      await requireOrganizationMembership(ctx.user.id, input.organizationId);
      const db = getDb();

      const [leadsRes] = await db
        .select({ count: count() })
        .from(leads)
        .where(eq(leads.organizationId, input.organizationId));

      const [usersRes] = await db
        .select({ count: count() })
        .from(organizationMembers)
        .where(eq(organizationMembers.organizationId, input.organizationId));

      const sub = await db.query.subscriptions.findFirst({
        where: eq(subscriptions.organizationId, input.organizationId),
      });

      return {
        leadsUsed: leadsRes?.count ?? 0,
        leadsLimit: sub?.leadsLimit ?? 100,
        usersUsed: usersRes?.count ?? 1,
        usersLimit: sub?.usersLimit ?? 5,
        minutesUsed: sub?.minutesUsed ?? 0,
        minutesLimit: sub?.minutesIncluded ?? 100,
        plan: sub?.plan ?? "starter",
        status: sub?.status ?? "active",
      };
    }),

  createCheckoutSession: authedQuery
    .input(
      z.object({
        organizationId: z.number(),
        plan: z.enum(["starter", "professional", "enterprise"]),
        originUrl: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireOrganizationRole(ctx.user.id, input.organizationId, ["owner", "admin"]);
      const db = getDb();

      const hostUrl = input.originUrl || process.env.PUBLIC_URL || "http://localhost:3000";
      const priceId = PLAN_PRICES[input.plan];

      if (stripe && stripeSecretKey && priceId.startsWith("price_mock_")) {
        // Stripe is live but this plan's price id was never configured — sending
        // the placeholder id would fail cryptically inside Stripe's API instead
        // of here, so fail fast with a message that says what to actually fix.
        const envVar = { starter: "STRIPE_PRICE_STARTER", professional: "STRIPE_PRICE_PRO", enterprise: "STRIPE_PRICE_ENTERPRISE" }[input.plan];
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `No Stripe price is configured for the ${input.plan} plan. Set ${envVar}.`,
        });
      }

      if (stripe && stripeSecretKey) {
        let sub = await db.query.subscriptions.findFirst({
          where: eq(subscriptions.organizationId, input.organizationId),
        });

        let customerId = sub?.stripeCustomerId;
        if (!customerId) {
          const customer = await stripe.customers.create({
            email: ctx.user.email,
            metadata: { organizationId: String(input.organizationId) },
          });
          customerId = customer.id;

          if (sub) {
            await db
              .update(subscriptions)
              .set({ stripeCustomerId: customerId })
              .where(eq(subscriptions.id, sub.id));
          }
        }

        const session = await stripe.checkout.sessions.create({
          mode: "subscription",
          customer: customerId,
          line_items: [{ price: priceId, quantity: 1 }],
          success_url: `${hostUrl}/settings?tab=billing&checkout=success`,
          cancel_url: `${hostUrl}/settings?tab=billing&checkout=cancelled`,
          metadata: {
            organizationId: String(input.organizationId),
            plan: input.plan,
          },
          // Also stamped on the subscription itself so later lifecycle events
          // (subscription.updated/deleted) can resolve the tenant without
          // relying on a local stripeCustomerId/stripeSubscriptionId lookup.
          subscription_data: {
            metadata: {
              organizationId: String(input.organizationId),
            },
          },
        });

        return { url: session.url, simulated: false };
      }

      // No live Stripe configuration. This must never silently grant paid
      // entitlements — that would be a free-upgrade exploit the moment Stripe
      // keys are missing (including by accident in production). Only allow a
      // clearly-labeled simulated upgrade in non-production environments, for
      // local development and demos.
      if (env.isProduction) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Billing is not configured. Set STRIPE_SECRET_KEY to enable plan upgrades.",
        });
      }

      const simulatedUrl = `${hostUrl}/settings?tab=billing&checkout=success&simulated_plan=${input.plan}`;
      const limits = PLAN_LIMITS[input.plan];

      await db
        .update(subscriptions)
        .set({
          plan: input.plan,
          status: "active",
          leadsLimit: limits.leadsLimit,
          minutesIncluded: limits.minutesIncluded,
        })
        .where(eq(subscriptions.organizationId, input.organizationId));

      return { url: simulatedUrl, simulated: true };
    }),
});
