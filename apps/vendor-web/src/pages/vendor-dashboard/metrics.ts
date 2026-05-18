import type { BookingRow, JobReportRow } from "@oorjaman/api";

export function bookingValueCents(b: BookingRow): number {
  return b.final_price_cents ?? b.estimated_price_cents;
}

function vendorMetadataRecord(b: BookingRow): Record<string, unknown> | null {
  const m = b.metadata;
  if (!m || typeof m !== "object" || Array.isArray(m)) return null;
  return m as Record<string, unknown>;
}

export function countVendorDeclines(bookings: BookingRow[]): number {
  return bookings.filter((b) => {
    const m = vendorMetadataRecord(b);
    const vr = m?.vendor_rejection;
    return Boolean(vr && typeof vr === "object");
  }).length;
}

export function countAcceptedPipeline(bookings: BookingRow[]): number {
  return bookings.filter((b) =>
    ["accepted", "in_progress", "completed"].includes(b.status),
  ).length;
}

/** Approximate: accepted-or-later visits / (those + vendor declines). */
export function computeAcceptanceRatePercent(bookings: BookingRow[]): number | null {
  const declines = countVendorDeclines(bookings);
  const accepted = countAcceptedPipeline(bookings);
  const denom = accepted + declines;
  if (denom === 0) return null;
  return Math.round((100 * accepted) / denom);
}

export function computeAvgVendorResponseMinutes(bookings: BookingRow[]): number | null {
  const deltas: number[] = [];
  for (const b of bookings) {
    const m = vendorMetadataRecord(b);
    const va = m?.vendor_acceptance;
    if (!va || typeof va !== "object" || Array.isArray(va)) continue;
    const at = (va as Record<string, unknown>).accepted_at;
    if (typeof at !== "string") continue;
    const t0 = new Date(b.created_at).getTime();
    const t1 = new Date(at).getTime();
    if (!Number.isFinite(t0) || !Number.isFinite(t1) || t1 < t0) continue;
    deltas.push((t1 - t0) / 60_000);
  }
  if (!deltas.length) return null;
  return deltas.reduce((a, x) => a + x, 0) / deltas.length;
}

export function computeJobsPerTechnician(bookings: BookingRow[]): { technicianId: string; label: string; count: number }[] {
  const map = new Map<string, number>();
  for (const b of bookings) {
    if (!b.technician_id) continue;
    if (!["accepted", "in_progress", "completed"].includes(b.status)) continue;
    map.set(b.technician_id, (map.get(b.technician_id) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([technicianId, count]) => ({ technicianId, label: technicianId.slice(0, 8), count }))
    .sort((a, b) => b.count - a.count);
}

export function computeRatingStats(reports: JobReportRow[]): {
  avg: number | null;
  ratedCount: number;
  complaints: number;
} {
  const ratings = reports.map((r) => r.customer_rating).filter((x): x is number => typeof x === "number");
  const avg =
    ratings.length > 0 ? ratings.reduce((a, x) => a + x, 0) / ratings.length : null;
  const complaints = reports.filter((r) => Boolean(r.anomaly_notes?.trim())).length;
  return {
    avg,
    ratedCount: ratings.length,
    complaints,
  };
}

export function upcomingBookings(bookings: BookingRow[], withinDays = 7): BookingRow[] {
  const now = Date.now();
  const until = now + withinDays * 24 * 60 * 60 * 1000;
  return bookings.filter((b) => {
    const t = new Date(b.scheduled_start).getTime();
    if (t < now || t > until) return false;
    return ["confirmed", "accepted", "in_progress"].includes(b.status);
  }).sort((a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime());
}

/** Placeholder platform fee - replace with tenant config / pricing_rules. */
export const DEFAULT_PLATFORM_FEE_PERCENT = 10;

export function estimateNetAfterPlatformFee(cents: number, feePercent = DEFAULT_PLATFORM_FEE_PERCENT): number {
  return Math.round(cents * (1 - feePercent / 100));
}
