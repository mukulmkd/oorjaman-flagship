import type {
  BookingRow,
  OpsBookingExceptionRow,
  OpsIssueType,
} from "@oorjaman/api";
import type { Json } from "@oorjaman/api";
import { OPS_ISSUE_LABELS } from "./booking-routing-display";

export function isOpsExceptionPastWindow(
  row: OpsBookingExceptionRow,
  now = new Date(),
): boolean {
  return new Date(row.scheduled_end).getTime() < now.getTime();
}

export function formatOpsIssueLevel(
  level: OpsBookingExceptionRow["issue_level"],
): string {
  if (level === "high") return "High";
  if (level === "medium") return "Medium";
  return "-";
}

export function formatOpsIssueType(issueType: string | null): string {
  if (!issueType) return "Operational exception";
  return OPS_ISSUE_LABELS[issueType as OpsIssueType] ?? issueType;
}

/** Confirmed bookings that can receive a direct partner assignment. */
export function canAssignPartnerForException(
  row: OpsBookingExceptionRow,
): boolean {
  if (row.status !== "confirmed") return false;
  if (isOpsExceptionPastWindow(row)) return false;
  return (
    row.issue_type === "default_vendor_unclaimed" ||
    row.issue_type === "awaiting_admin_float" ||
    row.issue_type === "schedule_missed" ||
    row.issue_type === "preferred_vendor_no_response" ||
    row.issue_type === "vendor_slow_confirmation"
  );
}

export function readMarketplaceWindow(metadata: Json | null | undefined): {
  openUntil: Date | null;
} {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata))
    return { openUntil: null };
  const marketplace = (metadata as Record<string, unknown>).marketplace;
  if (
    !marketplace ||
    typeof marketplace !== "object" ||
    Array.isArray(marketplace)
  )
    return { openUntil: null };
  const ou = (marketplace as Record<string, unknown>).open_until;
  if (typeof ou !== "string") return { openUntil: null };
  const d = new Date(ou);
  return { openUntil: Number.isFinite(d.getTime()) ? d : null };
}

export function canFloatToMarketplace(
  row: Pick<BookingRow, "metadata" | "vendor_id" | "status">,
): boolean {
  if (row.vendor_id) return false;
  if (row.status !== "confirmed") return false;
  const m = row.metadata;
  if (!m || typeof m !== "object" || Array.isArray(m)) return false;
  const marketplace = (m as Record<string, unknown>).marketplace;
  if (
    !marketplace ||
    typeof marketplace !== "object" ||
    Array.isArray(marketplace)
  )
    return false;
  const mp = marketplace as Record<string, unknown>;
  return mp.mode === "default_vendor" && mp.floated !== true;
}

export function canRefloatMarketplace(
  row: Pick<BookingRow, "metadata" | "vendor_id" | "status">,
): boolean {
  if (row.vendor_id) return false;
  if (row.status !== "confirmed") return false;
  const m = row.metadata;
  if (!m || typeof m !== "object" || Array.isArray(m)) return false;
  const marketplace = (m as Record<string, unknown>).marketplace;
  if (
    !marketplace ||
    typeof marketplace !== "object" ||
    Array.isArray(marketplace)
  )
    return false;
  const mp = marketplace as Record<string, unknown>;
  return mp.mode === "default_vendor" && mp.floated === true;
}

export function needsPartnerAssignment(
  row: Pick<BookingRow, "status" | "vendor_id">,
): boolean {
  return row.status === "confirmed" && !row.vendor_id;
}
