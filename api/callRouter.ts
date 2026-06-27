import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { calls } from "@db/schema";
import {
  findCallsByOrganization,
  findCallById,
  createCall,
  updateCall,
  getCallStats,
} from "./queries/calls";

export const callRouter = createRouter({
  list: authedQuery
    .input(
      z.object({
        organizationId: z.number(),
        status: z.string().optional(),
        direction: z.string().optional(),
        customerId: z.number().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      })
    )
    .query(async ({ input }) => {
      const { organizationId, ...filters } = input;
      return findCallsByOrganization(organizationId, filters);
    }),

  getById: authedQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return findCallById(input.id);
    }),

  create: authedQuery
    .input(
      z.object({
        organizationId: z.number(),
        customerId: z.number().optional(),
        leadId: z.number().optional(),
        phoneNumber: z.string(),
        direction: z.enum(["inbound", "outbound"]),
        status: z.string().optional(),
        aiHandled: z.boolean().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      return createCall({
        organizationId: input.organizationId,
        customerId: input.customerId,
        leadId: input.leadId,
        phoneNumber: input.phoneNumber,
        direction: input.direction,
        status: (input.status as typeof calls.$inferSelect.status) ?? "queued",
        aiHandled: input.aiHandled,
        notes: input.notes,
      });
    }),

  update: authedQuery
    .input(
      z.object({
        id: z.number(),
        status: z.string().optional(),
        duration: z.number().optional(),
        transcript: z.string().optional(),
        transcriptStatus: z.string().optional(),
        aiSummary: z.string().optional(),
        notes: z.string().optional(),
        endedAt: z.date().optional(),
        recordingUrl: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      return updateCall(id, data as Record<string, unknown>);
    }),

  stats: authedQuery
    .input(z.object({ organizationId: z.number() }))
    .query(async ({ input }) => {
      return getCallStats(input.organizationId);
    }),
});
