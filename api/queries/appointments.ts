import { getDb } from "./connection";
import { appointments } from "@db/schema";
import { eq, and, gte, lte, count } from "drizzle-orm";
import type { InferInsertModel } from "drizzle-orm";

export async function findAppointmentsByOrganization(organizationId: number, filters?: {
  startDate?: Date;
  endDate?: Date;
  status?: string;
  customerId?: number;
  assignedTo?: number;
  limit?: number;
  offset?: number;
}) {
  const conditions = [eq(appointments.organizationId, organizationId)];

  if (filters?.startDate) conditions.push(gte(appointments.startTime, filters.startDate));
  if (filters?.endDate) conditions.push(lte(appointments.endTime, filters.endDate));
  if (filters?.status) conditions.push(eq(appointments.status, filters.status as never));
  if (filters?.customerId) conditions.push(eq(appointments.customerId, filters.customerId));
  if (filters?.assignedTo) conditions.push(eq(appointments.assignedTo, filters.assignedTo));

  const limit = filters?.limit ?? 100;
  const offset = filters?.offset ?? 0;

  return getDb().query.appointments.findMany({
    where: and(...conditions),
    with: {
      customer: true,
      lead: true,
      assignedUser: true,
    },
    orderBy: [appointments.startTime],
    limit,
    offset,
  });
}

export async function findAppointmentById(id: number) {
  return getDb().query.appointments.findFirst({
    where: eq(appointments.id, id),
    with: {
      customer: true,
      lead: true,
      assignedUser: true,
    },
  });
}

export async function createAppointment(data: InferInsertModel<typeof appointments>) {
  const [result] = await getDb().insert(appointments).values(data).$returningId();
  return findAppointmentById(result.id);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateAppointment(id: number, organizationId: number, data: any) {
  await getDb()
    .update(appointments)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(appointments.id, id), eq(appointments.organizationId, organizationId)));
  return findAppointmentById(id);
}

export async function deleteAppointment(id: number, organizationId: number) {
  await getDb().delete(appointments).where(and(eq(appointments.id, id), eq(appointments.organizationId, organizationId)));
}

export async function getAppointmentStats(organizationId: number) {
  const total = await getDb()
    .select({ count: count() })
    .from(appointments)
    .where(eq(appointments.organizationId, organizationId));

  const upcoming = await getDb()
    .select({ count: count() })
    .from(appointments)
    .where(and(
      eq(appointments.organizationId, organizationId),
      gte(appointments.startTime, new Date()),
      eq(appointments.status, "scheduled")
    ));

  return {
    total: total[0].count,
    upcoming: upcoming[0].count,
  };
}
