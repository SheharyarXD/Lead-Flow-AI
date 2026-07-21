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

export const PLAN_LIMITS: Record<PlanId, { leadsLimit: number; minutesIncluded: number }> = {
  starter: { leadsLimit: 100, minutesIncluded: 100 },
  professional: { leadsLimit: 1000, minutesIncluded: 1000 },
  enterprise: { leadsLimit: 10000, minutesIncluded: 5000 },
};
