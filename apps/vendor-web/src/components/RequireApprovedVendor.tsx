import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { vendorApi } from "@oorjaman/api";
import { useSupabase } from "../lib/supabase-context";
import "../pages/login.css";

/**
 * Renders children only when the current user has an **approved** vendor profile.
 * Otherwise redirects to `/` (pending / rejected / missing registration).
 */
export function RequireApprovedVendor({ children }: { children: ReactNode }) {
  const supabase = useSupabase();
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    if (!supabase) {
      setOk(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const v = await vendorApi.getMyVendor(supabase);
        if (cancelled) return;
        setOk(v?.approval_status === "approved");
      } catch {
        if (!cancelled) setOk(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  if (ok === null) {
    return <p className="al-gate">Loading vendor profile…</p>;
  }
  if (!ok) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
