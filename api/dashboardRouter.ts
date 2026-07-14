import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import {
  getDashboardStats,
  getRecentActivity,
  getUpcomingTasks,
  getUpcomingAppointments,
} from "./queries/dashboard";
import { requireOnboardedOrganizationMembership as requireOrganizationMembership } from "./queries/organizations";

export const dashboardRouter = createRouter({
  stats: authedQuery
    .input(z.object({ organizationId: z.number() }))
    .query(async ({ input, ctx }) => {
      await requireOrganizationMembership(ctx.user.id, input.organizationId);
      return getDashboardStats(input.organizationId);
    }),

  activity: authedQuery
    .input(
      z.object({
        organizationId: z.number(),
        limit: z.number().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      await requireOrganizationMembership(ctx.user.id, input.organizationId);
      return getRecentActivity(input.organizationId, input.limit ?? 10);
    }),

  upcomingTasks: authedQuery
    .input(
      z.object({
        organizationId: z.number(),
        limit: z.number().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      await requireOrganizationMembership(ctx.user.id, input.organizationId);
      return getUpcomingTasks(input.organizationId, input.limit ?? 5);
    }),

  upcomingAppointments: authedQuery
    .input(
      z.object({
        organizationId: z.number(),
        limit: z.number().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      await requireOrganizationMembership(ctx.user.id, input.organizationId);
      return getUpcomingAppointments(input.organizationId, input.limit ?? 5);
    }),
});
