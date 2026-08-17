import { eq, count, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { getDb } from "../queries/connection";
import { subscriptions, leads, organizationMembers } from "@db/schema";

export const PLAN_PRICES = {
  starter: process.env.STRIPE_PRICE_STARTER || "price_mock_starter",
  professional: process.env.STRIPE_PRICE_PRO || "price_mock_pro",
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE || "price_mock_enterprise",
} as const;

export type PlanId = keyof typeof PLAN_PRICES;

export function planFromPriceId(priceId: string | null | undefined): PlanId | null {
  if (!priceId) return null;
  const entry = (Object.entries(PLAN_PRICES) as [PlanId, string][]).find(([, id]) => id === priceId);
  return entry ? entry[0] : null;
}

// The single source of truth for what each plan promises — matches the pricing
// copy on the Billing tab (src/pages/Settings.tsx) exactly: Starter "100 Call
// Minutes / 100 Leads / 5 Team Members", Professional "1,000 / 1,000 / 20",
// Enterprise "5,000 / 10,000 / Unlimited Team". Every place that creates or
// upgrades a subscription reads from here — before this, leadsLimit/
// minutesIncluded were sourced from here but usersLimit was hardcoded
// separately in three different places (2, 2, and 5), none of which matched
// what the pricing page actually promises.
export const PLAN_LIMITS: Record<PlanId, { leadsLimit: number; minutesIncluded: number; usersLimit: number }> = {
  starter: { leadsLimit: 100, minutesIncluded: 100, usersLimit: 5 },
  professional: { leadsLimit: 1000, minutesIncluded: 1000, usersLimit: 20 },
  // The pricing page promises "Unlimited Team" for Enterprise. usersLimit is a
  // plain non-nullable int column, so there's no literal "no limit" value to
  // store — a large sentinel that's unreachable in practice reads the same as
  // unlimited without a special-cased "is this unlimited?" branch anywhere
  // that consumes it.
  enterprise: { leadsLimit: 10000, minutesIncluded: 5000, usersLimit: 999999 },
};

export async function getOrgSubscription(organizationId: number) {
  return getDb().query.subscriptions.findFirst({ where: eq(subscriptions.organizationId, organizationId) });
}

// The one place usage is computed — billingRouter.getUsage (what the Billing
// tab renders) and the enforcement checks below both call this, so the number
// a user sees and the number that blocks them can never drift apart.
export async function getUsageSnapshot(organizationId: number) {
  const db = getDb();

  const [leadsRes] = await db.select({ count: count() }).from(leads).where(eq(leads.organizationId, organizationId));
  const [usersRes] = await db
    .select({ count: count() })
    .from(organizationMembers)
    .where(eq(organizationMembers.organizationId, organizationId));
  const sub = await getOrgSubscription(organizationId);
  const limits = PLAN_LIMITS[(sub?.plan as PlanId) ?? "starter"];

  return {
    leadsUsed: leadsRes?.count ?? 0,
    leadsLimit: sub?.leadsLimit ?? limits.leadsLimit,
    usersUsed: usersRes?.count ?? 1,
    usersLimit: sub?.usersLimit ?? limits.usersLimit,
    minutesUsed: sub?.minutesUsed ?? 0,
    minutesLimit: sub?.minutesIncluded ?? limits.minutesIncluded,
    plan: sub?.plan ?? "starter",
    status: sub?.status ?? "active",
    discountSummary: sub?.discountSummary ?? null,
    discountEndsAt: sub?.discountEndsAt ?? null,
  };
}

// These three gate the exact fields the Billing tab already displays via
// getUsageSnapshot — until now those numbers were tracked and shown but never
// actually enforced. The pricing page states fixed per-plan caps ("100
// Leads", "5 Team Members", "100 Call Minutes") with no "up to" or "soft
// limit" language, so the promised behavior is a hard block at the cap, not a
// warn-and-allow — consistent with how every other plan-gated action in this
// app already fails closed (e.g. billing/checkout refusing to grant paid
// entitlements without a real Stripe configuration).
export async function assertLeadsLimitNotExceeded(organizationId: number) {
  const usage = await getUsageSnapshot(organizationId);
  if (usage.leadsUsed >= usage.leadsLimit) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `You've reached your plan's lead limit (${usage.leadsUsed}/${usage.leadsLimit}). Upgrade to add more.`,
    });
  }
}

export async function assertUsersLimitNotExceeded(organizationId: number) {
  const usage = await getUsageSnapshot(organizationId);
  if (usage.usersUsed >= usage.usersLimit) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `You've reached your plan's team member limit (${usage.usersUsed}/${usage.usersLimit}). Upgrade to add more.`,
    });
  }
}

export async function assertMinutesNotExceeded(organizationId: number) {
  const usage = await getUsageSnapshot(organizationId);
  if (usage.minutesUsed >= usage.minutesLimit) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `You've reached your plan's call minutes limit (${usage.minutesUsed}/${usage.minutesLimit}). Upgrade to add more.`,
    });
  }
}

// Twilio's CallDuration/status-callback duration is in whole seconds; billed
// minutes round up so a 1-second call still consumes 1 minute, matching how
// Twilio itself bills voice minutes.
export async function recordCallMinutesUsed(organizationId: number, durationSeconds: number) {
  if (durationSeconds <= 0) return;
  const minutes = Math.ceil(durationSeconds / 60);
  await getDb()
    .update(subscriptions)
    .set({ minutesUsed: sql`${subscriptions.minutesUsed} + ${minutes}` })
    .where(eq(subscriptions.organizationId, organizationId));
}
