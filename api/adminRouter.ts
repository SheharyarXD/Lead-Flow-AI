import { z } from "zod";
import { createRouter, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { users, organizations, organizationMembers, activities } from "@db/schema";
import { count, desc, eq } from "drizzle-orm";

export const adminRouter = createRouter({
  stats: adminQuery.query(async () => {
    const totalUsers = await getDb().select({ count: count() }).from(users);
    const totalOrganizations = await getDb().select({ count: count() }).from(organizations);
    const totalMembers = await getDb().select({ count: count() }).from(organizationMembers);

    return {
      totalUsers: totalUsers[0].count,
      totalOrganizations: totalOrganizations[0].count,
      totalMembers: totalMembers[0].count,
    };
  }),

  users: adminQuery
    .input(
      z.object({
        limit: z.number().optional(),
        offset: z.number().optional(),
      })
    )
    .query(async ({ input }) => {
      return getDb().query.users.findMany({
        orderBy: [desc(users.createdAt)],
        limit: input.limit ?? 50,
        offset: input.offset ?? 0,
      });
    }),

  // Platform admins are not necessarily members of every tenant, so this
  // intentionally bypasses the per-organization membership check used
  // elsewhere — it is gated by the global adminQuery role check instead.
  organizations: adminQuery
    .input(
      z.object({
        limit: z.number().optional(),
        offset: z.number().optional(),
      })
    )
    .query(async ({ input }) => {
      return getDb().query.organizations.findMany({
        orderBy: [desc(organizations.createdAt)],
        limit: input.limit ?? 50,
        offset: input.offset ?? 0,
        with: {
          subscription: true,
          members: { with: { user: true } },
        },
      });
    }),

  organizationActivity: adminQuery
    .input(z.object({ organizationId: z.number(), limit: z.number().optional() }))
    .query(async ({ input }) => {
      return getDb().query.activities.findMany({
        where: eq(activities.organizationId, input.organizationId),
        orderBy: [desc(activities.createdAt)],
        limit: input.limit ?? 15,
      });
    }),
});
