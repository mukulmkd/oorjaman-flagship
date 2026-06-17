import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@oorjaman/api";

/** Refetch only admin booking/ops views — not notification inbox, templates, or unrelated caches. */
export function invalidateAdminBookingOpsQueries(qc: QueryClient): Promise<void> {
  return qc.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey;
      if (!Array.isArray(key)) return false;
      const parts = key as unknown[];
      return (
        parts.includes("admin-bucket") ||
        parts.includes("admin-monitoring") ||
        parts.includes("admin-fallbacks") ||
        parts.includes("ops-exceptions") ||
        parts.includes("ops-desk-summary") ||
        parts.includes("ops-desk-amc-awaiting-partner")
      );
    },
  });
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
