import type { BookingCustomerContactFields, BookingRow, Json } from "@oorjaman/api";
import {
  formattedSiteAddressFromJson,
  readBookingOpsMeta,
  readBookingRecipientMeta,
} from "@oorjaman/api";
import { formatDisplayDateTime } from "@oorjaman/utils";

type BookingContactRow = BookingRow & Partial<BookingCustomerContactFields>;

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
  const formatted = formattedSiteAddressFromJson(value as Json)
    .replace(/\n/g, ", ")
    .trim();
  return formatted || "Site address";
}

export function customerNameLabel(row: BookingContactRow): string {
  return row.customerDisplayName?.trim() || "Customer";
}

export function customerPhoneLabel(row: BookingContactRow): string {
  return row.customerContactPhone?.trim() || "";
}

export function onSiteContactLabel(row: BookingContactRow): string | null {
  const rec = readBookingRecipientMeta(row.metadata);
  if (!rec || rec.is_self) return null;
  return rec.recipient_name?.trim() || "Someone else";
}

export function serviceForLabel(row: BookingContactRow): string {
  return onSiteContactLabel(row) ?? customerNameLabel(row);
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
