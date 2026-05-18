import type { BookingRow } from "@oorjaman/api";
import { readBookingOpsMeta, readBookingRecipientMeta } from "@oorjaman/api";
import { formatDisplayDateTime } from "@oorjaman/utils";

export function formatJobWhen(iso: string): string {
  return formatDisplayDateTime(iso);
}

export function formatJobDayKey(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

export function todayIstDayKey(): string {
  return formatJobDayKey(new Date().toISOString());
}

export function stringifyAddress(value: unknown): string {
  if (value == null) return "Address on file";
  if (typeof value === "string") return value.trim() || "Address on file";
  if (typeof value === "object" && value !== null && "formatted" in value) {
    const f = (value as { formatted?: unknown }).formatted;
    if (typeof f === "string" && f.trim()) return f;
  }
  try {
    const lines: string[] = [];
    const o = value as Record<string, unknown>;
    for (const k of ["line1", "line2", "city", "state", "postal_code"]) {
      const v = o[k];
      if (typeof v === "string" && v.trim()) lines.push(v.trim());
    }
    if (lines.length) return lines.join(", ");
  } catch {
    /* fall through */
  }
  return "Site address";
}

export function serviceForLabel(row: BookingRow): string {
  const rec = readBookingRecipientMeta(row.metadata);
  if (!rec || rec.is_self) return "Customer";
  return rec.recipient_name?.trim() || "Someone else";
}

export function opsWatchLabel(row: BookingRow): string | null {
  const ops = readBookingOpsMeta(row.metadata);
  if (!ops || ops.issue_count <= 0) return null;
  return "Ops watch";
}

export function preferredWorkCity(homeBase: unknown, preferred: string[] | null | undefined): string | null {
  if (preferred?.[0]?.trim()) return preferred[0].trim();
  if (homeBase && typeof homeBase === "object" && !Array.isArray(homeBase)) {
    const city = (homeBase as { city?: unknown }).city;
    if (typeof city === "string" && city.trim()) return city.trim();
  }
  return null;
}
