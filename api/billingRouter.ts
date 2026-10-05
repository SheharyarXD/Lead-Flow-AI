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
import {
  PLAN_PRICES,
  PLAN_LIMITS,
  PRODUCT_NAME,
  TRIAL_DAYS,
  getUsageSnapshot,
} from "./lib/billing";
import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, { apiVersion: "2025-02-24.acacia" as any })
  : null;

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
        // Create initial pending/incomplete subscription record
        const proLimits = PLAN_LIMITS.professional;
        await db.insert(subscriptions).values({
          organizationId: input.organizationId,
          plan: "professional",
          status: "incomplete",
          minutesIncluded: proLimits.minutesIncluded,
          minutesUsed: 0,
          leadsLimit: proLimits.leadsLimit,
          usersLimit: proLimits.usersLimit,
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
        plan: z.enum(["starter", "professional", "enterprise"]).default("professional"),
        originUrl: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireOrganizationRole(ctx.user.id, input.organizationId, ["owner", "admin"]);
      const db = getDb();

      const hostUrl = input.originUrl || process.env.PUBLIC_URL || "http://localhost:3000";
      const priceId = PLAN_PRICES[input.plan];

      if (stripe && stripeSecretKey && (!priceId || priceId.startsWith("price_mock_"))) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `No live Stripe price is configured for ${input.plan === "professional" ? PRODUCT_NAME : input.plan}. Set STRIPE_PRICE_ID or STRIPE_PRICE_PRO.`,
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
            name: ctx.user.name || undefined,
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

        // Only grant the 30-day free trial if the organization has not already completed a trial
        const alreadyHadTrial = sub?.trialEndsAt != null && new Date(sub.trialEndsAt) < new Date();
        const trialDays = alreadyHadTrial ? undefined : TRIAL_DAYS;

        const session = await stripe.checkout.sessions.create({
          mode: "subscription",
          customer: customerId,
          line_items: [{ price: priceId, quantity: 1 }],
          allow_promotion_codes: true,
          success_url: `${hostUrl}/settings?tab=billing&checkout=success&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${hostUrl}/settings?tab=billing&checkout=cancelled`,
          metadata: {
            organizationId: String(input.organizationId),
            plan: input.plan,
          },
          subscription_data: {
            ...(trialDays ? { trial_period_days: trialDays } : {}),
            metadata: {
              organizationId: String(input.organizationId),
              plan: input.plan,
            },
          },
        });

        return { url: session.url, simulated: false };
      }

      // No live Stripe configuration: refuse to grant free access in production
      if (env.isProduction) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Billing is not configured. Set STRIPE_SECRET_KEY and STRIPE_PRICE_ID in environment variables.",
        });
      }

      // Simulated local test mode for development
      const simulatedUrl = `${hostUrl}/settings?tab=billing&checkout=success&simulated_plan=${input.plan}`;
      const now = new Date();
      const trialEnd = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

      await db
        .update(subscriptions)
        .set({
          plan: input.plan,
          status: "trialing",
          trialEndsAt: trialEnd,
          currentPeriodStart: now,
          currentPeriodEnd: trialEnd,
          cancelAtPeriodEnd: false,
          ...PLAN_LIMITS[input.plan],
        })
        .where(eq(subscriptions.organizationId, input.organizationId));

      return { url: simulatedUrl, simulated: true };
    }),

  submitCancellationSurveyAndCancel: authedQuery
    .input(
      z.object({
        organizationId: z.number(),
        reason: z.enum([
          "too_expensive",
          "not_enough_value",
          "missing_feature",
          "too_difficult",
          "business_circumstances_changed",
          "not_enough_leads",
          "technical_problems",
          "other",
        ]),
        reasonDetails: z.string().optional(),
        whatCouldBeBetter: z.string().optional(),
        missingFeatureExpected: z.string().optional(),
        likelihoodToReturn: z
          .enum(["very_likely", "likely", "neutral", "unlikely", "very_unlikely"])
          .optional(),
        additionalComments: z.string().optional(),
        cancelImmediately: z.boolean().default(false),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireOrganizationRole(ctx.user.id, input.organizationId, ["owner", "admin"]);
      const db = getDb();

      const sub = await db.query.subscriptions.findFirst({
        where: eq(subscriptions.organizationId, input.organizationId),
      });

      if (!sub) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Subscription not found" });
      }

      // 1. Store cancellation survey responses for analytics/client insight
      await db.insert(cancellationSurveys).values({
        organizationId: input.organizationId,
        userId: ctx.user.id,
        stripeSubscriptionId: sub.stripeSubscriptionId,
        stripeCustomerId: sub.stripeCustomerId,
        reason: input.reason,
        reasonDetails: input.reasonDetails,
        whatCouldBeBetter: input.whatCouldBeBetter,
        missingFeatureExpected: input.missingFeatureExpected,
        likelihoodToReturn: input.likelihoodToReturn,
        additionalComments: input.additionalComments,
      });

      // 2. Cancel via Stripe API if live subscription exists
      if (stripe && stripeSecretKey && sub.stripeSubscriptionId) {
        if (input.cancelImmediately) {
          await stripe.subscriptions.cancel(sub.stripeSubscriptionId);
          await db
            .update(subscriptions)
            .set({
              status: "cancelled",
              cancelAtPeriodEnd: false,
              cancellationReason: input.reason,
              cancelledAt: new Date(),
            })
            .where(eq(subscriptions.id, sub.id));
        } else {
          await stripe.subscriptions.update(sub.stripeSubscriptionId, {
            cancel_at_period_end: true,
          });
          await db
            .update(subscriptions)
            .set({
              cancelAtPeriodEnd: true,
              cancellationReason: input.reason,
              cancelledAt: new Date(),
            })
            .where(eq(subscriptions.id, sub.id));
        }

        return {
          success: true,
          cancelAtPeriodEnd: !input.cancelImmediately,
          message: input.cancelImmediately
            ? "Your subscription has been cancelled immediately."
            : `Your cancellation request was processed. Your subscription will not renew after ${
                sub.currentPeriodEnd
                  ? new Date(sub.currentPeriodEnd).toLocaleDateString()
                  : "the current period"
              }.`,
        };
      }

      // 3. Fallback for test / dev environment
      await db
        .update(subscriptions)
        .set({
          status: input.cancelImmediately ? "cancelled" : sub.status,
          cancelAtPeriodEnd: !input.cancelImmediately,
          cancellationReason: input.reason,
          cancelledAt: new Date(),
        })
        .where(eq(subscriptions.id, sub.id));

      return {
        success: true,
        cancelAtPeriodEnd: !input.cancelImmediately,
        message: input.cancelImmediately
          ? "Your subscription has been cancelled immediately."
          : "Your subscription is scheduled to cancel at the end of the current period.",
      };
    }),

  resumeSubscription: authedQuery
    .input(z.object({ organizationId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await requireOrganizationRole(ctx.user.id, input.organizationId, ["owner", "admin"]);
      const db = getDb();

      const sub = await db.query.subscriptions.findFirst({
        where: eq(subscriptions.organizationId, input.organizationId),
      });

      if (!sub) throw new TRPCError({ code: "NOT_FOUND", message: "Subscription not found" });

      if (stripe && stripeSecretKey && sub.stripeSubscriptionId) {
        await stripe.subscriptions.update(sub.stripeSubscriptionId, {
          cancel_at_period_end: false,
        });
      }

      await db
        .update(subscriptions)
        .set({
          cancelAtPeriodEnd: false,
          cancellationReason: null,
          cancelledAt: null,
        })
        .where(eq(subscriptions.id, sub.id));

      return { success: true, message: "Your subscription has been resumed successfully." };
    }),

  createCustomerPortalSession: authedQuery
    .input(z.object({ organizationId: z.number(), returnUrl: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      await requireOrganizationRole(ctx.user.id, input.organizationId, ["owner", "admin"]);
      const db = getDb();

      const sub = await db.query.subscriptions.findFirst({
        where: eq(subscriptions.organizationId, input.organizationId),
      });

      if (!stripe || !stripeSecretKey || !sub?.stripeCustomerId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Stripe customer portal is not available.",
        });
      }

      const returnUrl = input.returnUrl || `${process.env.PUBLIC_URL || "http://localhost:3000"}/settings?tab=billing`;
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: sub.stripeCustomerId,
        return_url: returnUrl,
      });

      return { url: portalSession.url };
    }),
});
