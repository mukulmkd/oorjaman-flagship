import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { Navigate } from "react-router-dom";
import { authApi, isOperationsPortalRole, isNationalAdminRole } from "@oorjaman/api";
import { PortalLoadingScreen } from "@oorjaman/web-ui";
import { useAdminPortalSession } from "@oorjaman/web-ui";
import { useSupabase } from "@oorjaman/web-ui";

/**
 * Must render inside {@link RequireSession}. Operations portal: national admin or a state desk.
 */
export function RequireAdminRole({ children }: { children: ReactNode }) {
  const supabase = useSupabase();
  const sessionQuery = useAdminPortalSession();
  const signedOutRef = useRef(false);

  const allowed = isOperationsPortalRole(sessionQuery.data?.row?.role);

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

/** Pricing, templates, and staff assignment stay with national admins. */
export function RequireNationalAdmin({ children }: { children: ReactNode }) {
  const sessionQuery = useAdminPortalSession();
  if (sessionQuery.isLoading) {
    return <PortalLoadingScreen label="Checking admin access…" />;
  }
  if (!isNationalAdminRole(sessionQuery.data?.row?.role)) {
    return <Navigate to="/dashboard/operations" replace />;
  }
  return <>{children}</>;
}
