import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { leads } from "@db/schema";
import {
  findLeadsByOrganization,
  findLeadById,
  createLead,
  updateLead,
  deleteLead,
  getLeadStats,
  countLeadsByOrganization,
} from "./queries/leads";
import { requireOrganizationMembership, requireOrganizationRole } from "./queries/organizations";
import { createTask } from "./queries/tasks";
import { createActivity } from "./queries/activities";

export const leadRouter = createRouter({
  list: authedQuery
    .input(
      z.object({
        organizationId: z.number(),
        status: z.string().optional(),
        source: z.string().optional(),
        priority: z.string().optional(),
        search: z.string().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      await requireOrganizationMembership(ctx.user.id, input.organizationId);
      const { organizationId, ...filters } = input;
      return findLeadsByOrganization(organizationId, filters);
    }),

  count: authedQuery
    .input(
      z.object({
        organizationId: z.number(),
        status: z.string().optional(),
        source: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      await requireOrganizationMembership(ctx.user.id, input.organizationId);
      const { organizationId, ...filters } = input;
      return countLeadsByOrganization(organizationId, filters);
    }),

  getById: authedQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const lead = await findLeadById(input.id);
      if (!lead) return null;
      await requireOrganizationMembership(ctx.user.id, lead.organizationId);
      return lead;
    }),

  create: authedQuery
    .input(
      z.object({
        organizationId: z.number(),
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        company: z.string().optional(),
        title: z.string().optional(),
        source: z.string().optional(),
        status: z.string().optional(),
        priority: z.string().optional(),
        estimatedValue: z.number().optional(),
        assignedTo: z.number().optional(),
        tags: z.array(z.string()).optional(),
        notes: z.string().optional(),
        customerId: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireOrganizationRole(ctx.user.id, input.organizationId, ["owner", "admin", "manager", "member"]);
      const lead = await createLead({
        organizationId: input.organizationId,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone,
        company: input.company,
        title: input.title,
        source: (input.source as typeof leads.$inferSelect.source) ?? "other",
        status: (input.status as typeof leads.$inferSelect.status) ?? "new",
        priority: (input.priority as typeof leads.$inferSelect.priority) ?? "medium",
        estimatedValue: input.estimatedValue,
        assignedTo: input.assignedTo,
        tags: input.tags,
        notes: input.notes,
        customerId: input.customerId,
      });
      if (lead) {
        await createTask({ organizationId: lead.organizationId, leadId: lead.id, title: `Follow up with ${lead.firstName} ${lead.lastName}`, type: "follow_up", priority: lead.priority ?? "medium", status: "pending", assignedTo: lead.assignedTo, dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000) });
        await createActivity({ organizationId: lead.organizationId, actorId: ctx.user.id, actorType: "user", entityType: "lead", entityId: lead.id, action: "Lead created", description: `Lead ${lead.firstName} ${lead.lastName} created with a follow-up task` });
      }
      return lead;
    }),

  update: authedQuery
    .input(
      z.object({
        id: z.number(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        company: z.string().optional(),
        title: z.string().optional(),
        status: z.string().optional(),
        priority: z.string().optional(),
        estimatedValue: z.number().optional(),
        assignedTo: z.number().optional(),
        tags: z.array(z.string()).optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      const lead = await findLeadById(id);
      if (!lead) return null;
      await requireOrganizationRole(ctx.user.id, lead.organizationId, ["owner", "admin", "manager", "member"]);
      return updateLead(id, data as Record<string, unknown>);
    }),

  delete: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const lead = await findLeadById(input.id);
      if (!lead) return { success: true };
      await requireOrganizationRole(ctx.user.id, lead.organizationId, ["owner", "admin", "manager"]);
      await deleteLead(input.id);
      return { success: true };
    }),

  stats: authedQuery
    .input(z.object({ organizationId: z.number() }))
    .query(async ({ input, ctx }) => {
      await requireOrganizationMembership(ctx.user.id, input.organizationId);
      return getLeadStats(input.organizationId);
    }),
});
