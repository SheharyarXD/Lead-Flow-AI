import { getDb } from "./connection";
import { knowledgeBase } from "@db/schema";
import { eq, and, desc } from "drizzle-orm";
import type { InferInsertModel } from "drizzle-orm";

export async function findKBEntriesByOrganization(organizationId: number, filters?: {
  type?: string;
  category?: string;
  limit?: number;
  offset?: number;
}) {
  const conditions = [eq(knowledgeBase.organizationId, organizationId)];

  if (filters?.type) conditions.push(eq(knowledgeBase.type, filters.type as typeof knowledgeBase.$inferSelect.type));
  if (filters?.category) conditions.push(eq(knowledgeBase.category, filters.category));

  const limit = filters?.limit ?? 50;
  const offset = filters?.offset ?? 0;

  return getDb().query.knowledgeBase.findMany({
    where: and(...conditions),
    orderBy: [desc(knowledgeBase.updatedAt)],
    limit,
    offset,
  });
}

export async function findKBEntryById(id: number) {
  return getDb().query.knowledgeBase.findFirst({
    where: eq(knowledgeBase.id, id),
  });
}

export async function createKBEntry(data: InferInsertModel<typeof knowledgeBase>) {
  const [result] = await getDb().insert(knowledgeBase).values(data).$returningId();
  return findKBEntryById(result.id);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateKBEntry(id: number, data: any) {
  await getDb().update(knowledgeBase).set({ ...data, updatedAt: new Date() }).where(eq(knowledgeBase.id, id));
  return findKBEntryById(id);
}

export async function deleteKBEntry(id: number) {
  await getDb().delete(knowledgeBase).where(eq(knowledgeBase.id, id));
}
