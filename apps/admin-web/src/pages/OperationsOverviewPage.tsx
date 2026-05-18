import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  adminAssignVendorToBooking,
  adminGetBookingMonitoringRows,
  adminListNotificationEvents,
  adminListNotificationEventsPaged,
  adminListOpsBookingExceptions,
  adminListOpsBookingExceptionsPaged,
  adminProcessNotificationQueue,
  adminResetBookingOtpLock,
  DEFAULT_TABLE_PAGE_SIZE,
  queryKeys,
  readBookingServiceOtpMeta,
  technicianApi,
  vendorApi,
} from "@oorjaman/api";
import { formatDisplayDateTime } from "@oorjaman/utils";
import { Button, Card, PageHeader } from "@oorjaman/web-ui";
import { TablePaginationBar } from "../components/TablePaginationBar";
import { formatNotificationEventTypeLabel } from "../lib/notification-labels";
import { useSupabase } from "../lib/supabase-context";
import "../layouts/dashboard-layout.css";

const OPS_KPI_SAMPLE = 3500;
const NOTIF_KPI_SAMPLE = 2000;
const MONITOR_SAMPLE = 1200;
const REPORTS_SAMPLE = 500;

function readPenaltyPaise(metadata: unknown): number {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return 0;
  const raw = (metadata as Record<string, unknown>).vendor_cancellation_penalty;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return 0;
  const paise = (raw as Record<string, unknown>).penalty_paise;
  return typeof paise === "number" && Number.isFinite(paise) ? Math.max(0, Math.round(paise)) : 0;
}

async function invalidateNotificationQueries(qc: ReturnType<typeof useQueryClient>) {
  await qc.invalidateQueries({ queryKey: queryKeys.bookings.notificationEvents(NOTIF_KPI_SAMPLE) });
  await qc.invalidateQueries({
    predicate: (q) =>
      Array.isArray(q.queryKey) &&
      (q.queryKey as unknown[]).includes("notification-events-paged"),
  });
}

export function OperationsOverviewPage() {
  const supabase = useSupabase();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [opsPage, setOpsPage] = useState(1);
  const [notifPage, setNotifPage] = useState(1);
  const [otpPage, setOtpPage] = useState(1);
  const [watchlistPage, setWatchlistPage] = useState(1);
  const [modPage, setModPage] = useState(1);

  const opsKpiQuery = useQuery({
    queryKey: queryKeys.bookings.opsExceptions(OPS_KPI_SAMPLE),
    queryFn: () => adminListOpsBookingExceptions(supabase!, OPS_KPI_SAMPLE),
    enabled: Boolean(supabase),
  });
  const opsPagedQuery = useQuery({
    queryKey: queryKeys.bookings.opsExceptionsPage(opsPage, DEFAULT_TABLE_PAGE_SIZE),
    queryFn: () =>
      adminListOpsBookingExceptionsPaged(supabase!, { page: opsPage, pageSize: DEFAULT_TABLE_PAGE_SIZE }),
    enabled: Boolean(supabase),
  });
  const notificationsKpiQuery = useQuery({
    queryKey: queryKeys.bookings.notificationEvents(NOTIF_KPI_SAMPLE),
    queryFn: () => adminListNotificationEvents(supabase!, NOTIF_KPI_SAMPLE),
    enabled: Boolean(supabase),
  });
  const notificationsPagedQuery = useQuery({
    queryKey: queryKeys.bookings.notificationEventsPage(notifPage, DEFAULT_TABLE_PAGE_SIZE),
    queryFn: () =>
      adminListNotificationEventsPaged(supabase!, { page: notifPage, pageSize: DEFAULT_TABLE_PAGE_SIZE }),
    enabled: Boolean(supabase),
  });
  const bookingMonitorQuery = useQuery({
    queryKey: queryKeys.bookings.adminMonitoring("all", MONITOR_SAMPLE),
    queryFn: () => adminGetBookingMonitoringRows(supabase!, "all", { limit: MONITOR_SAMPLE }),
    enabled: Boolean(supabase),
  });
  const processMut = useMutation({
    mutationFn: () => adminProcessNotificationQueue(supabase!, { limit: 80 }),
    onSuccess: async () => {
      await invalidateNotificationQueries(qc);
    },
  });
  const resetOtpMut = useMutation({
    mutationFn: async (bookingId: string) => adminResetBookingOtpLock(supabase!, bookingId),
    onSuccess: async () => {
      await bookingMonitorQuery.refetch();
    },
  });
  const [hideReasonByReportId, setHideReasonByReportId] = useState<Record<string, string>>({});
  const [assignBookingId, setAssignBookingId] = useState<string | null>(null);
  const [assignVendorId, setAssignVendorId] = useState<string>("");
  const [assignSuccessMsg, setAssignSuccessMsg] = useState<string | null>(null);
  const vendorsQuery = useQuery({
    queryKey: queryKeys.vendors.adminList("approved"),
    queryFn: () => vendorApi.adminListVendors(supabase!, { approvalStatus: "approved" }),
    enabled: Boolean(supabase),
  });
  const vendorStatsQuery = useQuery({
    queryKey: queryKeys.vendors.publicStats(),
    queryFn: () => vendorApi.listVendorPublicStats(supabase!),
    enabled: Boolean(supabase),
  });
  const techniciansQuery = useQuery({
    queryKey: queryKeys.technicians.verificationQueue(),
    queryFn: () => technicianApi.adminListVendorApprovedTechnicians(supabase!),
    enabled: Boolean(supabase),
  });
  const techStatsQuery = useQuery({
    queryKey: queryKeys.technicians.publicStats(),
    queryFn: () => technicianApi.listTechnicianPublicStats(supabase!),
    enabled: Boolean(supabase),
  });
  const reportsQuery = useQuery({
    queryKey: queryKeys.jobReports.list({ limit: REPORTS_SAMPLE }),
    queryFn: () => technicianApi.listVisibleJobReports(supabase!, { limit: REPORTS_SAMPLE }),
    enabled: Boolean(supabase),
  });
  const moderateMut = useMutation({
    mutationFn: async (input: { reportId: string; hidden: boolean; reason?: string }) =>
      technicianApi.adminSetJobReportFeedbackModeration(supabase!, input.reportId, {
        hidden: input.hidden,
        reason: input.reason,
      }),
    onSuccess: async () => {
      await reportsQuery.refetch();
    },
  });
  const assignMut = useMutation({
    mutationFn: async ({ bookingId, vendorId }: { bookingId: string; vendorId: string }) =>
      adminAssignVendorToBooking(supabase!, bookingId, vendorId),
    onSuccess: async (_, vars) => {
      const assignedVendor =
        (vendorsQuery.data ?? []).find((v) => v.id === vars.vendorId)?.business_name ?? "selected vendor";
      setAssignSuccessMsg(`Assigned to ${assignedVendor}.`);
      setTimeout(() => setAssignSuccessMsg(null), 3500);
      setAssignBookingId(null);
      setAssignVendorId("");
      await bookingMonitorQuery.refetch();
      await opsKpiQuery.refetch();
      await opsPagedQuery.refetch();
    },
  });

  const summary = useMemo(() => {
    const rows = opsKpiQuery.data ?? [];
    const high = rows.filter((r) => r.issue_level === "high").length;
    const medium = rows.filter((r) => r.issue_level === "medium").length;
    return { total: rows.length, atRisk: rows.length, high, medium };
  }, [opsKpiQuery.data]);
  const notifSummary = useMemo(() => {
    const rows = notificationsKpiQuery.data ?? [];
    const queued = rows.filter((r) => r.status === "queued").length;
    const sent = rows.filter((r) => r.status === "sent").length;
    const failed = rows.filter((r) => r.status === "failed").length;
    return { queued, sent, failed };
  }, [notificationsKpiQuery.data]);
  type OtpRiskEntry = {
    row: NonNullable<(typeof bookingMonitorQuery)["data"]>[number];
    otp: ReturnType<typeof readBookingServiceOtpMeta>;
    locked: boolean;
    mismatches: number;
  };
  const otpRiskAll = useMemo(() => {
    const rows = bookingMonitorQuery.data ?? [];
    const out: OtpRiskEntry[] = [];
    for (const row of rows) {
      const otp = readBookingServiceOtpMeta(row.metadata);
      const locked = Boolean(otp.startLockedUntil || otp.happyLockedUntil);
      const mismatches = otp.startFailCount + otp.happyFailCount;
      const highMismatch = mismatches >= 2;
      if (!locked && !highMismatch) continue;
      out.push({ row, otp, locked, mismatches });
    }
    return out;
  }, [bookingMonitorQuery.data]);

  const otpRiskTotal = otpRiskAll.length;
  const otpRiskWindow = useMemo(
    () =>
      otpRiskAll.slice((otpPage - 1) * DEFAULT_TABLE_PAGE_SIZE, otpPage * DEFAULT_TABLE_PAGE_SIZE),
    [otpRiskAll, otpPage],
  );

  const otpRiskAggregate = useMemo(() => ({
    locked: otpRiskAll.filter((r) => r.locked).length,
    mismatchHeavy: otpRiskAll.filter((r) => r.mismatches >= 2).length,
  }), [otpRiskAll]);

  const vendorPenaltySummary = useMemo(() => {
    const rows = bookingMonitorQuery.data ?? [];
    const penalized = rows.filter((r) => readPenaltyPaise(r.metadata) > 0);
    const totalPaise = penalized.reduce((sum, r) => sum + readPenaltyPaise(r.metadata), 0);
    return { count: penalized.length, totalPaise };
  }, [bookingMonitorQuery.data]);

  type WatchRow =
    | { kind: "vendor"; id: string; name: string; rating: number; count: number; r30?: number | null; c30?: number | null }
    | {
        kind: "technician";
        id: string;
        name: string;
        rating: number;
        count: number;
        r30?: number | null;
        c30?: number | null;
      };

  const watchlistRowsAll = useMemo(() => {
    const vendorNameById = new Map((vendorsQuery.data ?? []).map((v) => [v.id, v.business_name] as const));
    const techById = new Map((techniciansQuery.data ?? []).map((t) => [t.id, t] as const));
    const lowVendors: WatchRow[] = (vendorStatsQuery.data ?? [])
      .filter((s) => (s.avg_rating ?? 5) < 3.8 && (s.rating_count ?? 0) >= 5)
      .sort((a, b) => (a.avg_rating ?? 5) - (b.avg_rating ?? 5))
      .slice(0, 40)
      .map((s) => ({
        kind: "vendor" as const,
        id: s.vendor_id,
        name: vendorNameById.get(s.vendor_id) ?? s.vendor_id.slice(0, 8),
        rating: s.avg_rating ?? 0,
        count: s.rating_count ?? 0,
        r30: s.avg_rating_30d ?? null,
        c30: s.rating_count_30d ?? null,
      }));
    const lowTechs: WatchRow[] = (techStatsQuery.data ?? [])
      .filter((s) => (s.avg_rating ?? 5) < 3.8 && (s.rating_count ?? 0) >= 5)
      .sort((a, b) => (a.avg_rating ?? 5) - (b.avg_rating ?? 5))
      .slice(0, 40)
      .map((s) => ({
        kind: "technician" as const,
        id: s.technician_id,
        name:
          techById.get(s.technician_id)?.employee_code ??
          techById.get(s.technician_id)?.user_id.slice(0, 8) ??
          s.technician_id.slice(0, 8),
        rating: s.avg_rating ?? 0,
        count: s.rating_count ?? 0,
        r30: s.avg_rating_30d ?? null,
        c30: s.rating_count_30d ?? null,
      }));
    return [...lowVendors, ...lowTechs];
  }, [vendorsQuery.data, techniciansQuery.data, vendorStatsQuery.data, techStatsQuery.data]);

  const watchlistTotal = watchlistRowsAll.length;
  const watchlistWindow = useMemo(
    () =>
      watchlistRowsAll.slice(
        (watchlistPage - 1) * DEFAULT_TABLE_PAGE_SIZE,
        watchlistPage * DEFAULT_TABLE_PAGE_SIZE,
      ),
    [watchlistRowsAll, watchlistPage],
  );

  const moderationAll = useMemo(
    () =>
      [...(reportsQuery.data ?? [])]
        .filter((r) => r.customer_feedback?.trim() || r.anomaly_notes?.trim())
        .sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()),
    [reportsQuery.data],
  );
  const moderationTotal = moderationAll.length;
  const moderationRows = useMemo(
    () =>
      moderationAll.slice(
        (modPage - 1) * DEFAULT_TABLE_PAGE_SIZE,
        modPage * DEFAULT_TABLE_PAGE_SIZE,
      ),
    [moderationAll, modPage],
  );

  const assignRow = (bookingMonitorQuery.data ?? []).find((r) => r.id === assignBookingId) ?? null;

  const kpisLeft: [string, string][] = [
    ["Total ops exceptions (sample)", String(summary.total)],
    ["Needs intervention (sample)", String(summary.atRisk)],
    ["High risk", String(summary.high)],
    ["Medium risk", String(summary.medium)],
    ["Notifications queued (sample)", String(notifSummary.queued)],
    ["Notifications sent (sample)", String(notifSummary.sent)],
    ["Notifications failed (sample)", String(notifSummary.failed)],
  ];

  const kpisRight: [string, string][] = [
    ["OTP risk queue", String(otpRiskTotal)],
    ["OTP locked (subset)", String(otpRiskAggregate.locked)],
    ["OTP heavy mismatch", String(otpRiskAggregate.mismatchHeavy)],
    ["Vendor late-cancel penalties", `₹${(vendorPenaltySummary.totalPaise / 100).toFixed(0)}`],
    ["Penalized cancellations", String(vendorPenaltySummary.count)],
    ["Moderation backlog", String(moderationTotal)],
    ["Low-rating watchlist", String(watchlistTotal)],
  ];

  async function refreshAll() {
    await Promise.all([
      opsKpiQuery.refetch(),
      opsPagedQuery.refetch(),
      notificationsKpiQuery.refetch(),
      notificationsPagedQuery.refetch(),
      bookingMonitorQuery.refetch(),
      vendorsQuery.refetch(),
      techniciansQuery.refetch(),
      vendorStatsQuery.refetch(),
      techStatsQuery.refetch(),
      reportsQuery.refetch(),
    ]);
  }

  const opsPagedRows = opsPagedQuery.data?.rows ?? [];
  const opsPagedTotal = opsPagedQuery.data?.total ?? 0;
  const notifPagedRows = notificationsPagedQuery.data?.rows ?? [];
  const notifPagedTotal = notificationsPagedQuery.data?.total ?? 0;

  return (
    <>
      <PageHeader
        title="Operations control"
        subtitle="End-to-end operational oversight for exceptions, delays, and intervention workload."
        actions={
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <Button
              variant="outline"
              size="sm"
              type="button"
              loading={processMut.isPending}
              onClick={() => void processMut.mutateAsync()}
            >
              Process queue now
            </Button>
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => {
                void refreshAll();
              }}
            >
              Refresh
            </Button>
          </div>
        }
      />

      {!supabase ? (
        <Card padded>
          <p className="bm-muted">Connect Supabase via Vite env variables.</p>
        </Card>
      ) : (
        <div className="bm-stack">
          {assignSuccessMsg ? (
            <Card padded>
              <p className="dash-card-body">{assignSuccessMsg}</p>
            </Card>
          ) : null}

          <Card padded={false}>
            <div style={{ padding: "1rem 1rem 0" }}>
              <h2 className="bm-title">Summary (from sampled KPI queries)</h2>
              <p className="bm-muted" style={{ margin: "0.25rem 0 0.75rem", fontSize: "0.875rem" }}>
                KPIs use capped samples (exceptions {OPS_KPI_SAMPLE.toLocaleString()}, notifications{" "}
                {NOTIF_KPI_SAMPLE.toLocaleString()}, bookings {MONITOR_SAMPLE.toLocaleString()}, reports{" "}
                {REPORTS_SAMPLE}). Tables below use paging.
              </p>
            </div>
            <div className="bm-table-wrap">
              <table className="bm-table">
                <thead>
                  <tr>
                    <th>Ops & notifications</th>
                    <th>Value</th>
                    <th>OTP & finance</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {kpisLeft.map(([leftLabel, leftVal], i) => {
                    const [rightLabel, rightVal] = kpisRight[i] ?? ["", ""];
                    return (
                      <tr key={`kpi-${i}`}>
                        <td>{leftLabel}</td>
                        <td>{leftVal}</td>
                        <td>{rightLabel}</td>
                        <td>{rightVal}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <Card padded={false}>
            <div style={{ padding: "1rem 1rem 0" }}>
              <h2 className="bm-title">Operations exceptions</h2>
            </div>
            {opsPagedQuery.isLoading ? (
              <p className="dash-table-empty">Loading operations queue…</p>
            ) : opsPagedQuery.isError ? (
              <div className="bm-block">
                <p className="bm-title">Couldn&apos;t load operations queue</p>
                <p className="bm-error">{(opsPagedQuery.error as Error).message}</p>
              </div>
            ) : opsPagedTotal === 0 ? (
              <p className="dash-table-empty">No operational exceptions right now.</p>
            ) : (
              <>
                <div className="bm-table-wrap">
                  <table className="bm-table">
                    <thead>
                      <tr>
                        <th>Reference</th>
                        <th>Issue</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {opsPagedRows.map((row) => (
                        <tr key={row.booking_id}>
                          <td>
                            <code className="bm-ref">{row.reference_code ?? row.booking_id.slice(0, 8)}</code>
                          </td>
                          <td className="bm-risk-line">{row.issue_label ?? "Operational exception"}</td>
                          <td>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                              <Button
                                variant="outline"
                                size="sm"
                                type="button"
                                onClick={() => navigate("/dashboard/bookings?attention=1")}
                              >
                                Open board
                              </Button>
                              <Button
                                variant="primary"
                                size="sm"
                                type="button"
                                onClick={() => {
                                  setAssignBookingId(row.booking_id);
                                  setAssignVendorId("");
                                }}
                              >
                                Assign vendor
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ padding: "0.75rem 1rem 1rem" }}>
                  <TablePaginationBar page={opsPage} total={opsPagedTotal} onPageChange={setOpsPage} />
                </div>
              </>
            )}
          </Card>

          <Card padded={false}>
            <div style={{ padding: "1rem 1rem 0" }}>
              <h2 className="bm-title">OTP risk (from sampled bookings)</h2>
              <p className="bm-muted" style={{ margin: "0.25rem 0 0.75rem", fontSize: "0.875rem" }}>
                Rows are derived from monitored bookings; paging is applied after filtering.
              </p>
            </div>
            {bookingMonitorQuery.isLoading ? (
              <p className="dash-table-empty">Loading OTP risk queue…</p>
            ) : otpRiskTotal === 0 ? (
              <p className="dash-table-empty">No OTP-risk bookings right now.</p>
            ) : (
              <>
                <div className="bm-table-wrap">
                  <table className="bm-table">
                    <thead>
                      <tr>
                        <th>Reference</th>
                        <th>State</th>
                        <th>Start OTP</th>
                        <th>Happy OTP</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {otpRiskWindow.map(({ row, otp, mismatches, locked }) => (
                        <tr key={`otp-${row.id}`}>
                          <td>
                            <code className="bm-ref">{row.reference_code}</code>
                          </td>
                          <td>
                            {locked ? "OTP lock active" : "High OTP mismatches"} · attempts {mismatches}
                          </td>
                          <td style={{ whiteSpace: "pre-wrap", fontSize: "0.8rem" }}>
                            {`Fails: ${otp.startFailCount}${otp.startLockedUntil ? `\nuntil ${new Date(otp.startLockedUntil).toLocaleTimeString()}` : ""}`}
                          </td>
                          <td style={{ whiteSpace: "pre-wrap", fontSize: "0.8rem" }}>
                            {`Fails: ${otp.happyFailCount}${otp.happyLockedUntil ? `\nuntil ${new Date(otp.happyLockedUntil).toLocaleTimeString()}` : ""}`}
                          </td>
                          <td>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                              <Button
                                variant="outline"
                                size="sm"
                                type="button"
                                loading={resetOtpMut.isPending && resetOtpMut.variables === row.id}
                                disabled={resetOtpMut.isPending}
                                onClick={() => {
                                  const ok = window.confirm(
                                    `Reset OTP lock for booking ${row.reference_code}? This will clear mismatch counters and active lock timers.`,
                                  );
                                  if (!ok) return;
                                  void resetOtpMut.mutateAsync(row.id);
                                }}
                              >
                                Reset OTP
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                type="button"
                                onClick={() => navigate("/dashboard/bookings?attention=1")}
                              >
                                Open board
                              </Button>
                              <Button
                                variant="primary"
                                size="sm"
                                type="button"
                                onClick={() => {
                                  setAssignBookingId(row.id);
                                  setAssignVendorId(row.vendor_id ?? "");
                                }}
                              >
                                Assign vendor
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ padding: "0.75rem 1rem 1rem" }}>
                  <TablePaginationBar page={otpPage} total={otpRiskTotal} onPageChange={setOtpPage} />
                </div>
              </>
            )}
          </Card>

          {assignRow ? (
            <Card padded>
              <p className="dash-card-title">Assign vendor now</p>
              <p className="dash-card-sub">
                <code className="bm-ref">{assignRow.reference_code}</code> ·{" "}
                {formatDisplayDateTime(assignRow.scheduled_start)}
              </p>
              <label className="dash-card-label" htmlFor="ops-assign-vendor-select">
                Approved vendor
              </label>
              <select
                id="ops-assign-vendor-select"
                className="vd-select"
                value={assignVendorId}
                onChange={(e) => setAssignVendorId(e.target.value)}
              >
                <option value="">Select vendor…</option>
                {(vendorsQuery.data ?? []).map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.business_name}
                    {v.trade_name ? ` (${v.trade_name})` : ""}
                  </option>
                ))}
              </select>
              <div className="dash-card-actions">
                <Button variant="outline" size="sm" type="button" onClick={() => setAssignBookingId(null)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  type="button"
                  loading={assignMut.isPending}
                  disabled={!assignVendorId}
                  onClick={() => {
                    if (!assignBookingId || !assignVendorId) return;
                    void assignMut.mutateAsync({ bookingId: assignBookingId, vendorId: assignVendorId });
                  }}
                >
                  Confirm assignment
                </Button>
              </div>
              {assignMut.isError ? <p className="bm-error">{(assignMut.error as Error).message}</p> : null}
            </Card>
          ) : null}

          <Card padded={false}>
            <div style={{ padding: "1rem 1rem 0" }}>
              <h2 className="bm-title">Notification events</h2>
            </div>
            {notificationsPagedQuery.isLoading ? (
              <p className="dash-table-empty">Loading notification events…</p>
            ) : notificationsPagedQuery.isError ? (
              <p className="bm-error dash-table-empty">{(notificationsPagedQuery.error as Error).message}</p>
            ) : notifPagedTotal === 0 ? (
              <p className="dash-table-empty">No notification events yet.</p>
            ) : (
              <>
                <div className="bm-table-wrap">
                  <table className="bm-table">
                    <thead>
                      <tr>
                        <th>Event</th>
                        <th>Status</th>
                        <th>Attempts</th>
                        <th>Created</th>
                        <th>Recipient</th>
                      </tr>
                    </thead>
                    <tbody>
                      {notifPagedRows.map((row) => (
                        <tr key={row.id}>
                          <td>
                            <div>{formatNotificationEventTypeLabel(row.event_type)}</div>
                            <div className="bm-muted bm-cell-mono" style={{ fontSize: "0.75rem" }}>
                              {row.event_type}
                            </div>
                          </td>
                          <td>{row.status}</td>
                          <td>{row.attempt_count}</td>
                          <td>{formatDisplayDateTime(row.created_at)}</td>
                          <td className="bm-cell-mono">
                            {row.recipient_vendor_id ? row.recipient_vendor_id.slice(0, 8) : "broadcast"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ padding: "0.75rem 1rem 1rem" }}>
                  <TablePaginationBar page={notifPage} total={notifPagedTotal} onPageChange={setNotifPage} />
                </div>
              </>
            )}
          </Card>

          <Card padded={false}>
            <div style={{ padding: "1rem 1rem 0" }}>
              <h2 className="bm-title">Low-rating watchlist</h2>
            </div>
            {watchlistTotal === 0 ? (
              <p className="dash-table-empty">No low-rating watchlist entities right now.</p>
            ) : (
              <>
                <div className="bm-table-wrap">
                  <table className="bm-table">
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Name</th>
                        <th>Rating</th>
                        <th>Count</th>
                        <th>30d</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {watchlistWindow.map((w) => (
                        <tr key={`${w.kind}-${w.id}`}>
                          <td>{w.kind}</td>
                          <td>{w.name}</td>
                          <td>{w.rating.toFixed(1)}</td>
                          <td>{w.count}</td>
                          <td>
                            {w.r30 != null ? w.r30.toFixed(1) : "—"} ({w.c30 ?? 0})
                          </td>
                          <td>
                            <Button
                              variant="outline"
                              size="sm"
                              type="button"
                              onClick={() =>
                                navigate(w.kind === "vendor" ? "/dashboard/vendors/approved" : "/dashboard/technicians")
                              }
                            >
                              Open
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ padding: "0.75rem 1rem 1rem" }}>
                  <TablePaginationBar page={watchlistPage} total={watchlistTotal} onPageChange={setWatchlistPage} />
                </div>
              </>
            )}
          </Card>

          <Card padded={false}>
            <div style={{ padding: "1rem 1rem 0" }}>
              <h2 className="bm-title">Feedback moderation</h2>
              <p className="bm-muted" style={{ margin: "0.25rem 0 0.75rem", fontSize: "0.875rem" }}>
                Sample of recent job reports with customer text; paging is client-side on the filtered set.
              </p>
            </div>
            {reportsQuery.isLoading ? (
              <p className="dash-table-empty">Loading job reports…</p>
            ) : moderationTotal === 0 ? (
              <p className="dash-table-empty">No feedback items to moderate right now.</p>
            ) : (
              <>
                <div className="bm-table-wrap">
                  <table className="bm-table">
                    <thead>
                      <tr>
                        <th>Booking</th>
                        <th>Rating</th>
                        <th>Completed</th>
                        <th>Visibility</th>
                        <th>Text</th>
                        <th>Moderation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {moderationRows.map((r) => (
                        <tr key={`mod-${r.id}`}>
                          <td className="bm-cell-mono">{r.booking_id.slice(0, 8)}…</td>
                          <td>{r.customer_rating ?? "—"}</td>
                          <td>{new Date(r.completed_at).toLocaleString()}</td>
                          <td>{r.feedback_hidden ? "Hidden" : "Visible"}</td>
                          <td style={{ maxWidth: 280, fontSize: "0.85rem" }}>
                            {r.feedback_hidden
                              ? r.feedback_hidden_reason ?? "Hidden"
                              : [r.customer_feedback, r.anomaly_notes].filter(Boolean).join(" · ") || "—"}
                          </td>
                          <td>
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", minWidth: 200 }}>
                              <input
                                placeholder="Hide reason (optional)"
                                value={hideReasonByReportId[r.id] ?? ""}
                                onChange={(e) =>
                                  setHideReasonByReportId((prev) => ({ ...prev, [r.id]: e.target.value }))
                                }
                              />
                              {!r.feedback_hidden ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  type="button"
                                  loading={moderateMut.isPending}
                                  onClick={() =>
                                    void moderateMut.mutateAsync({
                                      reportId: r.id,
                                      hidden: true,
                                      reason: hideReasonByReportId[r.id],
                                    })
                                  }
                                >
                                  Hide
                                </Button>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  type="button"
                                  loading={moderateMut.isPending}
                                  onClick={() => void moderateMut.mutateAsync({ reportId: r.id, hidden: false })}
                                >
                                  Unhide
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ padding: "0.75rem 1rem 1rem" }}>
                  <TablePaginationBar page={modPage} total={moderationTotal} onPageChange={setModPage} />
                </div>
              </>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
