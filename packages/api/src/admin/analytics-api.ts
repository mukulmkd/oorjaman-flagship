import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../database.types";
import { takeRows, takeSingleRow } from "../result";

const ANALYTICS_IST_TIMEZONE = "Asia/Kolkata";

export type BookingStatsRow = Database["public"]["Views"]["booking_stats"]["Row"];
export type RevenueStatsRow = Database["public"]["Views"]["revenue_stats"]["Row"];
export type SubscriptionStatsRow = Database["public"]["Views"]["subscription_stats"]["Row"];
export type BookingsCreatedDailyRow = Database["public"]["Views"]["bookings_created_daily"]["Row"];
export type RevenueDayPoint = { day: string; revenue_cents: number };

/** Consecutive IST calendar dates, oldest-first (matches SQL day bucketing in analytics views). */
export function analyticsIstInclusiveDateRangeAscending(dayCount: number): string[] {
  const n = Math.min(Math.max(dayCount, 2), 800);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setUTCHours(12, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - i);
    out.push(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: ANALYTICS_IST_TIMEZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(d),
    );
  }
  return out;
}

/** Sparse SQL rows → dense series including zero-activity IST days so charts span the whole window. */
export function analyticsPadBookingDailySeries(
  dayCount: number,
  rows: Pick<BookingsCreatedDailyRow, "day" | "booking_count">[],
): Array<{ day: string; booking_count: number }> {
  const labels = analyticsIstInclusiveDateRangeAscending(dayCount);
  const map = new Map(rows.map((r) => [r.day, Number(r.booking_count) || 0]));
  return labels.map((day) => ({ day, booking_count: map.get(day) ?? 0 }));
}

export function analyticsPadRevenueDailySeries(dayCount: number, points: RevenueDayPoint[]): RevenueDayPoint[] {
  const labels = analyticsIstInclusiveDateRangeAscending(dayCount);
  const labelSet = new Set(labels);
  const map = new Map<string, number>();
  for (const p of points) {
    if (labelSet.has(p.day)) map.set(p.day, p.revenue_cents);
  }
  return labels.map((day) => ({ day, revenue_cents: map.get(day) ?? 0 }));
}

export type VendorPerformanceRow = {
  vendor_id: string;
  business_name: string;
  total_jobs: number;
  acceptance_rate: number | null;
  completion_rate: number | null;
};

function parseRevenuePerDay(raw: Json | null): RevenueDayPoint[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) return [];
  const out: RevenueDayPoint[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const o = item as Record<string, unknown>;
    const day = o.day;
    const revenue_cents = o.revenue_cents;
    if (typeof day !== "string") continue;
    const cents =
      typeof revenue_cents === "number"
        ? revenue_cents
        : typeof revenue_cents === "string"
          ? Number(revenue_cents)
          : NaN;
    if (!Number.isFinite(cents)) continue;
    out.push({ day, revenue_cents: cents });
  }
  return out.sort((a, b) => a.day.localeCompare(b.day));
}

export async function adminFetchBookingStats(client: SupabaseClient<Database>): Promise<BookingStatsRow> {
  const { data, error } = await client.from("booking_stats").select("*").single();
  return takeSingleRow(data, error);
}

export async function adminFetchRevenueStats(client: SupabaseClient<Database>): Promise<{
  total_revenue_cents: number;
  revenue_per_day: RevenueDayPoint[];
}> {
  const { data, error } = await client.from("revenue_stats").select("*").single();
  const row = takeSingleRow(data, error);
  return {
    total_revenue_cents: row.total_revenue_cents,
    revenue_per_day: parseRevenuePerDay(row.revenue_per_day),
  };
}

export async function adminFetchSubscriptionStats(client: SupabaseClient<Database>): Promise<SubscriptionStatsRow> {
  const { data, error } = await client.from("subscription_stats").select("*").single();
  return takeSingleRow(data, error);
}

/** Last `days` calendar days (IST) of booking volume - ascending by day. */
export async function adminFetchBookingsCreatedDaily(
  client: SupabaseClient<Database>,
  options?: { days?: number },
): Promise<BookingsCreatedDailyRow[]> {
  const days = Math.min(Math.max(options?.days ?? 90, 7), 730);
  const windowDays = analyticsIstInclusiveDateRangeAscending(days);
  const isoDay = windowDays[0]!;

  const { data, error } = await client
    .from("bookings_created_daily")
    .select("day, booking_count")
    .gte("day", isoDay)
    .order("day", { ascending: true });

  return takeRows(data, error);
}

/** Top vendors by job count with display names (admin RLS). */
export async function adminFetchVendorPerformance(
  client: SupabaseClient<Database>,
  options?: { limit?: number },
): Promise<VendorPerformanceRow[]> {
  const limit = Math.min(Math.max(options?.limit ?? 10, 3), 50);

  const { data: stats, error: statsError } = await client
    .from("vendor_stats")
    .select("vendor_id, total_jobs, acceptance_rate, completion_rate")
    .order("total_jobs", { ascending: false })
    .limit(limit);

  const statRows = takeRows(stats, statsError);
  if (statRows.length === 0) return [];

  const ids = statRows.map((s) => s.vendor_id);
  const { data: vendors, error: vErr } = await client.from("vendors").select("id, business_name").in("id", ids);
  const vendorRows = takeRows(vendors, vErr);
  const nameById = new Map(vendorRows.map((v) => [v.id, v.business_name]));

  return statRows.map((s) => ({
    vendor_id: s.vendor_id,
    business_name: nameById.get(s.vendor_id)?.trim() || `Vendor ${s.vendor_id.slice(0, 8)}`,
    total_jobs: s.total_jobs,
    acceptance_rate:
      s.acceptance_rate == null ? null : typeof s.acceptance_rate === "number" ? s.acceptance_rate : Number(s.acceptance_rate),
    completion_rate:
      s.completion_rate == null ? null : typeof s.completion_rate === "number" ? s.completion_rate : Number(s.completion_rate),
  }));
}
