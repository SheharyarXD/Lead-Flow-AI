import { z } from "zod";
import { TRPCError } from "@trpc/server";
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
import { runAutomationById } from "./lib/automations";
import { findLeadById } from "./queries/leads";
import { findCustomerById } from "./queries/customers";

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

  // Manual test-run: fires this exact rule's actions right now against an
  // optional lead/customer, regardless of its configured trigger — the "manual"
  // trigger value in the schema's enum, and a straightforward way to verify a
  // rule works without waiting for its real trigger event.
  runNow: authedQuery
    .input(z.object({ id: z.number(), leadId: z.number().optional(), customerId: z.number().optional() }))
    .mutation(async ({ input, ctx }) => {
      const auto = await findAutomationById(input.id);
      if (!auto) throw new TRPCError({ code: "NOT_FOUND", message: "Automation not found" });
      await requireOrganizationRole(ctx.user.id, auto.organizationId, ["owner", "admin", "manager"]);

      const lead = input.leadId ? await findLeadById(input.leadId) : null;
      const customer = !lead && input.customerId ? await findCustomerById(input.customerId) : null;

      await runAutomationById(auto, {
        leadId: input.leadId ?? null,
        customerId: input.customerId ?? null,
        phone: lead?.phone ?? customer?.phone ?? null,
        email: lead?.email ?? customer?.email ?? null,
        firstName: lead?.firstName ?? customer?.firstName ?? null,
        lastName: lead?.lastName ?? customer?.lastName ?? null,
      });

      return findAutomationById(input.id);
    }),
});
