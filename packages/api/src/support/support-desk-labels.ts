import type { SupportResolutionTag } from "../database.types";

export function supportResolutionTagLabel(
  tag: SupportResolutionTag | null | undefined,
): string {
  switch (tag) {
    case "resolved":
      return "Resolved";
    case "escalated":
      return "Escalated to operations";
    case "duplicate":
      return "Duplicate";
    case "policy_limitation":
      return "Policy limitation";
    default:
      return "-";
  }
}

export function supportCloseReasonLabel(
  reason: string | null | undefined,
): string | null {
  if (!reason) return null;
  switch (reason) {
    case "resolved_by_admin":
      return "Closed by support";
    case "inactive_timeout":
      return "Closed automatically (inactivity)";
    default:
      return reason.replace(/_/g, " ");
  }
}

export function formatSupportCsatStars(rating: number): string {
  const n = Math.max(1, Math.min(5, Math.round(rating)));
  return "★".repeat(n) + "☆".repeat(5 - n);
}
