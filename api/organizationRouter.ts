import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import {
  findOrganizationById,
  findUserOrganizations,
  findOrganizationMembers,
  createOrganization,
  updateOrganization,
  addOrganizationMember,
  createSubscription,
} from "./queries/organizations";

export const organizationRouter = createRouter({
  list: authedQuery.query(async ({ ctx }) => {
    return findUserOrganizations(ctx.user.id);
  }),

  getById: authedQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return findOrganizationById(input.id);
    }),

  create: authedQuery
    .input(
      z.object({
        name: z.string().min(1),
        slug: z.string().min(1),
        industry: z.string().optional(),
        website: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().email().optional(),
        address: z.string().optional(),
        timezone: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const org = await createOrganization({
        name: input.name,
        slug: input.slug,
        industry: input.industry,
        website: input.website,
        phone: input.phone,
        email: input.email,
        address: input.address,
        timezone: input.timezone ?? "America/New_York",
      });

      if (org) {
        await addOrganizationMember({
          organizationId: org.id,
          userId: ctx.user.id,
          role: "owner",
          isDefault: true,
        });

        await createSubscription({
          organizationId: org.id,
          plan: "starter",
          status: "trialing",
          minutesIncluded: 100,
          leadsLimit: 100,
          usersLimit: 2,
        });
      }

      return org;
    }),

  update: authedQuery
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        industry: z.string().optional(),
        website: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().email().optional(),
        address: z.string().optional(),
        timezone: z.string().optional(),
        businessHours: z.record(z.string(), z.object({ open: z.string(), close: z.string() })).optional(),
        aiEnabled: z.boolean().optional(),
        aiInstructions: z.string().optional(),
        greetingMessage: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      return updateOrganization(id, data as Record<string, unknown>);
    }),

  members: authedQuery
    .input(z.object({ organizationId: z.number() }))
    .query(async ({ input }) => {
      return findOrganizationMembers(input.organizationId);
    }),
});
