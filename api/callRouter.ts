import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, authedQuery } from "./middleware";
import { calls } from "@db/schema";
import {
  findCallsByOrganization,
  findCallById,
  createCall,
  updateCall,
  getCallStats,
} from "./queries/calls";
import { findLeadById } from "./queries/leads";
import { findCustomerById } from "./queries/customers";
import { findOrganizationById, requireOnboardedOrganizationMembership as requireOrganizationMembership, requireOnboardedOrganizationRole as requireOrganizationRole } from "./queries/organizations";
import { createActivity } from "./queries/activities";
import { decryptSecret } from "./lib/crypto";
import { generateTwilioVoiceToken } from "./lib/twilio";

// The membership row returned by requireOrganizationRole/Membership has no
// Twilio fields on it — those live on the organizations row itself. This
// fetches the real row and decrypts the reversible secret so callers never
// have to duplicate that logic (or accidentally read the wrong object).
async function getDecryptedTwilioCredentials(organizationId: number) {
  const org = await findOrganizationById(organizationId);
  return {
    accountSid: org?.twilioAccountSid ?? null,
    authToken: org?.twilioAuthToken ? decryptSecret(org.twilioAuthToken) : null,
    phoneNumber: org?.twilioPhoneNumber ?? null,
    twimlAppSid: org?.twilioTwimlAppSid ?? null,
    organizationPhone: org?.phone ?? null,
  };
}

export const callRouter = createRouter({
  list: authedQuery
    .input(
      z.object({
        organizationId: z.number(),
        status: z.string().optional(),
        direction: z.string().optional(),
        customerId: z.number().optional(),
        assignedTo: z.number().optional(),
        aiHandled: z.boolean().optional(),
        search: z.string().optional(),
        startDate: z.coerce.date().optional(),
        endDate: z.coerce.date().optional(),
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

  // Issues a short-lived Twilio Voice SDK access token so the browser can act
  // as a WebRTC softphone (CallDialerModal). Returns simulated:true when this
  // organization has no working Twilio Voice configuration.
  generateVoiceToken: authedQuery
    .input(z.object({ organizationId: z.number() }))
    .query(async ({ input, ctx }) => {
      await requireOrganizationMembership(ctx.user.id, input.organizationId);
      const identity = `user_${ctx.user.id}`;
      const creds = await getDecryptedTwilioCredentials(input.organizationId);
      return generateTwilioVoiceToken(identity, creds);
    }),

  initiateCall: authedQuery
    .input(
      z.object({
        organizationId: z.number(),
        phoneNumber: z.string().min(3),
        customerId: z.number().optional(),
        leadId: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireOrganizationRole(ctx.user.id, input.organizationId, ["owner", "admin", "manager", "member"]);

      // A customer/lead ID supplied by the client must actually belong to this
      // organization — otherwise a call could get linked to another tenant's record.
      if (input.customerId) {
        const customer = await findCustomerById(input.customerId);
        if (!customer || customer.organizationId !== input.organizationId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "That customer does not belong to this organization" });
        }
      }
      if (input.leadId) {
        const lead = await findLeadById(input.leadId);
        if (!lead || lead.organizationId !== input.organizationId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "That lead does not belong to this organization" });
        }
      }

      const creds = await getDecryptedTwilioCredentials(input.organizationId);
      const isConfigured = !!(creds.accountSid && creds.authToken && (creds.phoneNumber || creds.organizationPhone));

      // The DB record is created here, before any real Twilio connection
      // exists. The browser then connects via the Twilio Voice SDK
      // (Device.connect), passing this record's id through as a custom
      // param — the TwiML webhook uses it to attach the real CallSid to
      // this exact row once Twilio assigns one, so there is never a moment
      // where a real call exists with no trace in our system, and no risk
      // of a second, duplicate call being placed by the server as well.
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
      if (!callRecord) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create call record" });

      await createActivity({
        organizationId: input.organizationId,
        actorId: ctx.user.id,
        actorType: "user",
        entityType: "call",
        entityId: callRecord.id,
        action: "Outbound call started",
        description: `Called ${input.phoneNumber}${isConfigured ? "" : " (simulated — Twilio is not configured for this organization)"}`,
      });

      return { call: callRecord, simulated: !isConfigured };
    }),

  // Manually end a call that's in progress. Ends the real Twilio call leg when
  // Twilio is configured; otherwise just marks the (simulated) call complete.
  hangup: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const call = await findCallById(input.id);
      if (!call) throw new TRPCError({ code: "NOT_FOUND", message: "Call not found" });
      await requireOrganizationRole(ctx.user.id, call.organizationId, ["owner", "admin", "manager", "member"]);

      const creds = await getDecryptedTwilioCredentials(call.organizationId);
      if (call.twilioCallSid && creds.accountSid && creds.authToken) {
        try {
          const twilio = (await import("twilio")).default;
          const client = twilio(creds.accountSid, creds.authToken);
          await client.calls(call.twilioCallSid).update({ status: "completed" });
        } catch (err) {
          console.error("Failed to end Twilio call leg:", err);
        }
      }

      // The authoritative status/duration normally comes from the Twilio status
      // webhook; this is a fallback so the UI doesn't hang if the callback is
      // slow to arrive or Twilio isn't configured (simulated mode).
      if (call.status !== "completed" && call.status !== "failed") {
        const duration = call.startedAt ? Math.round((Date.now() - new Date(call.startedAt).getTime()) / 1000) : null;
        await updateCall(call.id, call.organizationId, {
          status: "completed",
          endedAt: new Date(),
          duration: duration ?? undefined,
        });
      }

      return findCallById(call.id);
    }),
});
