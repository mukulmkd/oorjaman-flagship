import type { Json, VendorApprovalStatus, VendorRow } from "@oorjaman/api";
import { formatDisplayDateTime } from "@oorjaman/utils";

export type VendorTab = "pending" | "approved" | "rejected";

/** Human-readable city from `registered_address` JSON or plain string. */
export function cityFromRegisteredAddress(value: unknown): string {
  if (value == null) return "-";
  if (typeof value === "string") {
    const t = value.trim();
    if (!t) return "-";
    try {
      const parsed = JSON.parse(t) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && "city" in parsed) {
        const c = (parsed as { city?: unknown }).city;
        if (typeof c === "string" && c.trim()) return c.trim();
      }
    } catch {
      return t;
    }
    return t;
  }
  if (typeof value === "object" && !Array.isArray(value) && value !== null && "city" in value) {
    const c = (value as { city?: unknown }).city;
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return "-";
}

/** One line for list columns: years + short experience text. */
export function formatVendorExperienceLine(v: VendorRow): string {
  const y = v.years_in_business;
  const yearsPart = y != null ? `${y} yr${y === 1 ? "" : "s"} in business` : null;
  const summary = v.experience_summary?.trim();
  const short = summary && summary.length > 90 ? `${summary.slice(0, 87)}…` : summary;
  const parts = [yearsPart, short].filter(Boolean);
  return parts.length ? parts.join(" · ") : "-";
}

/** One line from `vendor_registration_intake.form_data` (partner registration intake). */
export function formatIntakeExperienceLine(form: Json): string {
  const f = form && typeof form === "object" && !Array.isArray(form) ? (form as Record<string, unknown>) : {};
  const y = f.years_in_business;
  const yearsPart =
    y != null && y !== ""
      ? `${typeof y === "number" ? y : String(y)} yr(s) in business`
      : null;
  const summary = typeof f.experience_summary === "string" ? f.experience_summary.trim() : "";
  const short = summary && summary.length > 90 ? `${summary.slice(0, 87)}…` : summary;
  const parts = [yearsPart, short].filter(Boolean);
  return parts.length ? parts.join(" · ") : "-";
}

export function vendorApprovalListPath(tab: VendorTab): string {
  return `/dashboard/vendor-approval?tab=${encodeURIComponent(tab)}`;
}

export function parseVendorTab(raw: string | undefined): VendorTab {
  if (raw === "approved" || raw === "rejected") return raw;
  return "pending";
}

export function tabStatuses(tab: VendorTab): VendorApprovalStatus[] {
  switch (tab) {
    case "pending":
      return ["pending", "under_review"];
    case "approved":
      return ["approved"];
    case "rejected":
      return ["rejected", "suspended"];
    default:
      return ["pending", "under_review"];
  }
}

export function approvalBadgeTone(
  status: VendorApprovalStatus,
): "neutral" | "warning" | "success" | "danger" {
  switch (status) {
    case "approved":
      return "success";
    case "rejected":
    case "suspended":
      return "danger";
    case "pending":
    case "under_review":
      return "warning";
    default:
      return "neutral";
  }
}

export function formatSubmittedAt(iso: string): string {
  return formatDisplayDateTime(iso);
}
