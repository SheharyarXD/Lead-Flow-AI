import { getDb } from "./connection";
import { leads } from "@db/schema";
import { eq, and, desc, like, or, sql, count } from "drizzle-orm";
import type { InferInsertModel } from "drizzle-orm";

export async function findLeadsByOrganization(organizationId: number, filters?: {
  status?: string;
  source?: string;
  priority?: string;
  assignedTo?: number;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const conditions = [eq(leads.organizationId, organizationId)];

  if (filters?.status) conditions.push(eq(leads.status, filters.status as never));
  if (filters?.source) conditions.push(eq(leads.source, filters.source as never));
  if (filters?.priority) conditions.push(eq(leads.priority, filters.priority as never));
  if (filters?.assignedTo) conditions.push(eq(leads.assignedTo, filters.assignedTo));
  if (filters?.search) {
    const search = `%${filters.search}%`;
    conditions.push(
      or(
        like(leads.firstName, search),
        like(leads.lastName, search),
        like(leads.email, search),
        like(leads.phone, search),
        like(leads.company, search)
      )!
    );
  }

  const limit = filters?.limit ?? 50;
  const offset = filters?.offset ?? 0;

  return getDb().query.leads.findMany({
    where: and(...conditions),
    with: {
      customer: true,
      assignedUser: true,
    },
    orderBy: [desc(leads.createdAt)],
    limit,
    offset,
  });
}

export async function countLeadsByOrganization(organizationId: number, filters?: {
  status?: string;
  source?: string;
  priority?: string;
  assignedTo?: number;
  search?: string;
}) {
  const conditions = [eq(leads.organizationId, organizationId)];

  if (filters?.status) conditions.push(eq(leads.status, filters.status as never));
  if (filters?.source) conditions.push(eq(leads.source, filters.source as never));
  if (filters?.priority) conditions.push(eq(leads.priority, filters.priority as never));

  const result = await getDb()
    .select({ count: count() })
    .from(leads)
    .where(and(...conditions));

  return result[0].count;
}

export async function findLeadById(id: number) {
  return getDb().query.leads.findFirst({
    where: eq(leads.id, id),
    with: {
      customer: true,
      assignedUser: true,
      conversations: true,
      tasks: true,
      calls: true,
    },
  });
}

export async function createLead(data: InferInsertModel<typeof leads>) {
  const [result] = await getDb().insert(leads).values(data).$returningId();
  return findLeadById(result.id);
}

// We use any for the update data to allow flexible partial updates from routers
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateLead(id: number, data: any) {
  await getDb().update(leads).set({ ...data, updatedAt: new Date() }).where(eq(leads.id, id));
  return findLeadById(id);
}

export async function deleteLead(id: number) {
  await getDb().delete(leads).where(eq(leads.id, id));
}

export async function getLeadStats(organizationId: number) {
  const total = await getDb()
    .select({ count: count() })
    .from(leads)
    .where(eq(leads.organizationId, organizationId));

  const newLeads = await getDb()
    .select({ count: count() })
    .from(leads)
    .where(and(eq(leads.organizationId, organizationId), eq(leads.status, "new")));

  const qualified = await getDb()
    .select({ count: count() })
    .from(leads)
    .where(and(eq(leads.organizationId, organizationId), eq(leads.status, "qualified")));

  const won = await getDb()
    .select({ count: count() })
    .from(leads)
    .where(and(eq(leads.organizationId, organizationId), eq(leads.status, "won")));

  const lost = await getDb()
    .select({ count: count() })
    .from(leads)
    .where(and(eq(leads.organizationId, organizationId), eq(leads.status, "lost")));

  const totalValue = await getDb()
    .select({ sum: sql<number>`COALESCE(SUM(${leads.estimatedValue}), 0)` })
    .from(leads)
    .where(eq(leads.organizationId, organizationId));

  return {
    total: total[0].count,
    new: newLeads[0].count,
    qualified: qualified[0].count,
    won: won[0].count,
    lost: lost[0].count,
    totalValue: totalValue[0].sum,
  };
}
