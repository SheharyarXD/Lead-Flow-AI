import { getDb } from "./connection";
import { conversations, messages } from "@db/schema";
import { eq, and, desc, count, sql } from "drizzle-orm";
import type { InferInsertModel } from "drizzle-orm";

export async function findConversationsByOrganization(organizationId: number, filters?: {
  status?: string;
  channel?: string;
  assignedTo?: number;
  limit?: number;
  offset?: number;
}) {
  const conditions = [eq(conversations.organizationId, organizationId)];

  if (filters?.status) conditions.push(eq(conversations.status, filters.status as never));
  if (filters?.channel) conditions.push(eq(conversations.channel, filters.channel as never));
  if (filters?.assignedTo) conditions.push(eq(conversations.assignedTo, filters.assignedTo));

  const limit = filters?.limit ?? 50;
  const offset = filters?.offset ?? 0;

  return getDb().query.conversations.findMany({
    where: and(...conditions),
    with: {
      customer: true,
      lead: true,
      assignedUser: true,
    },
    orderBy: [desc(conversations.lastMessageAt)],
    limit,
    offset,
  });
}

export async function findConversationById(id: number) {
  return getDb().query.conversations.findFirst({
    where: eq(conversations.id, id),
    with: {
      customer: true,
      lead: true,
      assignedUser: true,
      messages: {
        orderBy: [messages.createdAt],
      },
    },
  });
}

export async function createConversation(data: InferInsertModel<typeof conversations>) {
  const [result] = await getDb().insert(conversations).values(data).$returningId();
  return findConversationById(result.id);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateConversation(id: number, data: any) {
  await getDb().update(conversations).set({ ...data, updatedAt: new Date() }).where(eq(conversations.id, id));
  return findConversationById(id);
}

export async function createMessage(data: InferInsertModel<typeof messages>) {
  const [result] = await getDb().insert(messages).values(data).$returningId();
  const message = await getDb().query.messages.findFirst({
    where: eq(messages.id, result.id),
  });

  // Update conversation last message
  if (message) {
    await getDb()
      .update(conversations)
      .set({
        lastMessageAt: message.createdAt,
        lastMessagePreview: message.content.slice(0, 200),
        messageCount: sql`${conversations.messageCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, data.conversationId));
  }

  return message;
}

export async function getConversationStats(organizationId: number) {
  const total = await getDb()
    .select({ count: count() })
    .from(conversations)
    .where(eq(conversations.organizationId, organizationId));

  const open = await getDb()
    .select({ count: count() })
    .from(conversations)
    .where(and(eq(conversations.organizationId, organizationId), eq(conversations.status, "open")));

  const aiHandled = await getDb()
    .select({ count: count() })
    .from(conversations)
    .where(and(eq(conversations.organizationId, organizationId), eq(conversations.aiHandled, true)));

  return {
    total: total[0].count,
    open: open[0].count,
    aiHandled: aiHandled[0].count,
  };
}
