import { z } from "zod";
import { createRouter, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { users, organizations, organizationMembers } from "@db/schema";
import { count, desc } from "drizzle-orm";

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
      });
    }),
});
