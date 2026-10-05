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

export function needsPartnerAssignment(
  row: Pick<BookingRow, "status" | "vendor_id">,
): boolean {
  return row.status === "confirmed" && !row.vendor_id;
}
