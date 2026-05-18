import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { authApi } from "@oorjaman/api";
import { DropdownMenu, DropdownMenuItem } from "@oorjaman/web-ui";
import { NotificationCenterBell } from "../components/NotificationCenterBell";
import { supportPortalUrl } from "../lib/portal-urls";
import { useSupabase } from "../lib/supabase-context";
import "./dashboard-layout.css";

export function DashboardLayout() {
  const supabase = useSupabase();
  const navigate = useNavigate();
  const location = useLocation();
  const [sessionHint, setSessionHint] = useState<string>("Checking session…");
  const [userChip, setUserChip] = useState<string>("?");
  const vendorApprovalNavActive =
    location.pathname.startsWith("/dashboard/vendor-approval") ||
    location.pathname.startsWith("/dashboard/vendor-registration");
  const technicianNavActive = location.pathname.startsWith("/dashboard/technicians") ||
    location.pathname.startsWith("/dashboard/technicians/");
  const vendorsNavActive =
    location.pathname.startsWith("/dashboard/vendors") &&
    !vendorApprovalNavActive &&
    !technicianNavActive;
  const routingNavActive = location.pathname.startsWith("/dashboard/booking-routing");
  const operationsNavActive = location.pathname.startsWith("/dashboard/operations");
  const bookingsNavActive = location.pathname.startsWith("/dashboard/bookings");
  const notificationsNavActive = location.pathname.startsWith("/dashboard/notifications");
  const renewalNavActive = location.pathname.startsWith("/dashboard/subscription-renewals");
  const pricingNavActive =
    location.pathname.startsWith("/dashboard/pricing") ||
    location.pathname.startsWith("/dashboard/service-pricing");
  const analyticsNavActive = location.pathname.startsWith("/dashboard/analytics");
  const featureMgmtNavActive = location.pathname.startsWith("/dashboard/feature-management");
  useEffect(() => {
    if (!supabase) {
      setSessionHint("Configure VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY");
      return;
    }
    void supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user;
      if (!u) {
        setSessionHint("Sign in required - use Supabase Auth (admin role in public.users).");
        setUserChip("?");
        return;
      }
      const email = u.email ?? u.phone ?? u.id.slice(0, 8);
      setSessionHint(`${email}`);
      const chipSource = (u.email ?? u.phone ?? u.id).trim();
      setUserChip(chipSource ? chipSource.slice(0, 2).toUpperCase() : "?");
    });
  }, [supabase]);

  return (
    <div className="dash-root">
      <aside className="dash-sidebar">
        <div className="dash-brand">
          Oorjaman
          <span>Operations</span>
        </div>
        <nav className="dash-nav" aria-label="Primary">
          <Link to="/dashboard/analytics" className={analyticsNavActive ? "dash-nav-active" : ""}>
            Analytics
          </Link>
          <Link
            to="/dashboard/vendor-approval"
            className={vendorApprovalNavActive ? "dash-nav-active" : ""}
          >
            Vendor approval
          </Link>
          <Link
            to="/dashboard/vendors/pending"
            className={vendorsNavActive ? "dash-nav-active" : ""}
          >
            All vendors
          </Link>
          <Link
            to="/dashboard/technicians"
            className={technicianNavActive ? "dash-nav-active" : ""}
          >
            Technicians
          </Link>
          <Link
            to="/dashboard/booking-routing"
            className={routingNavActive ? "dash-nav-active" : ""}
          >
            Booking routing
          </Link>
          <Link
            to="/dashboard/operations"
            className={operationsNavActive ? "dash-nav-active" : ""}
          >
            Operations control
          </Link>
          <Link to="/dashboard/bookings" className={bookingsNavActive ? "dash-nav-active" : ""}>
            Bookings
          </Link>
          <a href={supportPortalUrl("/inbox")} target="_blank" rel="noreferrer">
            Support desk ↗
          </a>
          <Link to="/dashboard/notifications" className={notificationsNavActive ? "dash-nav-active" : ""}>
            Notifications templates
          </Link>
          <Link to="/dashboard/feature-management" className={featureMgmtNavActive ? "dash-nav-active" : ""}>
            Feature management
          </Link>
          <Link to="/dashboard/subscription-renewals" className={renewalNavActive ? "dash-nav-active" : ""}>
            Renewal nudges
          </Link>
          <Link to="/dashboard/service-pricing" className={pricingNavActive ? "dash-nav-active" : ""}>
            Service pricing
          </Link>
        </nav>
      </aside>
      <div className="dash-main">
        <header className="dash-topbar">
          <span className="dash-topbar-title">Dashboard</span>
          <div className="dash-topbar-right">
            <NotificationCenterBell audience="admin" />
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
