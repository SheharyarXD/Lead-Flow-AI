import { getDb } from "./connection";
import { organizations, organizationMembers, organizationInvitations, subscriptions } from "@db/schema";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import type { InferInsertModel } from "drizzle-orm";

export const ORG_ROLE_RANK: Record<"owner" | "admin" | "manager" | "member", number> = {
  owner: 3,
  admin: 2,
  manager: 1,
  member: 0,
};

export async function findOrganizationById(id: number) {
  return getDb().query.organizations.findFirst({
    where: eq(organizations.id, id),
  });
}

// Strips reversible-encrypted secrets (Twilio auth token, SMTP password, OpenAI
// API key) before an organization row is sent to the client. Callers that need
// the real value for outbound dispatch (SMS/Email/AI) must read the raw DB row
// directly and decrypt it server-side — never route it back through the API.
export function sanitizeOrganization<T extends Record<string, unknown>>(org: T): Omit<T, "openaiApiKey" | "twilioAuthToken" | "smtpPass"> & {
  hasOpenaiApiKey: boolean;
  hasTwilioAuthToken: boolean;
  hasSmtpPassword: boolean;
} {
  const { openaiApiKey, twilioAuthToken, smtpPass, ...rest } = org;
  return {
    ...rest,
    hasOpenaiApiKey: !!openaiApiKey,
    hasTwilioAuthToken: !!twilioAuthToken,
    hasSmtpPassword: !!smtpPass,
  };
}

export async function findOrganizationBySlug(slug: string) {
  return getDb().query.organizations.findFirst({
    where: eq(organizations.slug, slug),
  });
}

export async function findUserOrganizations(userId: number) {
  const members = await getDb().query.organizationMembers.findMany({
    where: eq(organizationMembers.userId, userId),
    with: {
      organization: true,
    },
  });
  return members.map((m) => ({ ...sanitizeOrganization(m.organization), memberRole: m.role }));
}

export async function findUserDefaultOrganization(userId: number) {
  const member = await getDb().query.organizationMembers.findFirst({
    where: and(
      eq(organizationMembers.userId, userId),
      eq(organizationMembers.isDefault, true)
    ),
    with: {
      organization: true,
    },
  });
  return member?.organization ?? null;
}

export async function requireOrganizationMembership(userId: number, organizationId: number) {
  const membership = await getDb().query.organizationMembers.findFirst({
    where: and(eq(organizationMembers.organizationId, organizationId), eq(organizationMembers.userId, userId)),
  });
  if (!membership) throw new TRPCError({ code: "FORBIDDEN", message: "You do not have access to this organization" });
  return membership;
}

export async function requireOrganizationRole(userId: number, organizationId: number, roles: Array<"owner" | "admin" | "manager" | "member">) {
  const membership = await requireOrganizationMembership(userId, organizationId);
  if (!roles.includes(membership.role)) throw new TRPCError({ code: "FORBIDDEN", message: "Your organization role cannot perform this action" });
  return membership;
}

// Gate used by every "main app" router (dashboard, leads, customers, conversations,
// tasks, appointments, calls, automations, activities). Organization setup itself
// (organizationRouter, knowledgeBaseRouter) intentionally uses the raw membership
// check above, since onboarding must be able to save data before it is complete.
export async function requireOnboardedOrganizationMembership(userId: number, organizationId: number) {
  const membership = await requireOrganizationMembership(userId, organizationId);
  const org = await findOrganizationById(organizationId);
  if (!org?.onboardingCompletedAt) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Organization onboarding must be completed first" });
  }
  return membership;
}

export async function requireOnboardedOrganizationRole(userId: number, organizationId: number, roles: Array<"owner" | "admin" | "manager" | "member">) {
  const membership = await requireOnboardedOrganizationMembership(userId, organizationId);
  if (!roles.includes(membership.role)) throw new TRPCError({ code: "FORBIDDEN", message: "Your organization role cannot perform this action" });
  return membership;
}

export async function createOrganization(data: InferInsertModel<typeof organizations>) {
  try {
    const [result] = await getDb().insert(organizations).values(data).$returningId();
    return findOrganizationById(result.id);
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "ER_DUP_ENTRY") {
      const field = data.phone ? "phone number" : data.email ? "email address" : "slug";
      throw new TRPCError({ code: "CONFLICT", message: `That ${field} is already used by another organization.` });
    }
    throw err;
  }
}

export async function updateOrganization(id: number, data: Partial<InferInsertModel<typeof organizations>>) {
  try {
    await getDb().update(organizations).set(data).where(eq(organizations.id, id));
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "ER_DUP_ENTRY") {
      const field = data.phone !== undefined ? "phone number" : data.email !== undefined ? "email address" : "value";
      throw new TRPCError({ code: "CONFLICT", message: `That ${field} is already used by another organization.` });
    }
    throw err;
  }
  return findOrganizationById(id);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function addOrganizationMember(data: any) {
  await getDb().insert(organizationMembers).values(data);
  return getDb().query.organizationMembers.findFirst({
    where: and(
      eq(organizationMembers.organizationId, data.organizationId),
      eq(organizationMembers.userId, data.userId)
    ),
  });
}

export async function findOrganizationMembers(organizationId: number) {
  return getDb().query.organizationMembers.findMany({
    where: eq(organizationMembers.organizationId, organizationId),
    with: {
      user: true,
    },
  });
}

export async function createSubscription(data: InferInsertModel<typeof subscriptions>) {
  await getDb().insert(subscriptions).values(data);
  return getDb().query.subscriptions.findFirst({
    where: eq(subscriptions.organizationId, data.organizationId),
  });
}

export async function findMemberByUserId(organizationId: number, userId: number) {
  return getDb().query.organizationMembers.findFirst({
    where: and(eq(organizationMembers.organizationId, organizationId), eq(organizationMembers.userId, userId)),
  });
}

export async function countOwners(organizationId: number) {
  const owners = await getDb().query.organizationMembers.findMany({
    where: and(eq(organizationMembers.organizationId, organizationId), eq(organizationMembers.role, "owner")),
  });
  return owners.length;
}

export async function updateMemberRole(organizationId: number, userId: number, role: "admin" | "manager" | "member") {
  await getDb()
    .update(organizationMembers)
    .set({ role })
    .where(and(eq(organizationMembers.organizationId, organizationId), eq(organizationMembers.userId, userId)));
  return findMemberByUserId(organizationId, userId);
}

export async function removeMember(organizationId: number, userId: number) {
  await getDb()
    .delete(organizationMembers)
    .where(and(eq(organizationMembers.organizationId, organizationId), eq(organizationMembers.userId, userId)));
  return { success: true };
}

export async function findPendingInvitation(organizationId: number, email: string) {
  return getDb().query.organizationInvitations.findFirst({
    where: and(
      eq(organizationInvitations.organizationId, organizationId),
      eq(organizationInvitations.email, email.toLowerCase()),
      eq(organizationInvitations.status, "pending")
    ),
  });
}

export async function createInvitation(data: InferInsertModel<typeof organizationInvitations>) {
  const [result] = await getDb().insert(organizationInvitations).values(data).$returningId();
  return getDb().query.organizationInvitations.findFirst({ where: eq(organizationInvitations.id, result.id) });
}

export async function updateInvitation(id: number, data: Partial<InferInsertModel<typeof organizationInvitations>>) {
  await getDb().update(organizationInvitations).set(data).where(eq(organizationInvitations.id, id));
  return getDb().query.organizationInvitations.findFirst({ where: eq(organizationInvitations.id, id) });
}

export async function findInvitationsByOrganization(organizationId: number) {
  return getDb().query.organizationInvitations.findMany({
    where: and(eq(organizationInvitations.organizationId, organizationId), eq(organizationInvitations.status, "pending")),
  });
}

export async function findInvitationByTokenHash(tokenHash: string) {
  return getDb().query.organizationInvitations.findFirst({
    where: eq(organizationInvitations.tokenHash, tokenHash),
    with: { organization: true },
  });
}

