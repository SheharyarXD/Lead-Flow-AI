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
import { requireOnboardedOrganizationMembership as requireOrganizationMembership, requireOnboardedOrganizationRole as requireOrganizationRole } from "./queries/organizations";
import { generateTwilioVoiceToken, createTwilioCall } from "./lib/twilio";

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
    .query(async ({ input, ctx }) => {
      await requireOrganizationMembership(ctx.user.id, input.organizationId);
      const { organizationId, ...filters } = input;
      return findCallsByOrganization(organizationId, filters);
    }),

  getById: authedQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const call = await findCallById(input.id);
      if (!call) return null;
      await requireOrganizationMembership(ctx.user.id, call.organizationId);
      return call;
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
    .mutation(async ({ input, ctx }) => {
      await requireOrganizationRole(ctx.user.id, input.organizationId, ["owner", "admin", "manager", "member"]);
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
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      const call = await findCallById(id);
      if (!call) throw new Error("Call not found");
      await requireOrganizationRole(ctx.user.id, call.organizationId, ["owner", "admin", "manager", "member"]);
      return updateCall(id, call.organizationId, data as Record<string, unknown>);
    }),

  stats: authedQuery
    .input(z.object({ organizationId: z.number() }))
    .query(async ({ input, ctx }) => {
      await requireOrganizationMembership(ctx.user.id, input.organizationId);
      return getCallStats(input.organizationId);
    }),

  generateVoiceToken: authedQuery
    .input(z.object({ organizationId: z.number() }))
    .query(async ({ input, ctx }) => {
      const org = await requireOrganizationMembership(ctx.user.id, input.organizationId);
      const identity = `user_${ctx.user.id}`;
      return generateTwilioVoiceToken(identity, {
        accountSid: (org as any).twilioAccountSid,
        authToken: (org as any).twilioAuthToken,
      });
    }),

  initiateCall: authedQuery
    .input(
      z.object({
        organizationId: z.number(),
        phoneNumber: z.string(),
        customerId: z.number().optional(),
        leadId: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const org = await requireOrganizationRole(ctx.user.id, input.organizationId, ["owner", "admin", "manager", "member"]);

      const hostUrl = process.env.PUBLIC_URL || "https://app.leadflowai.com";
      const twilioRes = await createTwilioCall(input.phoneNumber, hostUrl, {
        accountSid: (org as any).twilioAccountSid,
        authToken: (org as any).twilioAuthToken,
        phoneNumber: (org as any).twilioPhoneNumber,
      });

      const callRecord = await createCall({
        organizationId: input.organizationId,
        customerId: input.customerId,
        leadId: input.leadId,
        phoneNumber: input.phoneNumber,
        direction: "outbound",
        status: "queued",
        userId: ctx.user.id,
        startedAt: new Date(),
      });

      return { call: callRecord, twilioSid: twilioRes.sid };
    }),
});
