export const VENDOR_DASH_TABS = [
  { id: "overview", label: "Overview" },
  { id: "operations", label: "Operations" },
  { id: "insights", label: "Insights" },
  { id: "finance", label: "Finance" },
  { id: "team", label: "Team" },
  { id: "history", label: "Bookings" },
  { id: "communication", label: "Messages" },
  { id: "settings", label: "Settings" },
] as const;

export type VendorDashTabId = (typeof VENDOR_DASH_TABS)[number]["id"];

export function isVendorDashTabId(id: string | undefined): id is VendorDashTabId {
  return (
    id !== undefined &&
    (VENDOR_DASH_TABS as readonly { id: string }[]).some((t) => t.id === id)
  );
}

/** Default segment when opening the dashboard. */
export const VENDOR_DASH_DEFAULT_TAB: VendorDashTabId = "overview";
