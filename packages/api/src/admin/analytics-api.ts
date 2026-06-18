import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../database.types";
import { takeRows, takeSingleRow } from "../result";

const ANALYTICS_IST_TIMEZONE = "Asia/Kolkata";

/** Admin business charts: daily (90d), monthly (24mo), quarterly (8q). */
export type AnalyticsBusinessPeriod = "daily" | "monthly" | "quarterly";

export const ANALYTICS_BUSINESS_PERIOD_LABELS: Record<AnalyticsBusinessPeriod, string> = {
  daily: "Daily",
  monthly: "Monthly",
  quarterly: "Quarterly",
};

export const ANALYTICS_PERIOD_DAY_WINDOW: Record<AnalyticsBusinessPeriod, number> = {
  daily: 90,
  monthly: 730,
  quarterly: 730,
};

export const ANALYTICS_PERIOD_BUCKET_COUNT: Record<AnalyticsBusinessPeriod, number> = {
  daily: 90,
  monthly: 24,
  quarterly: 8,
};

/** Longest daily fetch for admin charts (monthly/quarterly rollups). */
export const ANALYTICS_MAX_DAILY_FETCH_DAYS = 730;

export type AnalyticsPeriodSeriesPoint = {
  period: string;
  bookings: number;
  revenue_cents: number;
};

export type BookingStatsRow = Database["public"]["Views"]["booking_stats"]["Row"];
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

function istYearMonthKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ANALYTICS_IST_TIMEZONE,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value ?? "0000";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  return `${year}-${month}`;
}

/** Last N calendar months in IST (YYYY-MM), oldest first. */
export function analyticsIstMonthKeysAscending(monthCount: number): string[] {
  const n = Math.min(Math.max(monthCount, 2), 60);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setUTCHours(12, 0, 0, 0);
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() - i);
    out.push(istYearMonthKey(d));
  }
  return out;
}

function monthKeyFromDay(day: string): string {
  return day.slice(0, 7);
}

function quarterKeyFromDay(day: string): string {
  const y = day.slice(0, 4);
  const m = Number(day.slice(5, 7));
  if (!Number.isFinite(m) || m < 1 || m > 12) return y;
  return `${y}-Q${Math.ceil(m / 3)}`;
}

/** Last N fiscal quarters (IST calendar quarters), oldest first. */
export function analyticsIstQuarterKeysAscending(quarterCount: number): string[] {
  const n = Math.min(Math.max(quarterCount, 2), 24);
  const monthKeys = analyticsIstMonthKeysAscending(n * 3 + 2);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const mk of monthKeys) {
    const qk = quarterKeyFromDay(`${mk}-15`);
    if (seen.has(qk)) continue;
    seen.add(qk);
    out.push(qk);
  }
  return out.slice(-n);
}

function aggregateDailyValues(
  daily: Array<{ day: string; value: number }>,
  bucketKeys: string[],
  bucketKeyFn: (day: string) => string,
): number[] {
  const map = new Map<string, number>();
  for (const row of daily) {
    const key = bucketKeyFn(row.day);
    map.set(key, (map.get(key) ?? 0) + row.value);
  }
  return bucketKeys.map((k) => map.get(k) ?? 0);
}

/** Bookings + revenue aligned to daily / monthly / quarterly IST buckets. */
export function analyticsBuildBusinessPeriodSeries(
  period: AnalyticsBusinessPeriod,
  dailyBookings: Array<{ day: string; booking_count: number }>,
  dailyRevenue: RevenueDayPoint[],
): AnalyticsPeriodSeriesPoint[] {
  const dayCount = ANALYTICS_PERIOD_DAY_WINDOW[period];
  const paddedBookings = analyticsPadBookingDailySeries(dayCount, dailyBookings);
  const paddedRevenue = analyticsPadRevenueDailySeries(dayCount, dailyRevenue);

  const bookingValues = paddedBookings.map((r) => ({ day: r.day, value: Number(r.booking_count) || 0 }));
  const revenueValues = paddedRevenue.map((r) => ({ day: r.day, value: r.revenue_cents }));

  if (period === "daily") {
    return paddedBookings.map((r, i) => ({
      period: r.day,
      bookings: bookingValues[i]?.value ?? 0,
      revenue_cents: revenueValues[i]?.value ?? 0,
    }));
  }

  if (period === "monthly") {
    const keys = analyticsIstMonthKeysAscending(ANALYTICS_PERIOD_BUCKET_COUNT.monthly);
    const bookings = aggregateDailyValues(bookingValues, keys, monthKeyFromDay);
    const revenue = aggregateDailyValues(revenueValues, keys, monthKeyFromDay);
    return keys.map((periodKey, i) => ({
      period: periodKey,
      bookings: bookings[i] ?? 0,
      revenue_cents: revenue[i] ?? 0,
    }));
  }

  const keys = analyticsIstQuarterKeysAscending(ANALYTICS_PERIOD_BUCKET_COUNT.quarterly);
  const bookings = aggregateDailyValues(bookingValues, keys, quarterKeyFromDay);
  const revenue = aggregateDailyValues(revenueValues, keys, quarterKeyFromDay);
  return keys.map((periodKey, i) => ({
    period: periodKey,
    bookings: bookings[i] ?? 0,
    revenue_cents: revenue[i] ?? 0,
  }));
}

export function analyticsFormatPeriodAxisLabel(period: AnalyticsBusinessPeriod, periodKey: string): string {
  if (period === "daily") return periodKey.slice(5);
  if (period === "monthly") {
    const [y, m] = periodKey.split("-");
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const idx = Number(m) - 1;
    return idx >= 0 && idx < 12 ? `${monthNames[idx]} ${y?.slice(2) ?? ""}` : periodKey;
  }
  return periodKey.replace("-", " ");
}

export function analyticsPeriodChartSubtitle(period: AnalyticsBusinessPeriod): string {
  switch (period) {
    case "daily":
      return `New bookings and recognized revenue per day (IST), last ${ANALYTICS_PERIOD_DAY_WINDOW.daily} days.`;
    case "monthly":
      return `Totals per calendar month (IST), last ${ANALYTICS_PERIOD_BUCKET_COUNT.monthly} months.`;
    case "quarterly":
      return `Totals per calendar quarter (IST), last ${ANALYTICS_PERIOD_BUCKET_COUNT.quarterly} quarters.`;
    default:
      return "";
  }
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

async function fetchRevenueStatsRow(
  client: SupabaseClient<Database>,
  view: "recognized_revenue_stats" | "revenue_stats",
): Promise<{ total_revenue_cents: number; revenue_per_day: RevenueDayPoint[] }> {
  const { data, error } = await client.from(view).select("*").single();
  const row = takeSingleRow(data, error) as { total_revenue_cents: number; revenue_per_day: Json | null };
  return {
    total_revenue_cents: Number(row.total_revenue_cents) || 0,
    revenue_per_day: parseRevenuePerDay(row.revenue_per_day),
  };
}

export type RecognizedRevenueStats = {
  total_revenue_cents: number;
  amc_revenue_cents: number;
  one_time_revenue_cents: number;
  revenue_per_day: RevenueDayPoint[];
};

export type FinanceDashboardStats = RecognizedRevenueStats & {
  total_collections_cents: number;
  amc_contract_collections_cents: number;
  amc_deferred_liability_paise: number;
  amc_vendor_payables_pending_paise: number;
  one_time_vendor_payables_pending_paise: number;
};

/** Settled platform fees (visit payouts + penalties) + customer late-cancel fees. */
export async function adminFetchRecognizedRevenueStats(
  client: SupabaseClient<Database>,
): Promise<RecognizedRevenueStats> {
  const { data, error } = await client.from("recognized_revenue_stats").select("*").single();
  const row = takeSingleRow(data, error) as {
    total_revenue_cents: number;
    amc_revenue_cents?: number;
    one_time_revenue_cents?: number;
    revenue_per_day: Json | null;
  };
  return {
    total_revenue_cents: Number(row.total_revenue_cents) || 0,
    amc_revenue_cents: Number(row.amc_revenue_cents) || 0,
    one_time_revenue_cents: Number(row.one_time_revenue_cents) || 0,
    revenue_per_day: parseRevenuePerDay(row.revenue_per_day),
  };
}

/** Finance tab KPIs: collections, settled revenue split, AMC liability, vendor payables. */
export async function adminFetchFinanceDashboardStats(
  client: SupabaseClient<Database>,
): Promise<FinanceDashboardStats> {
  const { data, error } = await client.from("finance_dashboard_stats").select("*").single();
  const row = takeSingleRow(data, error) as {
    total_revenue_cents: number;
    amc_revenue_cents?: number;
    one_time_revenue_cents?: number;
    revenue_per_day: Json | null;
    total_collections_cents?: number;
    amc_contract_collections_cents?: number;
    amc_deferred_liability_paise?: number;
    amc_vendor_payables_pending_paise?: number;
    one_time_vendor_payables_pending_paise?: number;
  };
  return {
    total_revenue_cents: Number(row.total_revenue_cents) || 0,
    amc_revenue_cents: Number(row.amc_revenue_cents) || 0,
    one_time_revenue_cents: Number(row.one_time_revenue_cents) || 0,
    revenue_per_day: parseRevenuePerDay(row.revenue_per_day),
    total_collections_cents: Number(row.total_collections_cents) || 0,
    amc_contract_collections_cents: Number(row.amc_contract_collections_cents) || 0,
    amc_deferred_liability_paise: Number(row.amc_deferred_liability_paise) || 0,
    amc_vendor_payables_pending_paise: Number(row.amc_vendor_payables_pending_paise) || 0,
    one_time_vendor_payables_pending_paise: Number(row.one_time_vendor_payables_pending_paise) || 0,
  };
}

/** Successful payment gateway totals (all successful payments). */
export async function adminFetchPaymentStats(client: SupabaseClient<Database>): Promise<{
  total_payments_cents: number;
  payments_per_day: RevenueDayPoint[];
}> {
  const row = await fetchRevenueStatsRow(client, "revenue_stats");
  return {
    total_payments_cents: row.total_revenue_cents,
    payments_per_day: row.revenue_per_day,
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
