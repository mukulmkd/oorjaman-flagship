import {
  readBookingVendorRoutingMeta,
  type BookingRow,
  type OpsIssueType,
} from "@oorjaman/api";
import type { Json } from "@oorjaman/api";

export const ROUTING_REASON_LABELS: Record<string, string> = {
  preferred_ok: "Preferred partner",
  preferred_ineligible_customer_fallback:
    "Preferred unavailable → customer backup",
  preferred_ineligible_platform_default:
    "Preferred unavailable → platform default",
  preferred_missing_customer_fallback: "No match → customer backup",
  preferred_missing_platform_default: "No match → platform default",
  default_vendor_marketplace: "Any partner (marketplace)",
  amc_awaiting_admin_marketplace: "AMC - awaiting marketplace",
};

export const PREFERRED_FALLBACK_ROUTING_HELP =
  "The customer chose a specific partner who could not serve this location. The visit was assigned to their backup partner or the platform default instead.";

export const MARKETPLACE_ROUTING_HELP =
  "The customer chose any available partner. The booking is in the partner marketplace (or awaiting ops assignment) until a partner claims it or you assign one.";

export type RoutingDisplayKind =
  | "preferred"
  | "partner_fallback"
  | "marketplace"
  | "none";

export type RoutingDisplay = {
  kind: RoutingDisplayKind;
  shortLabel: string;
  detail: string | null;
};

export function getRoutingDisplay(
  metadata: Json | null | undefined,
): RoutingDisplay {
  const routing = readBookingVendorRoutingMeta(metadata);
  if (!routing?.reason) {
    return { kind: "none", shortLabel: "-", detail: null };
  }

  const shortLabel = ROUTING_REASON_LABELS[routing.reason] ?? routing.reason;

  if (
    routing.reason === "default_vendor_marketplace" ||
    routing.reason === "amc_awaiting_admin_marketplace"
  ) {
    return {
      kind: "marketplace",
      shortLabel,
      detail: MARKETPLACE_ROUTING_HELP,
    };
  }

  if (routing.reason === "preferred_ok") {
    return { kind: "preferred", shortLabel, detail: null };
  }

  if (routing.usedFallback) {
    return {
      kind: "partner_fallback",
      shortLabel,
      detail: PREFERRED_FALLBACK_ROUTING_HELP,
    };
  }

  return { kind: "none", shortLabel, detail: null };
}

export function formatMarketplaceWindow(
  metadata: Json | null | undefined,
): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata))
    return null;
  const marketplace = (metadata as Record<string, unknown>).marketplace;
  if (
    !marketplace ||
    typeof marketplace !== "object" ||
    Array.isArray(marketplace)
  )
    return null;
  const mp = marketplace as Record<string, unknown>;
  if (mp.mode !== "default_vendor") return null;
  const floated = mp.floated === true;
  const openUntil = typeof mp.open_until === "string" ? mp.open_until : null;
  if (!floated && !openUntil) return "Marketplace mode (not yet floated)";
  if (openUntil) {
    try {
      return `Marketplace open until ${new Date(openUntil).toLocaleString("en-IN")}`;
    } catch {
      return "Marketplace window active";
    }
  }
  return floated ? "Floated to marketplace" : null;
}

export function formatRoutingDetailLines(
  row: Pick<BookingRow, "metadata" | "vendor_id">,
  vendorNameById?: Map<string, string>,
): { label: string; value: string }[] {
  const routing = readBookingVendorRoutingMeta(row.metadata);
  const lines: { label: string; value: string }[] = [];
  if (!routing) return lines;

  const name = (id: string | null) =>
    id ? (vendorNameById?.get(id) ?? `${id.slice(0, 8)}…`) : "-";

  lines.push({
    label: "Routing",
    value: ROUTING_REASON_LABELS[routing.reason ?? ""] ?? routing.reason ?? "-",
  });
  lines.push({
    label: "Requested partner",
    value: name(routing.requestedVendorId),
  });
  lines.push({
    label: "Resolved partner",
    value: name(routing.resolvedVendorId),
  });
  lines.push({ label: "Assigned on booking", value: name(row.vendor_id) });

  const mpLine = formatMarketplaceWindow(row.metadata);
  if (mpLine) lines.push({ label: "Marketplace", value: mpLine });

  return lines;
}

export const OPS_ISSUE_LABELS: Record<OpsIssueType, string> = {
  default_vendor_unclaimed: "Marketplace / default vendor unclaimed",
  awaiting_admin_float: "Awaiting ops marketplace float",
  preferred_vendor_no_response: "Preferred partner - no response (1h)",
  vendor_slow_confirmation: "Partner slow to accept/assign",
  visit_not_started: "Visit not started on time",
  visit_not_closed: "Visit not closed on time",
  schedule_missed: "Schedule window missed",
};
