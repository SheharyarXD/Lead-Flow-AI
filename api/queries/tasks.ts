import { getDb } from "./connection";
import { tasks } from "@db/schema";
import { eq, and, desc, count, lte } from "drizzle-orm";
import type { InferInsertModel } from "drizzle-orm";

export async function findTasksByOrganization(organizationId: number, filters?: {
  status?: string;
  priority?: string;
  assignedTo?: number;
  customerId?: number;
  leadId?: number;
  dueBefore?: Date;
  limit?: number;
  offset?: number;
}) {
  const conditions = [eq(tasks.organizationId, organizationId)];

  if (filters?.status) conditions.push(eq(tasks.status, filters.status as never));
  if (filters?.priority) conditions.push(eq(tasks.priority, filters.priority as never));
  if (filters?.assignedTo) conditions.push(eq(tasks.assignedTo, filters.assignedTo));
  if (filters?.customerId) conditions.push(eq(tasks.customerId, filters.customerId));
  if (filters?.leadId) conditions.push(eq(tasks.leadId, filters.leadId));
  if (filters?.dueBefore) conditions.push(lte(tasks.dueDate, filters.dueBefore));

  const limit = filters?.limit ?? 50;
  const offset = filters?.offset ?? 0;

  return getDb().query.tasks.findMany({
    where: and(...conditions),
    with: {
      customer: true,
      lead: true,
      assignedUser: true,
    },
    orderBy: [desc(tasks.createdAt)],
    limit,
    offset,
  });
}

export async function findTaskById(id: number) {
  return getDb().query.tasks.findFirst({
    where: eq(tasks.id, id),
    with: {
      customer: true,
      lead: true,
      assignedUser: true,
    },
  });
}

export async function createTask(data: InferInsertModel<typeof tasks>) {
  const [result] = await getDb().insert(tasks).values(data).$returningId();
  return findTaskById(result.id);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateTask(id: number, organizationId: number, data: any) {
  const patch = { ...data };
  if (patch.status === "completed" && !patch.completedAt) {
    patch.completedAt = new Date();
  }
  await getDb()
    .update(tasks)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(tasks.id, id), eq(tasks.organizationId, organizationId)));
  return findTaskById(id);
}

export async function deleteTask(id: number, organizationId: number) {
  await getDb().delete(tasks).where(and(eq(tasks.id, id), eq(tasks.organizationId, organizationId)));
}

export async function getTaskStats(organizationId: number) {
  const now = new Date();

  const total = await getDb()
    .select({ count: count() })
    .from(tasks)
    .where(eq(tasks.organizationId, organizationId));

  const pending = await getDb()
    .select({ count: count() })
    .from(tasks)
    .where(and(eq(tasks.organizationId, organizationId), eq(tasks.status, "pending")));

  const overdue = await getDb()
    .select({ count: count() })
    .from(tasks)
    .where(and(
      eq(tasks.organizationId, organizationId),
      eq(tasks.status, "pending"),
      lte(tasks.dueDate, now)
    ));

  const completed = await getDb()
    .select({ count: count() })
    .from(tasks)
    .where(and(eq(tasks.organizationId, organizationId), eq(tasks.status, "completed")));

  return {
    total: total[0].count,
    pending: pending[0].count,
    overdue: overdue[0].count,
    completed: completed[0].count,
  };
}
