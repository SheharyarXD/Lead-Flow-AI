import { getDb } from "./connection";
import { calls } from "@db/schema";
import { eq, and, or, desc, count, sql, like, gte, lte } from "drizzle-orm";
import type { InferInsertModel } from "drizzle-orm";

export async function findCallsByOrganization(organizationId: number, filters?: {
  status?: string;
  direction?: string;
  customerId?: number;
  assignedTo?: number;
  aiHandled?: boolean;
  search?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}) {
  const conditions = [eq(calls.organizationId, organizationId)];

  if (filters?.status) conditions.push(eq(calls.status, filters.status as never));
  if (filters?.direction) conditions.push(eq(calls.direction, filters.direction as never));
  if (filters?.customerId) conditions.push(eq(calls.customerId, filters.customerId));
  if (filters?.assignedTo) conditions.push(eq(calls.userId, filters.assignedTo));
  if (filters?.aiHandled !== undefined) conditions.push(eq(calls.aiHandled, filters.aiHandled));
  if (filters?.startDate) conditions.push(gte(calls.createdAt, filters.startDate));
  if (filters?.endDate) conditions.push(lte(calls.createdAt, filters.endDate));
  if (filters?.search) {
    const search = `%${filters.search}%`;
    conditions.push(or(like(calls.phoneNumber, search), like(calls.aiSummary, search), like(calls.notes, search))!);
  }

  const limit = filters?.limit ?? 50;
  const offset = filters?.offset ?? 0;

  return getDb().query.calls.findMany({
    where: and(...conditions),
    with: {
      customer: true,
      lead: true,
      assignedUser: true,
    },
    orderBy: [desc(calls.createdAt)],
    limit,
    offset,
  });
}

export async function findCallById(id: number) {
  return getDb().query.calls.findFirst({
    where: eq(calls.id, id),
    with: {
      customer: true,
      lead: true,
      assignedUser: true,
    },
  });
}

export async function findCallByTwilioSid(twilioCallSid: string) {
  return getDb().query.calls.findFirst({
    where: eq(calls.twilioCallSid, twilioCallSid),
  });
}

export async function createCall(data: InferInsertModel<typeof calls>) {
  const [result] = await getDb().insert(calls).values(data).$returningId();
  return findCallById(result.id);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateCall(id: number, organizationId: number, data: any) {
  await getDb().update(calls).set(data).where(and(eq(calls.id, id), eq(calls.organizationId, organizationId)));
  return findCallById(id);
}

export async function getCallStats(organizationId: number) {
  const total = await getDb()
    .select({ count: count() })
    .from(calls)
    .where(eq(calls.organizationId, organizationId));

  const completed = await getDb()
    .select({ count: count() })
    .from(calls)
    .where(and(eq(calls.organizationId, organizationId), eq(calls.status, "completed")));

  const missed = await getDb()
    .select({ count: count() })
    .from(calls)
    .where(and(eq(calls.organizationId, organizationId), eq(calls.status, "missed")));

  const avgDuration = await getDb()
    .select({ avg: sql<number>`COALESCE(AVG(${calls.duration}), 0)` })
    .from(calls)
    .where(and(eq(calls.organizationId, organizationId), eq(calls.status, "completed")));

  const totalDuration = await getDb()
    .select({ sum: sql<number>`COALESCE(SUM(${calls.duration}), 0)` })
    .from(calls)
    .where(eq(calls.organizationId, organizationId));

  const aiHandled = await getDb()
    .select({ count: count() })
    .from(calls)
    .where(and(eq(calls.organizationId, organizationId), eq(calls.aiHandled, true)));

  return {
    total: total[0].count,
    completed: completed[0].count,
    missed: missed[0].count,
    avgDuration: Math.round(avgDuration[0].avg),
    totalDuration: totalDuration[0].sum,
    aiHandled: aiHandled[0].count,
  };
}
