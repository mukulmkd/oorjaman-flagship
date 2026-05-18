import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { authApi, userApi } from "@oorjaman/api";
import { useSupabase } from "../lib/supabase-context";
import "../pages/admin-login.css";

/**
 * Must render inside {@link RequireSession}. Ensures `public.users.role === admin` or signs out.
 */
export function RequireAdminRole({ children }: { children: ReactNode }) {
  const supabase = useSupabase();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    if (!supabase) {
      setAllowed(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const row = await userApi.getMyUserRecord(supabase);
      if (cancelled) return;
      if (row?.role === "admin") {
        setAllowed(true);
      } else {
        await authApi.signOut(supabase);
        setAllowed(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  if (allowed === null) {
    return <p className="al-gate">Checking admin access…</p>;
  }
  if (!allowed) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}
