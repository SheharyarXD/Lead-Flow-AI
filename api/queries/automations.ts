import { getDb } from "./connection";
import { automations } from "@db/schema";
import { eq, and, desc, count } from "drizzle-orm";

export async function findAutomationsByOrganization(organizationId: number, filters?: {
  status?: string;
  trigger?: string;
  limit?: number;
  offset?: number;
}) {
  const conditions = [eq(automations.organizationId, organizationId)];

  if (filters?.status) conditions.push(eq(automations.status, filters.status as never));
  if (filters?.trigger) conditions.push(eq(automations.trigger, filters.trigger as never));

  const limit = filters?.limit ?? 50;
  const offset = filters?.offset ?? 0;

  return getDb().query.automations.findMany({
    where: and(...conditions),
    orderBy: [desc(automations.createdAt)],
    limit,
    offset,
  });
}

export async function findAutomationById(id: number) {
  return getDb().query.automations.findFirst({
    where: eq(automations.id, id),
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createAutomation(data: any) {
  const [result] = await getDb().insert(automations).values(data).$returningId();
  return findAutomationById(result.id);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateAutomation(id: number, data: any) {
  await getDb().update(automations).set({ ...data, updatedAt: new Date() }).where(eq(automations.id, id));
  return findAutomationById(id);
}

export async function deleteAutomation(id: number) {
  await getDb().delete(automations).where(eq(automations.id, id));
}

export async function getAutomationStats(organizationId: number) {
  const total = await getDb()
    .select({ count: count() })
    .from(automations)
    .where(eq(automations.organizationId, organizationId));

  const active = await getDb()
    .select({ count: count() })
    .from(automations)
    .where(and(eq(automations.organizationId, organizationId), eq(automations.status, "active")));

  return {
    total: total[0].count,
    active: active[0].count,
  };
}
