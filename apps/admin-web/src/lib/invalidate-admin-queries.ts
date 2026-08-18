import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@oorjaman/api";

/**
 * Tokens identifying admin booking/ops views (paged + non-paged). Kept explicit so we
 * refetch every operational booking list but never the notification inbox/templates, which
 * live under the same `bookings.all()` key prefix.
 */
const ADMIN_BOOKING_OPS_TOKENS = [
  "admin-bucket",
  "admin-bucket-paged",
  "admin-monitoring",
  "admin-monitoring-paged",
  "admin-fallbacks",
  "admin-fallbacks-paged",
  "ops-exceptions",
  "ops-exceptions-paged",
  "ops-desk-summary",
  "ops-desk-amc-awaiting-partner",
] as const;

function isAdminBookingOpsKey(key: unknown): boolean {
  if (!Array.isArray(key)) return false;
  return (key as unknown[]).some(
    (part) =>
      typeof part === "string" &&
      (ADMIN_BOOKING_OPS_TOKENS as readonly string[]).includes(part),
  );
}

/** Refetch only admin booking/ops views — not notification inbox, templates, or unrelated caches. */
export function invalidateAdminBookingOpsQueries(qc: QueryClient): Promise<void> {
  return qc.invalidateQueries({ predicate: (query) => isAdminBookingOpsKey(query.queryKey) });
}

export function invalidateAdminBookingMonitoringQueries(
  qc: QueryClient,
  bucket?: string,
): Promise<void> {
  return qc.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey;
      if (!Array.isArray(key)) return false;
      const parts = key as unknown[];
      if (!parts.includes("admin-bucket")) return false;
      if (!bucket) return true;
      const bucketIndex = parts.indexOf("admin-bucket");
      return parts[bucketIndex + 1] === bucket;
    },
  });
}

export function invalidateAdminBookingRoutingQueries(qc: QueryClient): Promise<void> {
  return qc.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey;
      return Array.isArray(key) && (key as unknown[]).includes("admin-fallbacks");
    },
  });
}

export function invalidateAdminRenewalQueries(qc: QueryClient): Promise<void> {
  return Promise.all([
    qc.invalidateQueries({ queryKey: queryKeys.subscriptions.all() }),
    qc.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey;
        return Array.isArray(key) && (key as unknown[]).includes("notification-events");
      },
    }),
  ]).then(() => undefined);
}
