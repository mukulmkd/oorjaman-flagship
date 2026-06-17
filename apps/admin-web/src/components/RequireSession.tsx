import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { PortalLoadingScreen } from "@oorjaman/web-ui";
import { useSupabase } from "../lib/supabase-client";
import { useAdminPortalSession } from "../hooks/use-admin-portal-session";

export function RequireSession({
  children,
  loginPath = "/login",
}: {
  children: ReactNode;
  /** Where unauthenticated users are sent (shared login page for staff and vendors). */
  loginPath?: string;
}) {
  const supabase = useSupabase();
  const sessionQuery = useAdminPortalSession();

  if (!supabase) {
    return (
      <p className="al-gate">Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.</p>
    );
  }
  if (sessionQuery.isLoading) {
    return <PortalLoadingScreen label="Checking session…" />;
  }
  if (!sessionQuery.data?.session) {
    return <Navigate to={loginPath} replace />;
  }
  return <>{children}</>;
}
