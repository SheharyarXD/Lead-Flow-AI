import { getDb } from "./connection";
import { organizations, organizationMembers, subscriptions } from "@db/schema";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import type { InferInsertModel } from "drizzle-orm";

export async function findOrganizationById(id: number) {
  return getDb().query.organizations.findFirst({
    where: eq(organizations.id, id),
  });
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
  return members.map((m) => ({ ...m.organization, memberRole: m.role }));
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

export async function createOrganization(data: InferInsertModel<typeof organizations>) {
  const [result] = await getDb().insert(organizations).values(data).$returningId();
  return findOrganizationById(result.id);
}

export async function updateOrganization(id: number, data: Partial<InferInsertModel<typeof organizations>>) {
  await getDb().update(organizations).set(data).where(eq(organizations.id, id));
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
