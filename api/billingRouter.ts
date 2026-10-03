import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, authedQuery } from "./middleware";
import { eq } from "drizzle-orm";
import { subscriptions, cancellationSurveys } from "@db/schema";
import { getDb } from "./queries/connection";
import {
  requireOnboardedOrganizationMembership as requireOrganizationMembership,
  requireOnboardedOrganizationRole as requireOrganizationRole,
} from "./queries/organizations";
import { env } from "./lib/env";
import { PLAN_PRICES, PLAN_LIMITS, getUsageSnapshot } from "./lib/billing";
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
        const starterLimits = PLAN_LIMITS.starter;
        await db.insert(subscriptions).values({
          organizationId: input.organizationId,
          plan: "starter",
          status: "active",
          minutesIncluded: starterLimits.minutesIncluded,
          minutesUsed: 0,
          leadsLimit: starterLimits.leadsLimit,
          usersLimit: starterLimits.usersLimit,
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
      return getUsageSnapshot(input.organizationId);
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
          allow_promotion_codes: true,
          success_url: `${hostUrl}/settings?tab=billing&checkout=success`,
          cancel_url: `${hostUrl}/settings?tab=billing&checkout=cancelled`,
          metadata: {
            organizationId: String(input.organizationId),
            plan: input.plan,
          },
          subscription_data: {
            trial_period_days: 30,
            metadata: {
              organizationId: String(input.organizationId),
            },
          },
        });

        return { url: session.url, simulated: false };
      }

      if (env.isProduction) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Billing is not configured. Set STRIPE_SECRET_KEY to enable plan upgrades.",
        });
      }

      const simulatedUrl = `${hostUrl}/settings?tab=billing&checkout=success&simulated_plan=${input.plan}`;

      await db
        .update(subscriptions)
        .set({
          plan: input.plan,
          status: "active",
          ...PLAN_LIMITS[input.plan],
        })
        .where(eq(subscriptions.organizationId, input.organizationId));

      return { url: simulatedUrl, simulated: true };
    }),

  submitCancellationSurvey: authedQuery
    .input(
      z.object({
        organizationId: z.number(),
        reason: z.string().min(1, "Please select a cancellation reason"),
        feedback: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireOrganizationRole(ctx.user.id, input.organizationId, ["owner", "admin"]);
      const db = getDb();

      const sub = await db.query.subscriptions.findFirst({
        where: eq(subscriptions.organizationId, input.organizationId),
      });

      if (!sub) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No active subscription found for this organization.",
        });
      }

      // Record cancellation exit survey response in database
      await db.insert(cancellationSurveys).values({
        organizationId: input.organizationId,
        userId: ctx.user.id,
        reason: input.reason,
        feedback: input.feedback || "",
      });

      // Cancel Stripe subscription at period end if Stripe is active
      if (stripe && stripeSecretKey && sub.stripeSubscriptionId) {
        try {
          await stripe.subscriptions.update(sub.stripeSubscriptionId, {
            cancel_at_period_end: true,
          });
        } catch (err: any) {
          console.error("Failed to update Stripe subscription cancellation status:", err);
        }
      }

      // Update local subscription status
      await db
        .update(subscriptions)
        .set({
          cancelAtPeriodEnd: true,
          status: "cancelled",
        })
        .where(eq(subscriptions.id, sub.id));

      return { success: true, message: "Subscription cancelled successfully." };
    }),
});

