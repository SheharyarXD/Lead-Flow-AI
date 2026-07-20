import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { eq, count } from "drizzle-orm";
import { subscriptions, leads, organizationMembers } from "@db/schema";
import { getDb } from "./queries/connection";
import {
  requireOnboardedOrganizationMembership as requireOrganizationMembership,
  requireOnboardedOrganizationRole as requireOrganizationRole,
} from "./queries/organizations";
import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey, { apiVersion: "2025-02-24.acacia" as any }) : null;

const PLAN_PRICES = {
  starter: process.env.STRIPE_PRICE_STARTER || "price_mock_starter",
  professional: process.env.STRIPE_PRICE_PRO || "price_mock_pro",
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE || "price_mock_enterprise",
};

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
        });

        return { url: session.url, simulated: false };
      }

      // Simulated Stripe checkout fallback when secret key is not set
      const simulatedUrl = `${hostUrl}/settings?tab=billing&checkout=success&simulated_plan=${input.plan}`;
      
      // Upgrade local sub in simulation mode
      await db
        .update(subscriptions)
        .set({
          plan: input.plan,
          status: "active",
          leadsLimit: input.plan === "enterprise" ? 10000 : input.plan === "professional" ? 1000 : 100,
          minutesIncluded: input.plan === "enterprise" ? 5000 : input.plan === "professional" ? 1000 : 100,
        })
        .where(eq(subscriptions.organizationId, input.organizationId));

      return { url: simulatedUrl, simulated: true };
    }),
});
