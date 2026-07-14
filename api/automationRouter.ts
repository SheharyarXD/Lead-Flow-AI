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
import { requireOnboardedOrganizationMembership as requireOrganizationMembership, requireOnboardedOrganizationRole as requireOrganizationRole } from "./queries/organizations";

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
    .query(async ({ input, ctx }) => {
      await requireOrganizationMembership(ctx.user.id, input.organizationId);
      const { organizationId, ...filters } = input;
      return findAutomationsByOrganization(organizationId, filters);
    }),

  getById: authedQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const auto = await findAutomationById(input.id);
      if (!auto) return null;
      await requireOrganizationMembership(ctx.user.id, auto.organizationId);
      return auto;
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
      await requireOrganizationRole(ctx.user.id, input.organizationId, ["owner", "admin", "manager"]);
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
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      const auto = await findAutomationById(id);
      if (!auto) throw new Error("Automation not found");
      await requireOrganizationRole(ctx.user.id, auto.organizationId, ["owner", "admin", "manager"]);
      return updateAutomation(id, data as Record<string, unknown>);
    }),

  delete: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const auto = await findAutomationById(input.id);
      if (!auto) return { success: true };
      await requireOrganizationRole(ctx.user.id, auto.organizationId, ["owner", "admin", "manager"]);
      await deleteAutomation(input.id);
      return { success: true };
    }),

  stats: authedQuery
    .input(z.object({ organizationId: z.number() }))
    .query(async ({ input, ctx }) => {
      await requireOrganizationMembership(ctx.user.id, input.organizationId);
      return getAutomationStats(input.organizationId);
    }),
});
