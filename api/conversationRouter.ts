import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { conversations } from "@db/schema";
import {
  findConversationsByOrganization,
  findConversationById,
  createConversation,
  updateConversation,
  createMessage,
  getConversationStats,
} from "./queries/conversations";

export const conversationRouter = createRouter({
  list: authedQuery
    .input(
      z.object({
        organizationId: z.number(),
        status: z.string().optional(),
        channel: z.string().optional(),
        assignedTo: z.number().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      })
    )
    .query(async ({ input }) => {
      const { organizationId, ...filters } = input;
      return findConversationsByOrganization(organizationId, filters);
    }),

  getById: authedQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return findConversationById(input.id);
    }),

  create: authedQuery
    .input(
      z.object({
        organizationId: z.number(),
        customerId: z.number().optional(),
        leadId: z.number().optional(),
        channel: z.string(),
        subject: z.string().optional(),
        priority: z.string().optional(),
        assignedTo: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      return createConversation({
        organizationId: input.organizationId,
        customerId: input.customerId,
        leadId: input.leadId,
        channel: input.channel as typeof conversations.$inferSelect.channel,
        subject: input.subject,
        priority: (input.priority as "low" | "medium" | "high" | "urgent") ?? "medium",
        assignedTo: input.assignedTo,
        status: "open",
      });
    }),

  update: authedQuery
    .input(
      z.object({
        id: z.number(),
        status: z.string().optional(),
        priority: z.string().optional(),
        assignedTo: z.number().optional(),
        subject: z.string().optional(),
        aiSummary: z.string().optional(),
        aiHandled: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      return updateConversation(id, data as Record<string, unknown>);
    }),

  sendMessage: authedQuery
    .input(
      z.object({
        conversationId: z.number(),
        content: z.string().min(1),
        senderType: z.enum(["customer", "agent", "ai", "system"]).default("agent"),
        senderId: z.number().optional(),
        isInternalNote: z.boolean().default(false),
      })
    )
    .mutation(async ({ input }) => {
      return createMessage(input);
    }),

  stats: authedQuery
    .input(z.object({ organizationId: z.number() }))
    .query(async ({ input }) => {
      return getConversationStats(input.organizationId);
    }),
});
