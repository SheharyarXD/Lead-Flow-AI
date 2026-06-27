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
    .query(async ({ input }) => {
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
    .query(async ({ input }) => {
      const { organizationId, ...filters } = input;
      return countLeadsByOrganization(organizationId, filters);
    }),

  getById: authedQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return findLeadById(input.id);
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
    .mutation(async ({ input }) => {
      return createLead({
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
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      return updateLead(id, data as Record<string, unknown>);
    }),

  delete: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteLead(input.id);
      return { success: true };
    }),

  stats: authedQuery
    .input(z.object({ organizationId: z.number() }))
    .query(async ({ input }) => {
      return getLeadStats(input.organizationId);
    }),
});
