import { getDb } from "./connection";
import { customers, appointments } from "@db/schema";
import { eq, and, desc, like, or, count, sql, gte } from "drizzle-orm";
import type { InferInsertModel } from "drizzle-orm";

export async function findCustomersByOrganization(organizationId: number, filters?: {
  status?: string;
  tag?: string;
  startDate?: Date;
  endDate?: Date;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const conditions = [eq(customers.organizationId, organizationId)];

  if (filters?.status) conditions.push(eq(customers.status, filters.status as never));
  if (filters?.tag) {
    conditions.push(sql`JSON_CONTAINS(${customers.tags}, JSON_QUOTE(${filters.tag}))`);
  }
  if (filters?.startDate) {
    conditions.push(gte(customers.createdAt, filters.startDate));
  }
  if (filters?.endDate) {
    conditions.push(sql`${customers.createdAt} <= ${filters.endDate}`);
  }
  if (filters?.search) {
    const search = `%${filters.search}%`;
    conditions.push(
      or(
        like(customers.firstName, search),
        like(customers.lastName, search),
        like(customers.email, search),
        like(customers.phone, search)
      )!
    );
  }

  const limit = filters?.limit ?? 50;
  const offset = filters?.offset ?? 0;

  return getDb().query.customers.findMany({
    where: and(...conditions),
    orderBy: [desc(customers.createdAt)],
    limit,
    offset,
  });
}

export async function findCustomerById(id: number) {
  return getDb().query.customers.findFirst({
    where: eq(customers.id, id),
    with: {
      leads: true,
      conversations: {
        orderBy: [desc(customers.createdAt)],
      },
      calls: {
        orderBy: [desc(customers.createdAt)],
      },
      tasks: {
        orderBy: [desc(customers.createdAt)],
      },
      appointments: {
        orderBy: [desc(appointments.startTime)],
      },
    },
  });
}

export async function createCustomer(data: InferInsertModel<typeof customers>) {
  const [result] = await getDb().insert(customers).values(data).$returningId();
  return findCustomerById(result.id);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateCustomer(id: number, organizationId: number, data: any) {
  await getDb()
    .update(customers)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(customers.id, id), eq(customers.organizationId, organizationId)));
  return findCustomerById(id);
}

export async function deleteCustomer(id: number, organizationId: number) {
  await getDb().delete(customers).where(and(eq(customers.id, id), eq(customers.organizationId, organizationId)));
}

export async function countCustomersByOrganization(organizationId: number) {
  const result = await getDb()
    .select({ count: count() })
    .from(customers)
    .where(eq(customers.organizationId, organizationId));
  return result[0].count;
}
