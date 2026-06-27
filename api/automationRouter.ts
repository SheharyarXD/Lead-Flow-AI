import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { automations } from "@db/schema";
import {
  findAutomationsByOrganization,
  findAutomationById,
  createAutomation,
  updateAutomation,
  deleteAutomation,
  getAutomationStats,
} from "./queries/automations";

export const automationRouter = createRouter({
  list: authedQuery
    .input(
      z.object({
        organizationId: z.number(),
        status: z.string().optional(),
        trigger: z.string().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      })
    )
    .query(async ({ input }) => {
      const { organizationId, ...filters } = input;
      return findAutomationsByOrganization(organizationId, filters);
    }),

  getById: authedQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return findAutomationById(input.id);
    }),

  create: authedQuery
    .input(
      z.object({
        organizationId: z.number(),
        name: z.string().min(1),
        description: z.string().optional(),
        trigger: z.string(),
        conditions: z.array(z.any()).optional(),
        actions: z.array(z.any()).optional(),
        status: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return createAutomation({
        organizationId: input.organizationId,
        name: input.name,
        description: input.description,
        trigger: input.trigger as typeof automations.$inferSelect.trigger,
        conditions: input.conditions,
        actions: input.actions,
        status: (input.status as "active" | "paused" | "draft") ?? "draft",
        createdBy: ctx.user.id,
      });
    }),

  update: authedQuery
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        trigger: z.string().optional(),
        conditions: z.array(z.any()).optional(),
        actions: z.array(z.any()).optional(),
        status: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      return updateAutomation(id, data as Record<string, unknown>);
    }),

  delete: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteAutomation(input.id);
      return { success: true };
    }),

  stats: authedQuery
    .input(z.object({ organizationId: z.number() }))
    .query(async ({ input }) => {
      return getAutomationStats(input.organizationId);
    }),
});
