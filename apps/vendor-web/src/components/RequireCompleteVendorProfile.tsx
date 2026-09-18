import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { vendorApi, vendorProfileIsComplete } from "@oorjaman/api";
import { PortalLoadingScreen, useSupabase } from "@oorjaman/web-ui";

type Props = {
  children: React.ReactNode;
};

/**
 * Blocks portal/dashboard until the partner finishes required organisation details.
 * Vendors with no row yet pass through (portal sends them to public signup).
 */
export function RequireCompleteVendorProfile({ children }: Props) {
  const supabase = useSupabase();
  const [state, setState] = useState<"loading" | "ok" | "incomplete" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setState("error");
      setError("Supabase is not configured.");
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const vendor = await vendorApi.getMyVendor(supabase);
        if (cancelled) return;
        if (!vendor) {
          setState("ok");
          return;
        }
        setState(vendorProfileIsComplete(vendor) ? "ok" : "incomplete");
      } catch (e: unknown) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Could not load vendor profile.");
        setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  if (state === "loading") {
    return <PortalLoadingScreen label="Checking partner profile…" />;
  }
  if (state === "incomplete") {
    return <Navigate to="/complete-profile" replace />;
  }
  if (state === "error") {
    return (
      <div className="dash-root" style={{ padding: "2rem" }}>
        <p>{error ?? "Something went wrong."}</p>
      </div>
    );
  }
  return <>{children}</>;
}
