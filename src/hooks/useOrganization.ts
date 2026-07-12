import { trpc } from "@/providers/trpc";

/** Returns the authenticated user's default organization; never a hard-coded tenant. */
export function useOrganization() {
  const query = trpc.organization.list.useQuery();
  const organization = query.data?.find((item) => item.memberRole === "owner") ?? query.data?.[0] ?? null;
  return { organization, organizationId: organization?.id, isLoading: query.isLoading, error: query.error };
}
