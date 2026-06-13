import type {
  BookingRow,
  OpsBookingExceptionRow,
  OpsIssueType,
} from "@oorjaman/api";
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
