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
import { requireOrganizationMembership, requireOrganizationRole } from "./queries/organizations";

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
    .query(async ({ input, ctx }) => {
      await requireOrganizationMembership(ctx.user.id, input.organizationId);
      const { organizationId, ...filters } = input;
      return findConversationsByOrganization(organizationId, filters);
    }),

  getById: authedQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const conversation = await findConversationById(input.id);
      if (!conversation) return null;
      await requireOrganizationMembership(ctx.user.id, conversation.organizationId);
      return conversation;
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
    .mutation(async ({ input, ctx }) => {
      await requireOrganizationRole(ctx.user.id, input.organizationId, ["owner", "admin", "manager", "member"]);
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
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      const conversation = await findConversationById(id);
      if (!conversation) return null;
      await requireOrganizationRole(ctx.user.id, conversation.organizationId, ["owner", "admin", "manager", "member"]);
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
    .mutation(async ({ input, ctx }) => {
      const conversation = await findConversationById(input.conversationId);
      if (!conversation) throw new Error("Conversation not found");
      await requireOrganizationRole(ctx.user.id, conversation.organizationId, ["owner", "admin", "manager", "member"]);
      if (input.senderType !== "agent" || input.senderId !== undefined) throw new Error("Invalid message sender");
      input.senderId = ctx.user.id;
      return createMessage(input);
    }),

  stats: authedQuery
    .input(z.object({ organizationId: z.number() }))
    .query(async ({ input, ctx }) => {
      await requireOrganizationMembership(ctx.user.id, input.organizationId);
      return getConversationStats(input.organizationId);
    }),
});
