import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@oorjaman/api";

/** Drop cached partner profile after sign-out so the next login cannot reuse stale onboarding state. */
export function clearPartnerSessionQueries(queryClient: QueryClient): void {
  queryClient.removeQueries({ queryKey: queryKeys.users.me() });
  queryClient.removeQueries({ queryKey: queryKeys.technicians.me() });
}

/** Refresh partner profile after auth succeeds (post-auth routing uses live API, not React Query). */
export async function refreshPartnerSessionQueries(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.users.me() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.technicians.me() }),
  ]);
}
