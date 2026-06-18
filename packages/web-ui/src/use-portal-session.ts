import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import type { UserRow } from "@oorjaman/api";
import { authPhoneFromUser, queryKeys, resolvePortalSessionDisplay, userApi } from "@oorjaman/api";
import { useSupabase } from "./supabase-client";

export type PortalSession = {
  session: Session | null;
  row: UserRow | null;
  hint: string;
  chip: string;
};

const DEFAULT_UNSIGNED_HINT = "Sign in required.";

async function fetchPortalSession(
  supabase: NonNullable<ReturnType<typeof useSupabase>>,
  unsignedHint: string,
): Promise<PortalSession> {
  const { data } = await supabase.auth.getSession();
  const session = data.session ?? null;
  if (!session) {
    return { session: null, row: null, hint: unsignedHint, chip: "?" };
  }

  let row: UserRow | null = null;
  try {
    row = await userApi.getMyUserRecord(supabase);
  } catch {
    // Fall back to auth identity when public.users is missing or unreachable.
  }

  const display = resolvePortalSessionDisplay({
    authEmail: session.user.email,
    authPhone: authPhoneFromUser(session.user),
    authUserId: session.user.id,
    publicFullName: row?.full_name,
    publicEmail: row?.email,
  });

  return { session, row, ...display };
}

/** Session + optional public.users profile (admin dashboard chrome). */
export function usePortalSession(unsignedHint = DEFAULT_UNSIGNED_HINT) {
  const supabase = useSupabase();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!supabase) return;
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.auth.portalSession() });
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase, queryClient]);

  return useQuery({
    queryKey: queryKeys.auth.portalSession(),
    queryFn: () => fetchPortalSession(supabase!, unsignedHint),
    enabled: Boolean(supabase),
    staleTime: 5 * 60_000,
  });
}
