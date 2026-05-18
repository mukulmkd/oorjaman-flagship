import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  adminFetchBookingStats,
  adminFetchBookingsCreatedDaily,
  adminFetchRevenueStats,
  adminFetchSubscriptionStats,
  adminFetchVendorPerformance,
  analyticsPadBookingDailySeries,
  analyticsPadRevenueDailySeries,
  queryKeys,
  type RevenueDayPoint,
} from "@oorjaman/api";
import { colors } from "@oorjaman/config";
import { Button, Card, DashboardSkeleton, PageHeader } from "@oorjaman/web-ui";
import { useSupabase } from "../lib/supabase-context";
import { webTypography } from "../styles/typography";
import "./analytics-dashboard.css";

const CHART_DAYS = 90;
const VENDOR_TOP_N = 10;

const CHART_PRIMARY = colors.primary;
/** Navy-adjacent series contrast (brand “Man” side) */
const CHART_SECONDARY = "#246488";

function formatInrFromPaise(paise: number): string {
  const rupees = paise / 100;
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(rupees);
  } catch {
    return `₹${rupees.toFixed(0)}`;
  }
}

function formatCompact(n: number): string {
  try {
    return new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(n);
  } catch {
    return String(n);
  }
}

function truncateLabel(s: string, max = 28): string {
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function escapeCsvCell(v: string | number | null | undefined): string {
  const s = v == null ? "" : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadAnalyticsSnapshotCsv(payload: {
  bookingStats: { total_bookings: number; completed_bookings: number; pending_bookings: number };
  revenue: { total_revenue_cents: number };
  subscriptionStats: { active_subscriptions: number; upcoming_services: number };
  dailyBookings: { day: string; booking_count: number }[];
  vendorPerformance: {
    business_name: string;
    total_jobs: number;
    acceptance_rate: number | null;
    completion_rate: number | null;
  }[];
}): void {
  const lines: string[] = [];
  lines.push("section,metric,value");
  lines.push(`summary,total_bookings,${payload.bookingStats.total_bookings}`);
  lines.push(`summary,completed_bookings,${payload.bookingStats.completed_bookings}`);
  lines.push(`summary,pending_bookings,${payload.bookingStats.pending_bookings}`);
  lines.push(`summary,total_revenue_paise,${payload.revenue.total_revenue_cents}`);
  lines.push(`summary,active_subscriptions,${payload.subscriptionStats.active_subscriptions}`);
  lines.push(`summary,upcoming_subscription_visits,${payload.subscriptionStats.upcoming_services}`);
  lines.push("");
  lines.push("bookings_by_day,day,count");
  for (const d of payload.dailyBookings) {
    lines.push(["bookings_by_day", escapeCsvCell(d.day), escapeCsvCell(d.booking_count)].join(","));
  }
  lines.push("");
  lines.push("vendor_performance,business_name,total_jobs,acceptance_rate,completion_rate");
  for (const v of payload.vendorPerformance) {
    lines.push(
      [
        "vendor_performance",
        escapeCsvCell(v.business_name),
        escapeCsvCell(v.total_jobs),
        escapeCsvCell(v.acceptance_rate),
        escapeCsvCell(v.completion_rate),
      ].join(","),
    );
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `oorjaman-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function AnalyticsDashboardPage() {
  const supabase = useSupabase();

  const dashboardQuery = useQuery({
    queryKey: queryKeys.admin.analytics(),
    queryFn: async () => {
      if (!supabase) throw new Error("Supabase not configured");
      const [bookingStats, revenue, subscriptionStats, dailyBookings, vendorPerformance] = await Promise.all([
        adminFetchBookingStats(supabase),
        adminFetchRevenueStats(supabase),
        adminFetchSubscriptionStats(supabase),
        adminFetchBookingsCreatedDaily(supabase, { days: CHART_DAYS }),
        adminFetchVendorPerformance(supabase, { limit: VENDOR_TOP_N }),
      ]);
      return { bookingStats, revenue, subscriptionStats, dailyBookings, vendorPerformance };
    },
    enabled: Boolean(supabase),
  });

  const paddedDailyBookings = useMemo(() => {
    const raw = dashboardQuery.data?.dailyBookings ?? [];
    return analyticsPadBookingDailySeries(CHART_DAYS, raw);
  }, [dashboardQuery.data?.dailyBookings]);

  const paddedRevenue = useMemo((): RevenueDayPoint[] => {
    const raw = dashboardQuery.data?.revenue.revenue_per_day ?? [];
    return analyticsPadRevenueDailySeries(CHART_DAYS, raw);
  }, [dashboardQuery.data?.revenue.revenue_per_day]);

  const revenueSeries = useMemo(() => {
    return paddedRevenue.map((p) => ({
      day: p.day,
      revenueRupees: p.revenue_cents / 100,
    }));
  }, [paddedRevenue]);

  const bookingsSeries = useMemo(() => {
    return paddedDailyBookings.map((r) => ({
      day: r.day,
      bookings: Number(r.booking_count),
    }));
  }, [paddedDailyBookings]);

  /** CSV snapshots use the dense IST series so inactive days export as zeros. */
  const snapshotCsvData = useMemo(() => {
    if (!dashboardQuery.data) return null;
    return {
      ...dashboardQuery.data,
      dailyBookings: paddedDailyBookings,
    };
  }, [dashboardQuery.data, paddedDailyBookings]);

  const vendorBars = useMemo(() => {
    const rows = [...(dashboardQuery.data?.vendorPerformance ?? [])].sort(
      (a, b) => a.total_jobs - b.total_jobs,
    );
    return rows.map((v) => ({
      ...v,
      label: truncateLabel(v.business_name),
      acceptPct: v.acceptance_rate != null ? Math.round(v.acceptance_rate * 1000) / 10 : null,
      completePct: v.completion_rate != null ? Math.round(v.completion_rate * 1000) / 10 : null,
    }));
  }, [dashboardQuery.data?.vendorPerformance]);

  const axisTickStyle = { fill: "var(--wb-muted-fg, #78716c)", fontSize: webTypography.size.xs };

  return (
    <>
      <PageHeader
        title="Analytics"
        subtitle="Bookings, revenue, subscriptions, and partner performance across the platform."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              type="button"
              disabled={!snapshotCsvData}
              onClick={() => {
                if (snapshotCsvData) downloadAnalyticsSnapshotCsv(snapshotCsvData);
              }}
            >
              Export CSV
            </Button>
            <Button variant="outline" size="sm" type="button" onClick={() => void dashboardQuery.refetch()}>
              Refresh
            </Button>
          </>
        }
      />

      {!supabase ? (
        <Card padded>
          <p className="analytics-muted">Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.</p>
        </Card>
      ) : dashboardQuery.isPending ? (
        <DashboardSkeleton kpiCount={3} />
      ) : dashboardQuery.isError ? (
        <Card padded>
          <p className="analytics-error-title">Could not load analytics</p>
          <p className="analytics-muted">{(dashboardQuery.error as Error).message}</p>
          <Button variant="primary" size="sm" type="button" onClick={() => void dashboardQuery.refetch()}>
            Retry
          </Button>
        </Card>
      ) : (
        <div className="analytics-root">
          <section className="analytics-kpi-grid" aria-label="Key metrics">
            <article className="analytics-kpi">
              <p className="analytics-kpi-label">Total bookings</p>
              <p className="analytics-kpi-value">{formatCompact(dashboardQuery.data.bookingStats.total_bookings)}</p>
              <p className="analytics-kpi-hint">
                {formatCompact(dashboardQuery.data.bookingStats.completed_bookings)} completed ·{" "}
                {formatCompact(dashboardQuery.data.bookingStats.pending_bookings)} pending
              </p>
            </article>
            <article className="analytics-kpi">
              <p className="analytics-kpi-label">Revenue</p>
              <p className="analytics-kpi-value">{formatInrFromPaise(dashboardQuery.data.revenue.total_revenue_cents)}</p>
              <p className="analytics-kpi-hint">Successful payments (all time)</p>
            </article>
            <article className="analytics-kpi">
              <p className="analytics-kpi-label">Active subscriptions</p>
              <p className="analytics-kpi-value">
                {formatCompact(dashboardQuery.data.subscriptionStats.active_subscriptions)}
              </p>
              <p className="analytics-kpi-hint">
                {formatCompact(dashboardQuery.data.subscriptionStats.upcoming_services)} upcoming visits scheduled
              </p>
            </article>
          </section>

          <div className="analytics-charts">
            <Card padded className="analytics-chart-card">
              <h2 className="analytics-chart-title">Bookings over time</h2>
              <p className="analytics-chart-sub">New bookings per day (IST), last {CHART_DAYS} days.</p>
              <div className="analytics-chart-wrap">
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={bookingsSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="fillBookings" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={CHART_PRIMARY} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={CHART_PRIMARY} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--wb-border, #e7e5e4)" vertical={false} />
                    <XAxis
                      dataKey="day"
                      tick={axisTickStyle}
                      tickFormatter={(v) => (typeof v === "string" ? v.slice(5) : v)}
                      minTickGap={24}
                    />
                    <YAxis tick={axisTickStyle} width={36} allowDecimals={false} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.[0]) return null;
                        const v = payload[0].value;
                        const n = typeof v === "number" ? v : Number(v);
                        return (
                          <div className="analytics-tooltip">
                            <div className="analytics-tooltip-title">{label != null ? String(label) : ""}</div>
                            <div className="analytics-tooltip-line">Bookings · {Number.isFinite(n) ? n : "-"}</div>
                          </div>
                        );
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="bookings"
                      stroke={CHART_PRIMARY}
                      strokeWidth={2}
                      fill="url(#fillBookings)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card padded className="analytics-chart-card">
              <h2 className="analytics-chart-title">Revenue trend</h2>
              <p className="analytics-chart-sub">Successful payment volume per day (IST), last {CHART_DAYS} days.</p>
              <div className="analytics-chart-wrap">
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={revenueSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={CHART_SECONDARY} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={CHART_SECONDARY} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--wb-border, #e7e5e4)" vertical={false} />
                    <XAxis
                      dataKey="day"
                      tick={axisTickStyle}
                      tickFormatter={(v) => (typeof v === "string" ? v.slice(5) : v)}
                      minTickGap={24}
                    />
                    <YAxis
                      tick={axisTickStyle}
                      width={44}
                      tickFormatter={(v) => `₹${formatCompact(Number(v))}`}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.[0]) return null;
                        const v = payload[0].value;
                        const rupees = typeof v === "number" ? v : Number(v);
                        return (
                          <div className="analytics-tooltip">
                            <div className="analytics-tooltip-title">{label != null ? String(label) : ""}</div>
                            <div className="analytics-tooltip-line">
                              Revenue · {Number.isFinite(rupees) ? formatInrFromPaise(rupees * 100) : "-"}
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenueRupees"
                      stroke={CHART_SECONDARY}
                      strokeWidth={2}
                      fill="url(#fillRevenue)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card padded className="analytics-chart-card analytics-chart-card--wide">
              <h2 className="analytics-chart-title">Vendor performance</h2>
              <p className="analytics-chart-sub">
                Top {VENDOR_TOP_N} partners by job count - hover for acceptance & completion rates.
              </p>
              <div className="analytics-chart-wrap analytics-chart-wrap--tall">
                <ResponsiveContainer width="100%" height={Math.max(320, vendorBars.length * 36)}>
                  <BarChart
                    layout="vertical"
                    data={vendorBars}
                    margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
                    barCategoryGap={6}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--wb-border, #e7e5e4)" horizontal={false} />
                    <XAxis type="number" tick={axisTickStyle} allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={132}
                      tick={{ ...axisTickStyle, fontSize: webTypography.size.xs }}
                    />
                    <Tooltip
                      cursor={{ fill: "rgb(15 23 42 / 0.04)" }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.[0]) return null;
                        const p = payload[0].payload as {
                          business_name: string;
                          total_jobs: number;
                          acceptPct: number | null;
                          completePct: number | null;
                        };
                        return (
                          <div className="analytics-tooltip">
                            <div className="analytics-tooltip-title">{p.business_name}</div>
                            <div className="analytics-tooltip-line">Jobs · {p.total_jobs}</div>
                            {p.acceptPct != null ? (
                              <div className="analytics-tooltip-line">Acceptance · {p.acceptPct}%</div>
                            ) : null}
                            {p.completePct != null ? (
                              <div className="analytics-tooltip-line">Completion · {p.completePct}%</div>
                            ) : null}
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="total_jobs" fill={CHART_PRIMARY} radius={[0, 6, 6, 0]} maxBarSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
