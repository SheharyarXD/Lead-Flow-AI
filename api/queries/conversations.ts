import { getDb } from "./connection";
import { conversations, messages } from "@db/schema";
import { eq, and, desc, count, sql } from "drizzle-orm";
import type { InferInsertModel } from "drizzle-orm";
import { sendSMS } from "../lib/twilio";
import { sendEmail } from "../lib/email";

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
export async function updateConversation(id: number, organizationId: number, data: any) {
  await getDb()
    .update(conversations)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(conversations.id, id), eq(conversations.organizationId, organizationId)));
  return findConversationById(id);
}

export async function markConversationRead(id: number, organizationId: number) {
  await getDb()
    .update(conversations)
    .set({ unreadCount: 0, updatedAt: new Date() })
    .where(and(eq(conversations.id, id), eq(conversations.organizationId, organizationId)));
  return findConversationById(id);
}

export async function createMessage(data: InferInsertModel<typeof messages>) {
  const [result] = await getDb().insert(messages).values(data).$returningId();

  // Update conversation last message
  await getDb()
    .update(conversations)
    .set({
      lastMessageAt: new Date(),
      lastMessagePreview: data.content.slice(0, 200),
      messageCount: sql`${conversations.messageCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(conversations.id, data.conversationId));

  // Dispatch SMS or Email for outbound human/AI messages
  let dispatchResult: any = null;
  if (!data.isInternalNote && (data.senderType === "agent" || data.senderType === "ai")) {
    try {
      const conv = await getDb().query.conversations.findFirst({
        where: eq(conversations.id, data.conversationId),
        with: {
          customer: true,
        },
      });

      if (conv) {
        if (conv.channel === "sms" && conv.customer?.phone) {
          dispatchResult = await sendSMS(conv.customer.phone, data.content);
        } else if (conv.channel === "email" && conv.customer?.email) {
          dispatchResult = await sendEmail(conv.customer.email, conv.subject || "Message from LeadFlow AI", data.content);
        }
      }
    } catch (error) {
      console.error("Failed to automatically dispatch outbound message:", error);
    }
  }

  const finalMetadata = dispatchResult ? {
    dispatchId: dispatchResult.sid || dispatchResult.messageId || null,
    status: dispatchResult.status === "development_not_sent" ? "simulated" : "sent",
    dispatchedAt: new Date().toISOString(),
  } : undefined;

  if (finalMetadata) {
    await getDb()
      .update(messages)
      .set({ metadata: finalMetadata })
      .where(eq(messages.id, result.id));
  }

  return getDb().query.messages.findFirst({
    where: eq(messages.id, result.id),
  });
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

  const unread = await getDb()
    .select({ sum: sql<number>`COALESCE(SUM(${conversations.unreadCount}), 0)` })
    .from(conversations)
    .where(eq(conversations.organizationId, organizationId));

  return {
    total: total[0].count,
    open: open[0].count,
    aiHandled: aiHandled[0].count,
    unread: Number(unread[0].sum),
  };
}
