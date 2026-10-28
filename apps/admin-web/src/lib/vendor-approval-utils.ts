import type { Json, VendorApprovalStatus } from "@oorjaman/api";
import { formatDisplayDateTime } from "@oorjaman/utils";

export type VendorTab = "pending" | "approved" | "rejected";

const REGISTERED_ADDRESS_FIELDS = [
  { key: "line1", label: "Address" },
  { key: "line2", label: "Address line 2" },
  { key: "city", label: "City" },
  { key: "district", label: "District" },
  { key: "state", label: "State" },
  { key: "pincode", label: "PIN code" },
  { key: "postal_code", label: "PIN code" },
  { key: "country", label: "Country" },
] as const;

function addressRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    } catch {
      return null;
    }
    return null;
  }
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return null;
}

function addressText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

export type RegisteredAddressField = { label: string; value: string };

/** Labelled lines for a partner registered address. Empty when nothing readable is stored. */
export function registeredAddressFields(value: unknown): RegisteredAddressField[] {
  if (typeof value === "string" && value.trim() && !addressRecord(value)) {
    return [{ label: "Address", value: value.trim() }];
  }
  const record = addressRecord(value);
  if (!record) return [];
  const fields: RegisteredAddressField[] = [];
  const seen = new Set<string>();
  for (const field of REGISTERED_ADDRESS_FIELDS) {
    if (seen.has(field.label)) continue;
    const text = addressText(record[field.key]);
    if (!text) continue;
    seen.add(field.label);
    fields.push({ label: field.label, value: text });
  }
  if (fields.length === 0) {
    const formatted = addressText(record.formatted);
    if (formatted) return [{ label: "Address", value: formatted }];
  }
  return fields;
}

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
