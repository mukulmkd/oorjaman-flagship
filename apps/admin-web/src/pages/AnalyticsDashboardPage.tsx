import { useMemo, useState } from "react";
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
  adminFetchPaymentStats,
  adminFetchRecognizedRevenueStats,
  adminGetPlatformSettings,
  adminFetchSubscriptionStats,
  normalizeVendorPlatformFeePercent,
  adminFetchVendorPerformance,
  ANALYTICS_BUSINESS_PERIOD_LABELS,
  ANALYTICS_MAX_DAILY_FETCH_DAYS,
  analyticsBuildBusinessPeriodSeries,
  analyticsFormatPeriodAxisLabel,
  analyticsPeriodChartSubtitle,
  queryKeys,
  type AnalyticsBusinessPeriod,
} from "@oorjaman/api";
import { colors } from "@oorjaman/config";
import { Button, Card, DashboardSkeleton, PageHeader } from "@oorjaman/web-ui";
import { NotificationPlatformHealth } from "../components/NotificationPlatformHealth";
import { useSupabase } from "../lib/supabase-context";
import { webTypography } from "../styles/typography";
import "./analytics-dashboard.css";

const VENDOR_TOP_N = 10;
const PERIOD_ORDER: AnalyticsBusinessPeriod[] = ["daily", "monthly", "quarterly"];

const CHART_PRIMARY = colors.primary;
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
  period: AnalyticsBusinessPeriod;
  bookingStats: { total_bookings: number; completed_bookings: number; pending_bookings: number };
  recognizedRevenue: { total_revenue_cents: number };
  payments: { total_payments_cents: number };
  subscriptionStats: { active_subscriptions: number; upcoming_services: number };
  periodSeries: { period: string; bookings: number; revenue_cents: number }[];
  vendorPerformance: {
    business_name: string;
    total_jobs: number;
    acceptance_rate: number | null;
    completion_rate: number | null;
  }[];
}): void {
  const lines: string[] = [];
  lines.push("section,metric,value");
  lines.push(`summary,chart_period,${payload.period}`);
  lines.push(`summary,total_bookings,${payload.bookingStats.total_bookings}`);
  lines.push(`summary,completed_bookings,${payload.bookingStats.completed_bookings}`);
  lines.push(`summary,pending_bookings,${payload.bookingStats.pending_bookings}`);
  lines.push(`summary,recognized_revenue_paise,${payload.recognizedRevenue.total_revenue_cents}`);
  lines.push(`summary,total_payments_paise,${payload.payments.total_payments_cents}`);
  lines.push(`summary,active_subscriptions,${payload.subscriptionStats.active_subscriptions}`);
  lines.push(`summary,upcoming_subscription_visits,${payload.subscriptionStats.upcoming_services}`);
  lines.push("");
  lines.push("business_series,period,bookings,revenue_paise");
  for (const row of payload.periodSeries) {
    lines.push(
      ["business_series", escapeCsvCell(row.period), escapeCsvCell(row.bookings), escapeCsvCell(row.revenue_cents)].join(
        ",",
      ),
    );
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
  a.download = `oorjaman-analytics-${payload.period}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function AnalyticsDashboardPage() {
  const supabase = useSupabase();
  const [chartPeriod, setChartPeriod] = useState<AnalyticsBusinessPeriod>("daily");

  const dashboardQuery = useQuery({
    queryKey: queryKeys.admin.bookingsDaily(ANALYTICS_MAX_DAILY_FETCH_DAYS),
    queryFn: async () => {
      if (!supabase) throw new Error("Supabase not configured");
      const [bookingStats, recognizedRevenue, payments, platformSettings, subscriptionStats, dailyBookings, vendorPerformance] =
        await Promise.all([
          adminFetchBookingStats(supabase),
          adminFetchRecognizedRevenueStats(supabase),
          adminFetchPaymentStats(supabase),
          adminGetPlatformSettings(supabase),
          adminFetchSubscriptionStats(supabase),
          adminFetchBookingsCreatedDaily(supabase, { days: ANALYTICS_MAX_DAILY_FETCH_DAYS }),
          adminFetchVendorPerformance(supabase, { limit: VENDOR_TOP_N }),
        ]);
      return {
        bookingStats,
        recognizedRevenue,
        payments,
        platformFeePercent: normalizeVendorPlatformFeePercent(platformSettings.vendor_platform_fee_percent),
        subscriptionStats,
        dailyBookings,
        vendorPerformance,
      };
    },
    enabled: Boolean(supabase),
  });

  const periodSeries = useMemo(() => {
    if (!dashboardQuery.data) return [];
    return analyticsBuildBusinessPeriodSeries(
      chartPeriod,
      dashboardQuery.data.dailyBookings,
      dashboardQuery.data.recognizedRevenue.revenue_per_day,
    );
  }, [chartPeriod, dashboardQuery.data]);

  const bookingsChartData = useMemo(
    () =>
      periodSeries.map((row) => ({
        period: row.period,
        label: analyticsFormatPeriodAxisLabel(chartPeriod, row.period),
        bookings: row.bookings,
      })),
    [periodSeries, chartPeriod],
  );

  const revenueChartData = useMemo(
    () =>
      periodSeries.map((row) => ({
        period: row.period,
        label: analyticsFormatPeriodAxisLabel(chartPeriod, row.period),
        revenueRupees: row.revenue_cents / 100,
      })),
    [periodSeries, chartPeriod],
  );

  const windowTotals = useMemo(() => {
    let bookings = 0;
    let revenue_cents = 0;
    for (const row of periodSeries) {
      bookings += row.bookings;
      revenue_cents += row.revenue_cents;
    }
    return { bookings, revenue_cents };
  }, [periodSeries]);

  const snapshotCsvData = useMemo(() => {
    if (!dashboardQuery.data) return null;
    return {
      period: chartPeriod,
      ...dashboardQuery.data,
      periodSeries,
    };
  }, [dashboardQuery.data, chartPeriod, periodSeries]);

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
  const chartSubtitle = analyticsPeriodChartSubtitle(chartPeriod);
  const useBarCharts = chartPeriod !== "daily";

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
        <DashboardSkeleton kpiCount={4} />
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
              <p className="analytics-kpi-label">Recognized revenue</p>
              <p className="analytics-kpi-value">
                {formatInrFromPaise(dashboardQuery.data.recognizedRevenue.total_revenue_cents)}
              </p>
              <p className="analytics-kpi-hint">
                Settled platform fees · AMC {formatInrFromPaise(dashboardQuery.data.recognizedRevenue.amc_revenue_cents)}{" "}
                · One-time {formatInrFromPaise(dashboardQuery.data.recognizedRevenue.one_time_revenue_cents)}
              </p>
            </article>
            <article className="analytics-kpi">
              <p className="analytics-kpi-label">Total collections</p>
              <p className="analytics-kpi-value">
                {formatInrFromPaise(dashboardQuery.data.payments.total_payments_cents)}
              </p>
              <p className="analytics-kpi-hint">All successful payments (AMC prepay + one-time checkout)</p>
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

          <section className="analytics-period-toolbar" aria-label="Chart period">
            <div className="analytics-period-copy">
              <h2 className="analytics-section-title">Business trends</h2>
              <p className="analytics-chart-sub">{chartSubtitle}</p>
            </div>
            <div className="analytics-period-toggle" role="tablist" aria-label="Chart granularity">
              {PERIOD_ORDER.map((p) => (
                <button
                  key={p}
                  type="button"
                  role="tab"
                  aria-selected={chartPeriod === p}
                  className={chartPeriod === p ? "analytics-period-btn analytics-period-btn--active" : "analytics-period-btn"}
                  onClick={() => setChartPeriod(p)}
                >
                  {ANALYTICS_BUSINESS_PERIOD_LABELS[p]}
                </button>
              ))}
            </div>
          </section>

          <section className="analytics-window-kpis" aria-label="Selected period totals">
            <article className="analytics-window-kpi">
              <p className="analytics-window-kpi-label">Bookings in view</p>
              <p className="analytics-window-kpi-value">{formatCompact(windowTotals.bookings)}</p>
            </article>
            <article className="analytics-window-kpi">
              <p className="analytics-window-kpi-label">Recognized revenue in view</p>
              <p className="analytics-window-kpi-value">{formatInrFromPaise(windowTotals.revenue_cents)}</p>
            </article>
          </section>

          <div className="analytics-charts">
            <Card padded className="analytics-chart-card">
              <h2 className="analytics-chart-title">Bookings</h2>
              <p className="analytics-chart-sub">{ANALYTICS_BUSINESS_PERIOD_LABELS[chartPeriod]} volume (IST).</p>
              <div className="analytics-chart-wrap">
                <ResponsiveContainer width="100%" height={280}>
                  {useBarCharts ? (
                    <BarChart data={bookingsChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--wb-border, #e7e5e4)" vertical={false} />
                      <XAxis dataKey="label" tick={axisTickStyle} minTickGap={chartPeriod === "monthly" ? 8 : 4} />
                      <YAxis tick={axisTickStyle} width={36} allowDecimals={false} />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.[0]) return null;
                          const row = payload[0].payload as { period: string; bookings: number };
                          return (
                            <div className="analytics-tooltip">
                              <div className="analytics-tooltip-title">{row.period}</div>
                              <div className="analytics-tooltip-line">Bookings · {row.bookings}</div>
                            </div>
                          );
                        }}
                      />
                      <Bar dataKey="bookings" fill={CHART_PRIMARY} radius={[6, 6, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  ) : (
                    <AreaChart data={bookingsChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="fillBookings" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={CHART_PRIMARY} stopOpacity={0.35} />
                          <stop offset="100%" stopColor={CHART_PRIMARY} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--wb-border, #e7e5e4)" vertical={false} />
                      <XAxis dataKey="label" tick={axisTickStyle} minTickGap={24} />
                      <YAxis tick={axisTickStyle} width={36} allowDecimals={false} />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.[0]) return null;
                          const row = payload[0].payload as { period: string; bookings: number };
                          return (
                            <div className="analytics-tooltip">
                              <div className="analytics-tooltip-title">{row.period}</div>
                              <div className="analytics-tooltip-line">Bookings · {row.bookings}</div>
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
                  )}
                </ResponsiveContainer>
              </div>
            </Card>

            <Card padded className="analytics-chart-card">
              <h2 className="analytics-chart-title">Recognized revenue</h2>
              <p className="analytics-chart-sub">Successful payments · {ANALYTICS_BUSINESS_PERIOD_LABELS[chartPeriod]} (IST).</p>
              <div className="analytics-chart-wrap">
                <ResponsiveContainer width="100%" height={280}>
                  {useBarCharts ? (
                    <BarChart data={revenueChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--wb-border, #e7e5e4)" vertical={false} />
                      <XAxis dataKey="label" tick={axisTickStyle} minTickGap={chartPeriod === "monthly" ? 8 : 4} />
                      <YAxis
                        tick={axisTickStyle}
                        width={44}
                        tickFormatter={(v) => `₹${formatCompact(Number(v))}`}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.[0]) return null;
                          const row = payload[0].payload as { period: string; revenueRupees: number };
                          return (
                            <div className="analytics-tooltip">
                              <div className="analytics-tooltip-title">{row.period}</div>
                              <div className="analytics-tooltip-line">
                                Revenue · {formatInrFromPaise(row.revenueRupees * 100)}
                              </div>
                            </div>
                          );
                        }}
                      />
                      <Bar dataKey="revenueRupees" fill={CHART_SECONDARY} radius={[6, 6, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  ) : (
                    <AreaChart data={revenueChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={CHART_SECONDARY} stopOpacity={0.3} />
                          <stop offset="100%" stopColor={CHART_SECONDARY} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--wb-border, #e7e5e4)" vertical={false} />
                      <XAxis dataKey="label" tick={axisTickStyle} minTickGap={24} />
                      <YAxis
                        tick={axisTickStyle}
                        width={44}
                        tickFormatter={(v) => `₹${formatCompact(Number(v))}`}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.[0]) return null;
                          const row = payload[0].payload as { period: string; revenueRupees: number };
                          return (
                            <div className="analytics-tooltip">
                              <div className="analytics-tooltip-title">{row.period}</div>
                              <div className="analytics-tooltip-line">
                                Revenue · {formatInrFromPaise(row.revenueRupees * 100)}
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
                  )}
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

          <NotificationPlatformHealth />
        </div>
      )}
    </>
  );
}
