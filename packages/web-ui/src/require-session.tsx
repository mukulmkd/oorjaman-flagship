import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { PortalLoadingScreen } from "./portal-loading";
import { useSupabase } from "./supabase-client";
import { useAuthSession } from "./use-auth-session";
import { usePortalSession } from "./use-portal-session";

type Props = {
  children: ReactNode;
  loginPath?: string;
  /** Load public.users profile via React Query (admin console). */
  withProfile?: boolean;
  unsignedHint?: string;
};

function RequireSessionWithProfile({
  children,
  loginPath,
  unsignedHint,
}: {
  children: ReactNode;
  loginPath: string;
  unsignedHint: string;
}) {
  const supabase = useSupabase();
  const sessionQuery = usePortalSession(unsignedHint);

  if (!supabase) {
    return <p className="al-gate">Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.</p>;
  }
  if (sessionQuery.isLoading) {
    return <PortalLoadingScreen label="Checking session…" />;
  }
  if (!sessionQuery.data?.session) {
    return <Navigate to={loginPath} replace />;
  }
  return <>{children}</>;
}

function RequireSessionAuthOnly({
  children,
  loginPath,
}: {
  children: ReactNode;
  loginPath: string;
}) {
  const { supabase, session, loading } = useAuthSession();

  if (!supabase) {
    return <p className="al-gate">Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.</p>;
  }
  if (loading) {
    return <PortalLoadingScreen label="Checking session…" />;
  }
  if (!session) {
    return <Navigate to={loginPath} replace />;
  }
  return <>{children}</>;
}

export function RequireSession({
  children,
  loginPath = "/login",
  withProfile = false,
  unsignedHint = "Sign in required - use Supabase Auth (admin role in public.users).",
}: Props) {
  if (withProfile) {
    return (
      <RequireSessionWithProfile loginPath={loginPath} unsignedHint={unsignedHint}>
        {children}
      </RequireSessionWithProfile>
    );
  }
  return <RequireSessionAuthOnly loginPath={loginPath}>{children}</RequireSessionAuthOnly>;
}
