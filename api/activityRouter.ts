import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { activities } from "@db/schema";
import {
  findActivitiesByOrganization,
  createActivity,
} from "./queries/activities";

export const activityRouter = createRouter({
  list: authedQuery
    .input(
      z.object({
        organizationId: z.number(),
        entityType: z.string().optional(),
        entityId: z.number().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      })
    )
    .query(async ({ input }) => {
      const { organizationId, ...filters } = input;
      return findActivitiesByOrganization(organizationId, filters);
    }),

  create: authedQuery
    .input(
      z.object({
        organizationId: z.number(),
        actorType: z.enum(["user", "system", "ai", "customer"]).default("user"),
        entityType: z.string(),
        entityId: z.number(),
        action: z.string(),
        description: z.string().optional(),
        metadata: z.any().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return createActivity({
        organizationId: input.organizationId,
        actorId: ctx.user.id,
        actorType: input.actorType,
        entityType: input.entityType as typeof activities.$inferSelect.entityType,
        entityId: input.entityId,
        action: input.action,
        description: input.description,
        metadata: input.metadata,
      });
    }),
});
