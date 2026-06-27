import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import {
  getDashboardStats,
  getRecentActivity,
  getUpcomingTasks,
  getUpcomingAppointments,
} from "./queries/dashboard";

export const dashboardRouter = createRouter({
  stats: authedQuery
    .input(z.object({ organizationId: z.number() }))
    .query(async ({ input }) => {
      return getDashboardStats(input.organizationId);
    }),

  activity: authedQuery
    .input(
      z.object({
        organizationId: z.number(),
        limit: z.number().optional(),
      })
    )
    .query(async ({ input }) => {
      return getRecentActivity(input.organizationId, input.limit ?? 10);
    }),

  upcomingTasks: authedQuery
    .input(
      z.object({
        organizationId: z.number(),
        limit: z.number().optional(),
      })
    )
    .query(async ({ input }) => {
      return getUpcomingTasks(input.organizationId, input.limit ?? 5);
    }),

  upcomingAppointments: authedQuery
    .input(
      z.object({
        organizationId: z.number(),
        limit: z.number().optional(),
      })
    )
    .query(async ({ input }) => {
      return getUpcomingAppointments(input.organizationId, input.limit ?? 5);
    }),
});
