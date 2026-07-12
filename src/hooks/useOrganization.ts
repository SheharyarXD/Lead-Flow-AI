import { trpc } from "@/providers/trpc";
import { useAuth } from "./useAuth";

/** Returns the authenticated user's default organization; never a hard-coded tenant. */
export function useOrganization() {
  const { user } = useAuth();
  const query = trpc.organization.list.useQuery(undefined, {
    enabled: !!user,
  });
  const organization = query.data?.find((item) => item.memberRole === "owner") ?? query.data?.[0] ?? null;
  return {
    organization,
    organizationId: organization?.id,
    isLoading: query.isLoading && !!user,
    error: query.error,
    refreshOrganizations: query.refetch,
  };
}
