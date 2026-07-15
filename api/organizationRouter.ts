import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { randomBytes, createHash } from "crypto";
import { createRouter, authedQuery, publicQuery } from "./middleware";
import { eq } from "drizzle-orm";
import { subscriptions } from "@db/schema";
import { getDb } from "./queries/connection";
import {
  findOrganizationById,
  findUserOrganizations,
  findOrganizationMembers,
  createOrganization,
  updateOrganization,
  addOrganizationMember,
  createSubscription,
  findUserDefaultOrganization,
  requireOrganizationMembership,
  requireOrganizationRole,
  ORG_ROLE_RANK,
  findMemberByUserId,
  countOwners,
  updateMemberRole,
  removeMember as removeMemberQuery,
  findPendingInvitation,
  createInvitation,
  updateInvitation,
  findInvitationsByOrganization,
  findInvitationByTokenHash,
  sanitizeOrganization,
} from "./queries/organizations";
import { findUserByEmail } from "./queries/users";
import { sendEmail } from "./lib/email";
import { encryptSecret } from "./lib/crypto";

const SECRET_FIELDS = ["openaiApiKey", "twilioAuthToken", "smtpPass"] as const;

// Encrypts any of the reversible secret fields present in the input, and drops
// keys the caller didn't actually send (so a blank/omitted field never
// clobbers a previously-saved credential).
function prepareOrgUpdate(data: Record<string, unknown>): Record<string, unknown> {
  const prepared: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    if ((SECRET_FIELDS as readonly string[]).includes(key)) {
      prepared[key] = value === null || value === "" ? null : encryptSecret(value as string);
    } else {
      prepared[key] = value;
    }
  }
  return prepared;
}

const hashInviteToken = (token: string) => createHash("sha256").update(token).digest("hex");

function inviteOrigin(req: Request): string {
  const host = req.headers.get("host") || "localhost:5173";
  const proto = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  return `${proto}://${host}`;
}

export const organizationRouter = createRouter({
  list: authedQuery.query(async ({ ctx }) => {
    return findUserOrganizations(ctx.user.id);
  }),

  getDefaultSubscription: authedQuery.query(async ({ ctx }) => {
    const defaultOrg = await findUserDefaultOrganization(ctx.user.id);
    if (!defaultOrg) return null;
    return getDb().query.subscriptions.findFirst({
      where: eq(subscriptions.organizationId, defaultOrg.id),
    });
  }),

  getById: authedQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      await requireOrganizationMembership(ctx.user.id, input.id);
      const org = await findOrganizationById(input.id);
      return org ? sanitizeOrganization(org) : org;
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

      return org ? sanitizeOrganization(org) : org;
    }),

  update: authedQuery
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        industry: z.string().optional(),
        website: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().email().or(z.literal("")).nullable().optional(),
        address: z.string().optional(),
        timezone: z.string().optional(),
        businessHours: z.record(z.string(), z.object({ open: z.string(), close: z.string() })).optional(),
        aiEnabled: z.boolean().optional(),
        aiInstructions: z.string().optional(),
        greetingMessage: z.string().optional(),
        openaiApiKey: z.string().nullable().optional(),
        twilioAccountSid: z.string().nullable().optional(),
        twilioAuthToken: z.string().nullable().optional(),
        twilioPhoneNumber: z.string().nullable().optional(),
        smtpHost: z.string().nullable().optional(),
        smtpPort: z.number().nullable().optional(),
        smtpUser: z.string().nullable().optional(),
        smtpPass: z.string().nullable().optional(),
        smtpFromEmail: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      await requireOrganizationRole(ctx.user.id, id, ["owner", "admin", "manager"]);
      const updated = await updateOrganization(id, prepareOrgUpdate(data));
      return updated ? sanitizeOrganization(updated) : updated;
    }),

  members: authedQuery
    .input(z.object({ organizationId: z.number() }))
    .query(async ({ input, ctx }) => {
      await requireOrganizationMembership(ctx.user.id, input.organizationId);
      return findOrganizationMembers(input.organizationId);
    }),

  // Autosave: called on every onboarding step transition so progress survives a
  // closed tab. Does not touch onboardingCompletedAt, so it never unlocks the app.
  saveProgress: authedQuery
    .input(z.object({
      organizationId: z.number(),
      name: z.string().optional(),
      industry: z.string().optional(),
      phone: z.string().optional(),
      businessHours: z.record(z.string(), z.object({ open: z.string(), close: z.string() })).optional(),
      services: z.array(z.string().min(1)).max(50).optional(),
      aiInstructions: z.string().max(10000).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { organizationId, ...data } = input;
      await requireOrganizationMembership(ctx.user.id, organizationId);
      const updated = await updateOrganization(organizationId, data);
      return updated ? sanitizeOrganization(updated) : updated;
    }),

  completeOnboarding: authedQuery
    .input(z.object({
      organizationId: z.number(),
      name: z.string().min(1),
      industry: z.string().min(1),
      phone: z.string().min(3),
      businessHours: z.record(z.string(), z.object({ open: z.string(), close: z.string() })),
      services: z.array(z.string().min(1)).max(50),
      aiInstructions: z.string().max(10000).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      await requireOrganizationMembership(ctx.user.id, input.organizationId);
      const updated = await updateOrganization(input.organizationId, {
        name: input.name,
        industry: input.industry,
        phone: input.phone,
        businessHours: input.businessHours,
        services: input.services,
        aiInstructions: input.aiInstructions,
        onboardingCompletedAt: new Date(),
      });
      return updated ? sanitizeOrganization(updated) : updated;
    }),

  // ── Team / RBAC management ──────────────────────────────────────────────
  listInvitations: authedQuery
    .input(z.object({ organizationId: z.number() }))
    .query(async ({ input, ctx }) => {
      await requireOrganizationRole(ctx.user.id, input.organizationId, ["owner", "admin"]);
      return findInvitationsByOrganization(input.organizationId);
    }),

  inviteMember: authedQuery
    .input(z.object({
      organizationId: z.number(),
      email: z.string().email(),
      role: z.enum(["admin", "manager", "member"]),
    }))
    .mutation(async ({ input, ctx }) => {
      const caller = await requireOrganizationRole(ctx.user.id, input.organizationId, ["owner", "admin"]);
      if (ORG_ROLE_RANK[input.role] >= ORG_ROLE_RANK[caller.role]) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You cannot invite someone to a role equal to or higher than your own" });
      }

      const email = input.email.toLowerCase();
      const existingUser = await findUserByEmail(email);
      if (existingUser) {
        const existingMembership = await findMemberByUserId(input.organizationId, existingUser.id);
        if (existingMembership) throw new TRPCError({ code: "CONFLICT", message: "This person is already a member of your organization" });
      }

      const org = await findOrganizationById(input.organizationId);
      const rawToken = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const existingInvite = await findPendingInvitation(input.organizationId, email);
      const invitation = existingInvite
        ? await updateInvitation(existingInvite.id, {
            role: input.role,
            tokenHash: hashInviteToken(rawToken),
            invitedBy: ctx.user.id,
            expiresAt,
          })
        : await createInvitation({
            organizationId: input.organizationId,
            email,
            role: input.role,
            tokenHash: hashInviteToken(rawToken),
            invitedBy: ctx.user.id,
            expiresAt,
          });

      const acceptUrl = `${inviteOrigin(ctx.req)}/accept-invite?token=${rawToken}`;
      await sendEmail(
        email,
        `You've been invited to join ${org?.name ?? "a team"} on LeadFlow AI`,
        `${ctx.user.name || "A teammate"} invited you to join ${org?.name ?? "their organization"} on LeadFlow AI as a ${input.role}.\n\nAccept your invite: ${acceptUrl}\n\nThis link expires in 7 days.`
      );

      return { success: true, invitationId: invitation?.id, ...(process.env.NODE_ENV !== "production" ? { devAcceptUrl: acceptUrl } : {}) };
    }),

  revokeInvitation: authedQuery
    .input(z.object({ organizationId: z.number(), invitationId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await requireOrganizationRole(ctx.user.id, input.organizationId, ["owner", "admin"]);
      await updateInvitation(input.invitationId, { status: "revoked" });
      return { success: true };
    }),

  previewInvite: publicQuery
    .input(z.object({ token: z.string().min(32) }))
    .query(async ({ input }) => {
      const invitation = await findInvitationByTokenHash(hashInviteToken(input.token));
      if (!invitation || invitation.status !== "pending" || invitation.expiresAt < new Date()) {
        return { valid: false as const };
      }
      return {
        valid: true as const,
        email: invitation.email,
        role: invitation.role,
        organizationName: invitation.organization.name,
      };
    }),

  acceptInvite: authedQuery
    .input(z.object({ token: z.string().min(32) }))
    .mutation(async ({ input, ctx }) => {
      const invitation = await findInvitationByTokenHash(hashInviteToken(input.token));
      if (!invitation || invitation.status !== "pending" || invitation.expiresAt < new Date()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This invite is invalid or has expired" });
      }
      if (invitation.email.toLowerCase() !== ctx.user.email.toLowerCase()) {
        throw new TRPCError({ code: "FORBIDDEN", message: `This invite was sent to ${invitation.email}. Log in with that email to accept it.` });
      }

      const existingMembership = await findMemberByUserId(invitation.organizationId, ctx.user.id);
      if (!existingMembership) {
        await addOrganizationMember({
          organizationId: invitation.organizationId,
          userId: ctx.user.id,
          role: invitation.role,
          isDefault: false,
        });
      }
      await updateInvitation(invitation.id, { status: "accepted", acceptedAt: new Date() });
      return { success: true, organizationId: invitation.organizationId };
    }),

  changeRole: authedQuery
    .input(z.object({
      organizationId: z.number(),
      userId: z.number(),
      role: z.enum(["admin", "manager", "member"]),
    }))
    .mutation(async ({ input, ctx }) => {
      const caller = await requireOrganizationRole(ctx.user.id, input.organizationId, ["owner", "admin"]);
      const target = await findMemberByUserId(input.organizationId, input.userId);
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "This person is not a member of your organization" });
      if (target.role === "owner") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Ownership cannot be changed here" });
      }
      if (ORG_ROLE_RANK[target.role] >= ORG_ROLE_RANK[caller.role] || ORG_ROLE_RANK[input.role] >= ORG_ROLE_RANK[caller.role]) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You cannot assign a role equal to or higher than your own" });
      }
      return updateMemberRole(input.organizationId, input.userId, input.role);
    }),

  removeMember: authedQuery
    .input(z.object({ organizationId: z.number(), userId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const caller = await requireOrganizationRole(ctx.user.id, input.organizationId, ["owner", "admin"]);
      if (input.userId === ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You cannot remove yourself from the organization" });
      }
      const target = await findMemberByUserId(input.organizationId, input.userId);
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "This person is not a member of your organization" });
      if (target.role === "owner") {
        const owners = await countOwners(input.organizationId);
        if (owners <= 1) throw new TRPCError({ code: "FORBIDDEN", message: "An organization must have at least one owner" });
      }
      if (ORG_ROLE_RANK[target.role] >= ORG_ROLE_RANK[caller.role]) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You cannot remove someone with an equal or higher role than your own" });
      }
      return removeMemberQuery(input.organizationId, input.userId);
    }),
});
