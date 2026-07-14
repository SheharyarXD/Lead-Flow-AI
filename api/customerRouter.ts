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
import { requireOnboardedOrganizationMembership as requireOrganizationMembership, requireOnboardedOrganizationRole as requireOrganizationRole } from "./queries/organizations";
import { createActivity } from "./queries/activities";

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
    .query(async ({ input, ctx }) => {
      await requireOrganizationMembership(ctx.user.id, input.organizationId);
      const { organizationId, ...filters } = input;
      return findCustomersByOrganization(organizationId, filters);
    }),

  count: authedQuery
    .input(z.object({ organizationId: z.number() }))
    .query(async ({ input, ctx }) => {
      await requireOrganizationMembership(ctx.user.id, input.organizationId);
      return countCustomersByOrganization(input.organizationId);
    }),

  getById: authedQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const customer = await findCustomerById(input.id);
      if (!customer) return null;
      await requireOrganizationMembership(ctx.user.id, customer.organizationId);
      return customer;
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
    .mutation(async ({ input, ctx }) => {
      await requireOrganizationRole(ctx.user.id, input.organizationId, ["owner", "admin", "manager", "member"]);
      const customer = await createCustomer({
        organizationId: input.organizationId,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone,
        source: (input.source as typeof customers.$inferSelect.source) ?? "other",
        tags: input.tags,
        notes: input.notes,
      });
      if (customer) {
        await createActivity({
          organizationId: input.organizationId,
          actorId: ctx.user.id,
          actorType: "user",
          entityType: "customer",
          entityId: customer.id,
          action: "Customer created",
          description: `Customer ${customer.firstName} ${customer.lastName} created`,
        });
      }
      return customer;
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
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      const customer = await findCustomerById(id);
      if (!customer) return null;
      await requireOrganizationRole(ctx.user.id, customer.organizationId, ["owner", "admin", "manager", "member"]);
      const updated = await updateCustomer(id, customer.organizationId, data as Record<string, unknown>);
      await createActivity({
        organizationId: customer.organizationId,
        actorId: ctx.user.id,
        actorType: "user",
        entityType: "customer",
        entityId: id,
        action: "Customer updated",
        description: `Customer ${customer.firstName} ${customer.lastName} updated`,
      });
      return updated;
    }),

  delete: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const customer = await findCustomerById(input.id);
      if (!customer) return { success: true };
      await requireOrganizationRole(ctx.user.id, customer.organizationId, ["owner", "admin", "manager"]);
      await deleteCustomer(input.id, customer.organizationId);
      await createActivity({
        organizationId: customer.organizationId,
        actorId: ctx.user.id,
        actorType: "user",
        entityType: "customer",
        entityId: input.id,
        action: "Customer deleted",
        description: `Customer ${customer.firstName} ${customer.lastName} deleted`,
      });
      return { success: true };
    }),
});
