import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { authApi, loadPortalSessionDisplay, vendorApi } from "@oorjaman/api";
import { DropdownMenu, DropdownMenuItem, PortalSidebarBrand } from "@oorjaman/web-ui";
import { VENDOR_DASH_TABS } from "../pages/vendor-dashboard/vendor-dash-tabs";
import { NotificationCenterBell } from "../components/NotificationCenterBell";
import { VendorBookingRealtime } from "../components/vendor-booking-realtime";
import { VendorSettlementRealtime } from "../components/vendor-settlement-realtime";
import { useSupabase } from "../lib/supabase-context";
export function VendorLayout() {
  const supabase = useSupabase();
  const navigate = useNavigate();
  const location = useLocation();
  const [sessionHint, setSessionHint] = useState<string>("Checking session…");
  const [userChip, setUserChip] = useState<string>("?");
  const [dashboardAllowed, setDashboardAllowed] = useState<boolean | null>(null);
  const [vendorId, setVendorId] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setSessionHint("Configure VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY");
      return;
    }
    void (async () => {
      const { hint, chip } = await loadPortalSessionDisplay(supabase);
      setSessionHint(hint);
      setUserChip(chip);
    })();
  }, [supabase]);

  useEffect(() => {
    if (!supabase) {
      setDashboardAllowed(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const v = await vendorApi.getMyVendor(supabase);
        if (cancelled) return;
        setVendorId(v?.id ?? null);
        setDashboardAllowed(v?.approval_status === "approved");
      } catch {
        if (!cancelled) setDashboardAllowed(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, location.pathname]);

  return (
    <div className="dash-root" data-portal-persona="partner">
      {vendorId && dashboardAllowed ? (
        <>
          <VendorBookingRealtime vendorId={vendorId} />
          <VendorSettlementRealtime vendorId={vendorId} />
        </>
      ) : null}
      <aside className="dash-sidebar">
        <PortalSidebarBrand persona="partner" />
        <nav className="dash-nav" aria-label="Vendor primary">
          <NavLink to="/" end className={({ isActive }) => (isActive ? "dash-nav-active" : "")}>
            Organisation &amp; application
          </NavLink>
          {dashboardAllowed ? (
            VENDOR_DASH_TABS.map((t) => (
              <NavLink
                key={t.id}
                to={`/dashboard/${t.id}`}
                className={({ isActive }) => (isActive ? "dash-nav-active" : "")}
              >
                {t.label}
              </NavLink>
            ))
          ) : (
            <span
              className="dash-nav-disabled"
              title="Available after your organisation is approved"
            >
              Dashboard sections unlock after approval
            </span>
          )}
        </nav>
      </aside>
      <div className="dash-main">
        <header className="dash-topbar">
          <span className="dash-topbar-title">Partner portal</span>
          <div className="dash-topbar-right">
            {vendorId ? <NotificationCenterBell audience="vendor" vendorId={vendorId} /> : null}
            <span className="dash-session" title={sessionHint}>
              {sessionHint}
            </span>
            <DropdownMenu
              ariaLabel="Account menu"
              align="end"
              trigger={
                <span className="dash-user-trigger-inner">
                  <span className="dash-user-chip">{userChip}</span>
                  <span className="dash-user-chevron" aria-hidden>
                    ▾
                  </span>
                </span>
              }
            >
              <DropdownMenuItem
                onClick={() => {
                  if (!supabase) return;
                  void authApi.signOut(supabase).then(() => navigate("/login", { replace: true }));
                }}
              >
                Logout
              </DropdownMenuItem>
            </DropdownMenu>
          </div>
        </header>
        <div className="dash-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
