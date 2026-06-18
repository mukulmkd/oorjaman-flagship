import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { authApi, loadPortalSessionDisplay } from "@oorjaman/api";
import { DropdownMenu, DropdownMenuItem, PortalSidebarBrand } from "@oorjaman/web-ui";
import { SupportChatDock } from "../components/SupportChatDock";
import { SupportDeskRealtime } from "../components/SupportDeskRealtime";
import { ActiveChatProvider } from "../lib/active-chat-context";
import { adminPortalUrl } from "@oorjaman/web-ui";
import { useSupabase } from "@oorjaman/web-ui";
function navLinkClass({ isActive }: { isActive: boolean }): string {
  return isActive ? "dash-nav-active" : "";
}

export function SupportLayout() {
  const supabase = useSupabase();
  const navigate = useNavigate();
  const [sessionHint, setSessionHint] = useState("Checking session…");
  const [userChip, setUserChip] = useState("?");

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

  return (
    <ActiveChatProvider>
      <div className="dash-root" data-portal-persona="support">
        <aside className="dash-sidebar">
          <PortalSidebarBrand persona="support" />
          <nav className="dash-nav" aria-label="Support primary">
            <NavLink to="/insights" className={navLinkClass}>
              Insights
            </NavLink>
            <NavLink to="/inbox" className={navLinkClass}>
              Inbox
            </NavLink>
            <NavLink to="/search" className={navLinkClass}>
              Search
            </NavLink>
            <a href={adminPortalUrl("/dashboard/bookings")} target="_blank" rel="noreferrer">
              Operations console ↗
            </a>
          </nav>
        </aside>
        <div className="dash-main">
          <header className="dash-topbar">
            <span className="dash-topbar-title">Customer support</span>
            <div className="dash-topbar-right">
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
        <SupportDeskRealtime />
        <SupportChatDock />
      </div>
    </ActiveChatProvider>
  );
}
