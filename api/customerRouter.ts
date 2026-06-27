import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { customers } from "@db/schema";
import {
  findCustomersByOrganization,
  findCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  countCustomersByOrganization,
} from "./queries/customers";

export const customerRouter = createRouter({
  list: authedQuery
    .input(
      z.object({
        organizationId: z.number(),
        status: z.string().optional(),
        search: z.string().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      })
    )
    .query(async ({ input }) => {
      const { organizationId, ...filters } = input;
      return findCustomersByOrganization(organizationId, filters);
    }),

  count: authedQuery
    .input(z.object({ organizationId: z.number() }))
    .query(async ({ input }) => {
      return countCustomersByOrganization(input.organizationId);
    }),

  getById: authedQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return findCustomerById(input.id);
    }),

  create: authedQuery
    .input(
      z.object({
        organizationId: z.number(),
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        source: z.string().optional(),
        tags: z.array(z.string()).optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      return createCustomer({
        organizationId: input.organizationId,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone,
        source: (input.source as typeof customers.$inferSelect.source) ?? "other",
        tags: input.tags,
        notes: input.notes,
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
        status: z.string().optional(),
        tags: z.array(z.string()).optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      return updateCustomer(id, data as Record<string, unknown>);
    }),

  delete: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteCustomer(input.id);
      return { success: true };
    }),
});
