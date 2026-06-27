import { getDb } from "./connection";
import { activities } from "@db/schema";
import { eq, and, desc } from "drizzle-orm";

export async function findActivitiesByOrganization(organizationId: number, filters?: {
  entityType?: string;
  entityId?: number;
  limit?: number;
  offset?: number;
}) {
  const conditions = [eq(activities.organizationId, organizationId)];

  if (filters?.entityType) conditions.push(eq(activities.entityType, filters.entityType as typeof activities.$inferSelect.entityType));
  if (filters?.entityId) conditions.push(eq(activities.entityId, filters.entityId));

  const limit = filters?.limit ?? 50;
  const offset = filters?.offset ?? 0;

  return getDb().query.activities.findMany({
    where: and(...conditions),
    orderBy: [desc(activities.createdAt)],
    limit,
    offset,
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createActivity(data: any) {
  const [result] = await getDb().insert(activities).values(data).$returningId();
  return getDb().query.activities.findFirst({
    where: eq(activities.id, result.id),
  });
}

export async function getRecentActivities(organizationId: number, limit = 20) {
  return getDb().query.activities.findMany({
    where: eq(activities.organizationId, organizationId),
    orderBy: [desc(activities.createdAt)],
    limit,
  });
}
