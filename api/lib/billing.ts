import { eq, count, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { getDb } from "../queries/connection";
import { subscriptions, leads, organizationMembers } from "@db/schema";

export const PRODUCT_NAME = "LeadFlow Pro";
export const PRODUCT_PRICE_USD = 197;
export const TRIAL_DAYS = 30;

export const PLAN_PRICES = {
  // LeadFlow Pro is the client's approved production subscription ($197/mo, 30-day trial)
  professional: process.env.STRIPE_PRICE_ID || process.env.STRIPE_PRICE_PRO || "price_leadflow_pro",
  // Fallbacks / legacy aliases for backwards compatibility
  starter: process.env.STRIPE_PRICE_STARTER || "price_mock_starter",
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE || "price_mock_enterprise",
} as const;

export type PlanId = keyof typeof PLAN_PRICES;

export function planFromPriceId(priceId: string | null | undefined): PlanId | null {
  if (!priceId) return null;
  const entry = (Object.entries(PLAN_PRICES) as [PlanId, string][]).find(([, id]) => id === priceId);
  return entry ? entry[0] : "professional";
}

// Single source of truth for quotas:
// LeadFlow Pro includes 1,000 call minutes, 1,000 leads, 20 team members.
export const PLAN_LIMITS: Record<PlanId, { leadsLimit: number; minutesIncluded: number; usersLimit: number }> = {
  professional: { leadsLimit: 1000, minutesIncluded: 1000, usersLimit: 20 },
  starter: { leadsLimit: 100, minutesIncluded: 100, usersLimit: 5 },
  enterprise: { leadsLimit: 10000, minutesIncluded: 5000, usersLimit: 999999 },
};

export async function getOrgSubscription(organizationId: number) {
  return getDb().query.subscriptions.findFirst({ where: eq(subscriptions.organizationId, organizationId) });
}

export async function getUsageSnapshot(organizationId: number) {
  const db = getDb();

  const [leadsRes] = await db.select({ count: count() }).from(leads).where(eq(leads.organizationId, organizationId));
  const [usersRes] = await db
    .select({ count: count() })
    .from(organizationMembers)
    .where(eq(organizationMembers.organizationId, organizationId));
  const sub = await getOrgSubscription(organizationId);
  const planKey = (sub?.plan as PlanId) ?? "professional";
  const limits = PLAN_LIMITS[planKey] ?? PLAN_LIMITS.professional;

  // Determine trial dates and remaining time
  const now = Date.now();
  const trialEnd = sub?.trialEndsAt
    ? new Date(sub.trialEndsAt).getTime()
    : sub?.status === "trialing" && sub?.currentPeriodEnd
    ? new Date(sub.currentPeriodEnd).getTime()
    : null;

  let daysRemainingInTrial = 0;
  if (trialEnd && sub?.status === "trialing") {
    daysRemainingInTrial = Math.max(0, Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24)));
  }

  const isTrialActive = sub?.status === "trialing" && (trialEnd ? trialEnd > now : true);
  const isPaidActive = sub?.status === "active";
  const hasAccess = isPaidActive || isTrialActive;

  return {
    leadsUsed: leadsRes?.count ?? 0,
    leadsLimit: sub?.leadsLimit ?? limits.leadsLimit,
    usersUsed: usersRes?.count ?? 1,
    usersLimit: sub?.usersLimit ?? limits.usersLimit,
    minutesUsed: sub?.minutesUsed ?? 0,
    minutesLimit: sub?.minutesIncluded ?? limits.minutesIncluded,
    plan: sub?.plan ?? "professional",
    planName: PRODUCT_NAME,
    status: sub?.status ?? "incomplete",
    isTrialActive,
    isPaidActive,
    hasAccess,
    daysRemainingInTrial,
    trialEndsAt: sub?.trialEndsAt ?? null,
    currentPeriodStart: sub?.currentPeriodStart ?? null,
    currentPeriodEnd: sub?.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: sub?.cancelAtPeriodEnd ?? false,
    cancelledAt: sub?.cancelledAt ?? null,
    cancellationReason: sub?.cancellationReason ?? null,
    stripeCustomerId: sub?.stripeCustomerId ?? null,
    stripeSubscriptionId: sub?.stripeSubscriptionId ?? null,
    discountSummary: sub?.discountSummary ?? null,
    discountEndsAt: sub?.discountEndsAt ?? null,
  };
}

// Payment Gating: Verifies that the tenant has an active subscription or unexpired trial
export async function assertSubscriptionActive(organizationId: number) {
  const usage = await getUsageSnapshot(organizationId);

  if (!usage.hasAccess) {
    if (usage.status === "past_due") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Your subscription payment is past due. Please update your payment method under Settings > Billing.",
      });
    }
    if (usage.status === "cancelled") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Your LeadFlow Pro subscription has been cancelled. Please re-activate under Settings > Billing.",
      });
    }
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "An active LeadFlow Pro subscription or 30-day free trial is required. Activate your trial under Settings > Billing.",
    });
  }
}

export async function assertLeadsLimitNotExceeded(organizationId: number) {
  await assertSubscriptionActive(organizationId);
  const usage = await getUsageSnapshot(organizationId);
  if (usage.leadsUsed >= usage.leadsLimit) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `You've reached your plan's lead limit (${usage.leadsUsed}/${usage.leadsLimit}).`,
    });
  }
}

export async function assertUsersLimitNotExceeded(organizationId: number) {
  await assertSubscriptionActive(organizationId);
  const usage = await getUsageSnapshot(organizationId);
  if (usage.usersUsed >= usage.usersLimit) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `You've reached your plan's team member limit (${usage.usersUsed}/${usage.usersLimit}).`,
    });
  }
}

export async function assertMinutesNotExceeded(organizationId: number) {
  await assertSubscriptionActive(organizationId);
  const usage = await getUsageSnapshot(organizationId);
  if (usage.minutesUsed >= usage.minutesLimit) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `You've reached your plan's call minutes limit (${usage.minutesUsed}/${usage.minutesLimit}).`,
    });
  }
}

export async function recordCallMinutesUsed(organizationId: number, durationSeconds: number) {
  if (durationSeconds <= 0) return;
  const minutes = Math.ceil(durationSeconds / 60);
  await getDb()
    .update(subscriptions)
    .set({ minutesUsed: sql`${subscriptions.minutesUsed} + ${minutes}` })
    .where(eq(subscriptions.organizationId, organizationId));
}

