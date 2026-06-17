import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { Navigate } from "react-router-dom";
import { authApi } from "@oorjaman/api";
import { PortalLoadingScreen } from "@oorjaman/web-ui";
import { useAdminPortalSession } from "../hooks/use-admin-portal-session";
import { useSupabase } from "../lib/supabase-client";

/**
 * Must render inside {@link RequireSession}. Ensures `public.users.role === admin` or signs out.
 */
export function RequireAdminRole({ children }: { children: ReactNode }) {
  const supabase = useSupabase();
  const sessionQuery = useAdminPortalSession();
  const signedOutRef = useRef(false);

  const allowed = sessionQuery.data?.row?.role === "admin";

  useEffect(() => {
    if (sessionQuery.isLoading || allowed || !supabase || signedOutRef.current) return;
    signedOutRef.current = true;
    void authApi.signOut(supabase);
  }, [sessionQuery.isLoading, allowed, supabase]);

  if (sessionQuery.isLoading) {
    return <PortalLoadingScreen label="Checking admin access…" />;
  }
  if (!allowed) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
