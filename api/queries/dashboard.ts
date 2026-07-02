import { getDb } from "./connection";
import { leads, conversations, calls, tasks, appointments, activities, subscriptions, organizations } from "@db/schema";
import { eq, and, gte, desc, count, sql } from "drizzle-orm";

export async function getDashboardStats(organizationId: number) {
  // Lead stats
  const totalLeads = await getDb()
    .select({ count: count() })
    .from(leads)
    .where(eq(leads.organizationId, organizationId));

  const newLeads = await getDb()
    .select({ count: count() })
    .from(leads)
    .where(and(eq(leads.organizationId, organizationId), eq(leads.status, "new")));

  // Conversation stats
  const totalConversations = await getDb()
    .select({ count: count() })
    .from(conversations)
    .where(eq(conversations.organizationId, organizationId));

  const openConversations = await getDb()
    .select({ count: count() })
    .from(conversations)
    .where(and(eq(conversations.organizationId, organizationId), eq(conversations.status, "open")));

  // Call stats
  const totalCalls = await getDb()
    .select({ count: count() })
    .from(calls)
    .where(eq(calls.organizationId, organizationId));

  const completedCalls = await getDb()
    .select({ count: count() })
    .from(calls)
    .where(and(eq(calls.organizationId, organizationId), eq(calls.status, "completed")));

  // Task stats
  const pendingTasks = await getDb()
    .select({ count: count() })
    .from(tasks)
    .where(and(eq(tasks.organizationId, organizationId), eq(tasks.status, "pending")));

  // Upcoming appointments
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const upcomingAppointments = await getDb()
    .select({ count: count() })
    .from(appointments)
    .where(and(
      eq(appointments.organizationId, organizationId),
      gte(appointments.startTime, now),
      lteSql(appointments.startTime, tomorrow)
    ));

  // Conversion rate (won / total * 100)
  const wonLeads = await getDb()
    .select({ count: count() })
    .from(leads)
    .where(and(eq(leads.organizationId, organizationId), eq(leads.status, "won")));

  const conversionRate = totalLeads[0].count > 0
    ? Math.round((wonLeads[0].count / totalLeads[0].count) * 100)
    : 0;

  // Total pipeline value
  const pipelineValue = await getDb()
    .select({ sum: sql<number>`COALESCE(SUM(${leads.estimatedValue}), 0)` })
    .from(leads)
    .where(eq(leads.organizationId, organizationId));

  // Fetch subscription
  const subList = await getDb()
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.organizationId, organizationId))
    .limit(1);
  const subscription = subList[0] ?? null;

  // Fetch organization config
  const orgList = await getDb()
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  const organization = orgList[0] ?? null;

  return {
    totalLeads: totalLeads[0].count,
    newLeads: newLeads[0].count,
    totalConversations: totalConversations[0].count,
    openConversations: openConversations[0].count,
    totalCalls: totalCalls[0].count,
    completedCalls: completedCalls[0].count,
    pendingTasks: pendingTasks[0].count,
    upcomingAppointments: upcomingAppointments[0].count,
    conversionRate,
    pipelineValue: pipelineValue[0].sum,
    subscription,
    organization,
  };
}

// Helper for <= comparison
function lteSql(column: unknown, value: unknown) {
  return sql`${column} <= ${value}`;
}

export async function getRecentActivity(organizationId: number, limit = 10) {
  return getDb().query.activities.findMany({
    where: eq(activities.organizationId, organizationId),
    orderBy: [desc(activities.createdAt)],
    limit,
  });
}

export async function getUpcomingTasks(organizationId: number, limit = 5) {
  return getDb().query.tasks.findMany({
    where: and(
      eq(tasks.organizationId, organizationId),
      eq(tasks.status, "pending")
    ),
    with: {
      customer: true,
      lead: true,
    },
    orderBy: [
      desc(sql`FIELD(${tasks.priority}, 'low', 'medium', 'high', 'urgent')`),
      tasks.dueDate,
    ],
    limit,
  });
}

export async function getUpcomingAppointments(organizationId: number, limit = 5) {
  const now = new Date();
  return getDb().query.appointments.findMany({
    where: and(
      eq(appointments.organizationId, organizationId),
      gte(appointments.startTime, now),
      eq(appointments.status, "scheduled")
    ),
    with: {
      customer: true,
    },
    orderBy: [appointments.startTime],
    limit,
  });
}
