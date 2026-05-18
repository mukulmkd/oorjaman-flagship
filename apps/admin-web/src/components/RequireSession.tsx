import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { useSupabase } from "../lib/supabase-context";
import "../pages/admin-login.css";

export function RequireSession({
  children,
  loginPath = "/login",
}: {
  children: ReactNode;
  /** Where unauthenticated users are sent (shared login page for staff and vendors). */
  loginPath?: string;
}) {
  const supabase = useSupabase();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  if (!supabase) {
    return (
      <p className="al-gate">Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.</p>
    );
  }
  if (loading) {
    return <p className="al-gate">Checking session…</p>;
  }
  if (!session) {
    return <Navigate to={loginPath} replace />;
  }
  return <>{children}</>;
}
