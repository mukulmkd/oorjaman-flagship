import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { authApi, userApi } from "@oorjaman/api";
import { useSupabase } from "../lib/supabase-context";
import { adminPortalUrl } from "../lib/portal-urls";
import "../pages/login.css";

type Gate = "loading" | "vendor" | "admin" | "unauthorized";

/**
 * Session must exist (parent should use {@link RequireSession} with the same `loginPath` as staff, e.g. `/login`).
 * Allows `vendor`; sends `admin` to the admin dashboard; signs out others and sends them to login.
 */
export function RequireVendorRole({ children }: { children: ReactNode }) {
  const supabase = useSupabase();
  const [gate, setGate] = useState<Gate>("loading");

  useEffect(() => {
    if (!supabase) {
      setGate("unauthorized");
      return;
    }
    let cancelled = false;
    void (async () => {
      const row = await userApi.getMyUserRecord(supabase);
      if (cancelled) return;
      if (!row) {
        setGate("unauthorized");
        return;
      }
      if (row.role === "admin") {
        setGate("admin");
        return;
      }
      if (row.role === "vendor") {
        setGate("vendor");
        return;
      }
      await authApi.signOut(supabase);
      setGate("unauthorized");
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  if (gate === "loading") {
    return <p className="al-gate">Checking access…</p>;
  }
  if (gate === "admin") {
    window.location.replace(adminPortalUrl("/dashboard/analytics"));
    return <p className="al-gate">Redirecting to operations console…</p>;
  }
  if (gate !== "vendor") {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}
