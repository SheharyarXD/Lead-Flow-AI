import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { knowledgeBase } from "@db/schema";
import {
  findKBEntriesByOrganization,
  findKBEntryById,
  createKBEntry,
  updateKBEntry,
  deleteKBEntry,
} from "./queries/knowledgeBase";

export const knowledgeBaseRouter = createRouter({
  list: authedQuery
    .input(
      z.object({
        organizationId: z.number(),
        type: z.string().optional(),
        category: z.string().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      })
    )
    .query(async ({ input }) => {
      const { organizationId, ...filters } = input;
      return findKBEntriesByOrganization(organizationId, filters);
    }),

  getById: authedQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return findKBEntryById(input.id);
    }),

  create: authedQuery
    .input(
      z.object({
        organizationId: z.number(),
        type: z.string(),
        title: z.string().min(1),
        content: z.string().min(1),
        category: z.string().optional(),
        tags: z.array(z.string()).optional(),
        aiEnabled: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return createKBEntry({
        organizationId: input.organizationId,
        type: input.type as typeof knowledgeBase.$inferSelect.type,
        title: input.title,
        content: input.content,
        category: input.category,
        tags: input.tags,
        aiEnabled: input.aiEnabled,
        createdBy: ctx.user.id,
      });
    }),

  update: authedQuery
    .input(
      z.object({
        id: z.number(),
        title: z.string().optional(),
        content: z.string().optional(),
        category: z.string().optional(),
        tags: z.array(z.string()).optional(),
        aiEnabled: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      return updateKBEntry(id, data as Record<string, unknown>);
    }),

  delete: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteKBEntry(input.id);
      return { success: true };
    }),
});
