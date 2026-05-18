import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { authApi, supportApi, userApi } from "@oorjaman/api";
import { useSupabase } from "../lib/supabase-context";
import "../pages/login.css";

/**
 * Must render inside {@link RequireSession}. Allows `admin` or `support` desk roles.
 */
export function RequireSupportDeskRole({ children }: { children: ReactNode }) {
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
      if (row && supportApi.isSupportDeskRole(row.role)) {
        if (row.role === "support") {
          await supportApi.ensureMySupportAgent(supabase);
        }
        setAllowed(true);
        return;
      }
      await authApi.signOut(supabase);
      setAllowed(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  if (allowed === null) {
    return <p className="al-gate">Checking support desk access…</p>;
  }
  if (!allowed) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}
