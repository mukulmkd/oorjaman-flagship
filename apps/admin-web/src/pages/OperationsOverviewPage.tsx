import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import {
  adminAssignVendorToBooking,
  adminNotifyOverdueVendorResponses,
  adminFloatDefaultVendorBooking,
  adminFlagBookingOpsIssue,
  adminGetBookingMonitoringRows,
  adminListNotificationEvents,
  adminListNotificationEventsPaged,
  adminListOpsBookingExceptions,
  adminListOpsBookingExceptionsPaged,
  adminProcessNotificationQueue,
  adminRefloatMarketplaceBooking,
  adminResetBookingOtpLock,
  DEFAULT_TABLE_PAGE_SIZE,
  getBookingById,
  queryKeys,
  readBookingServiceOtpMeta,
  technicianApi,
  vendorApi,
  type OpsBookingExceptionRow,
  type OpsExceptionsQueueFilter,
  type OpsIssueType,
} from "@oorjaman/api";
import { formatDisplayDateTime, formatDisplayDateTimeRange } from "@oorjaman/utils";
import { Badge, Button, Card, Modal, PageHeader } from "@oorjaman/web-ui";
import { TablePaginationBar } from "../components/TablePaginationBar";
import { formatNotificationEventTypeLabel } from "../lib/notification-labels";
import { OPS_ISSUE_LABELS } from "../lib/booking-routing-display";
import {
  canFloatToMarketplace,
  canRefloatMarketplace,
  formatOpsIssueLevel,
  formatOpsIssueType,
  isOpsExceptionPastWindow,
  needsPartnerAssignment,
} from "../lib/ops-exceptions-display";
import { webTypography } from "../styles/typography";
import { useSupabase } from "../lib/supabase-context";
import "../layouts/dashboard-layout.css";

const OPS_KPI_SAMPLE = 3500;
const NOTIF_KPI_SAMPLE = 2000;
const MONITOR_SAMPLE = 1200;
const REPORTS_SAMPLE = 500;

const OPS_QUEUE_TABS: { id: OpsExceptionsQueueFilter; label: string; hint: string }[] = [
  {
    id: "actionable",
    label: "Current window",
    hint: "Scheduled end is still in the future - assign partner, float marketplace, or intervene here.",
  },
  {
    id: "past_window",
    label: "Past window",
    hint: "Scheduled window already ended but booking is still open in the system. Use Bookings for closure; assignment is disabled.",
  },
  {
    id: "all",
    label: "All exceptions",
    hint: "Full ops exception view (includes stale schedule-missed rows).",
  },
];

type OpsModalState =
  | null
  | {
    bookingId: string;
    referenceCode: string;
    issueType?: string | null;
    view: "menu" | "assign";
  };

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

  const [opsQueueFilter, setOpsQueueFilter] = useState<OpsExceptionsQueueFilter>("actionable");
  const [opsPage, setOpsPage] = useState(1);
  const [notifPage, setNotifPage] = useState(1);
  const [otpPage, setOtpPage] = useState(1);
  const [watchlistPage, setWatchlistPage] = useState(1);
  const [modPage, setModPage] = useState(1);

  const [opsModal, setOpsModal] = useState<OpsModalState>(null);
  const [assignVendorId, setAssignVendorId] = useState("");

  useEffect(() => {
    setOpsPage(1);
  }, [opsQueueFilter]);

  const opsKpiQuery = useQuery({
    queryKey: queryKeys.bookings.opsExceptions(OPS_KPI_SAMPLE),
    queryFn: () => adminListOpsBookingExceptions(supabase!, OPS_KPI_SAMPLE),
    enabled: Boolean(supabase),
  });
  const opsPagedQuery = useQuery({
    queryKey: queryKeys.bookings.opsExceptionsPage(opsPage, DEFAULT_TABLE_PAGE_SIZE, opsQueueFilter),
    queryFn: () =>
      adminListOpsBookingExceptionsPaged(supabase!, {
        page: opsPage,
        pageSize: DEFAULT_TABLE_PAGE_SIZE,
        filter: opsQueueFilter,
      }),
    enabled: Boolean(supabase),
  });
  const opsBookingQuery = useQuery({
    queryKey: [...queryKeys.bookings.all(), "ops-intervention", opsModal?.bookingId] as const,
    queryFn: () => getBookingById(supabase!, opsModal!.bookingId),
    enabled: Boolean(supabase && opsModal?.bookingId),
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

  async function refreshOpsQueues() {
    await Promise.all([opsKpiQuery.refetch(), opsPagedQuery.refetch()]);
    if (opsModal?.bookingId) {
      await opsBookingQuery.refetch();
    }
  }

  const assignMut = useMutation({
    mutationFn: async ({ bookingId, vendorId }: { bookingId: string; vendorId: string }) =>
      adminAssignVendorToBooking(supabase!, bookingId, vendorId),
    onSuccess: async () => {
      setOpsModal(null);
      setAssignVendorId("");
      await refreshOpsQueues();
      await bookingMonitorQuery.refetch();
    },
  });
  const floatMut = useMutation({
    mutationFn: async (bookingId: string) => adminFloatDefaultVendorBooking(supabase!, bookingId),
    onSuccess: async () => {
      await refreshOpsQueues();
      await opsBookingQuery.refetch();
    },
  });
  const refloatMut = useMutation({
    mutationFn: async (bookingId: string) => adminRefloatMarketplaceBooking(supabase!, bookingId),
    onSuccess: async () => {
      await refreshOpsQueues();
      await opsBookingQuery.refetch();
    },
  });
  const opsFlagMut = useMutation({
    mutationFn: async ({ bookingId, type }: { bookingId: string; type: OpsIssueType }) =>
      adminFlagBookingOpsIssue(supabase!, bookingId, type),
    onSuccess: async () => {
      await opsBookingQuery.refetch();
    },
  });

  const interventionBooking = opsBookingQuery.data ?? null;
  const mutating =
    floatMut.isPending || refloatMut.isPending || opsFlagMut.isPending || assignMut.isPending;

  function openIntervention(input: {
    bookingId: string;
    referenceCode: string;
    issueType?: string | null;
    presetVendorId?: string | null;
  }) {
    setOpsModal({ bookingId: input.bookingId, referenceCode: input.referenceCode, issueType: input.issueType, view: "menu" });
    setAssignVendorId(input.presetVendorId?.trim() ?? "");
  }

  function closeInterventionModal() {
    setOpsModal(null);
    setAssignVendorId("");
  }

  const summary = useMemo(() => {
    const rows = opsKpiQuery.data ?? [];
    const now = new Date();
    const actionable = rows.filter((r) => !isOpsExceptionPastWindow(r, now));
    const past = rows.length - actionable.length;
    const high = actionable.filter((r) => r.issue_level === "high").length;
    const medium = actionable.filter((r) => r.issue_level === "medium").length;
    return { total: rows.length, actionable: actionable.length, past, high, medium };
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

  const otpRiskAggregate = useMemo(
    () => ({
      locked: otpRiskAll.filter((r) => r.locked).length,
      mismatchHeavy: otpRiskAll.filter((r) => r.mismatches >= 2).length,
    }),
    [otpRiskAll],
  );

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

  const vendorNameById = useMemo(
    () => new Map((vendorsQuery.data ?? []).map((v) => [v.id, v.business_name] as const)),
    [vendorsQuery.data],
  );

  const kpisLeft: [string, string][] = [
    ["Exceptions in sample", String(summary.total)],
    ["Current window (sample)", String(summary.actionable)],
    ["Past window (sample)", String(summary.past)],
    ["High risk (current)", String(summary.high)],
    ["Medium risk (current)", String(summary.medium)],
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
    ["", ""],
  ];

  const overdueScanMut = useMutation({
    mutationFn: () => adminNotifyOverdueVendorResponses(supabase!, { limit: 200 }),
    onSuccess: async () => {
      await opsKpiQuery.refetch();
      await opsPagedQuery.refetch();
    },
  });

  async function refreshAll() {
    if (supabase) {
      await overdueScanMut.mutateAsync().catch(() => undefined);
    }
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

  const modalIssueType =
    opsModal?.issueType && opsModal.issueType in OPS_ISSUE_LABELS
      ? (opsModal.issueType as OpsIssueType)
      : undefined;
  const showAssignInModal =
    Boolean(
      interventionBooking &&
      opsModal?.view === "menu" &&
      needsPartnerAssignment(interventionBooking) &&
      !isOpsExceptionPastWindow({
        booking_id: interventionBooking.id,
        reference_code: interventionBooking.reference_code,
        status: interventionBooking.status,
        vendor_id: interventionBooking.vendor_id,
        technician_id: interventionBooking.technician_id,
        scheduled_start: interventionBooking.scheduled_start,
        scheduled_end: interventionBooking.scheduled_end,
        created_at: interventionBooking.created_at,
        issue_type: opsModal?.issueType ?? null,
        issue_level: null,
        issue_label: null,
      }),
    );

  return (
    <>
      <PageHeader
        title="Operations control"
        subtitle="Exceptions, OTP risk, notifications, and partner intervention - use Intervene for assign, float, and alerts."
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
          <Card padded={false}>
            <div style={{ padding: "1rem 1rem 0" }}>
              <h2 className="bm-title">Summary (from sampled KPI queries)</h2>
              <p className="bm-muted" style={{ margin: "0.25rem 0 0.75rem", fontSize: "0.875rem" }}>
                KPIs use capped samples. The exceptions table defaults to{" "}
                <strong>Current window</strong> so past visits do not block assignment.
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
              <p className="bm-muted" style={{ margin: "0.25rem 0 0.75rem", fontSize: "0.875rem" }}>
                {OPS_QUEUE_TABS.find((t) => t.id === opsQueueFilter)?.hint}
              </p>
              <div className="bm-tabs" role="tablist" aria-label="Ops exception queue" style={{ marginBottom: "0.75rem" }}>
                {OPS_QUEUE_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={opsQueueFilter === tab.id}
                    className={`bm-tab-btn ${opsQueueFilter === tab.id ? "is-active" : ""}`}
                    onClick={() => setOpsQueueFilter(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            {opsPagedQuery.isLoading ? (
              <p className="dash-table-empty">Loading operations queue…</p>
            ) : opsPagedQuery.isError ? (
              <div className="bm-block">
                <p className="bm-title">Couldn&apos;t load operations queue</p>
                <p className="bm-error">{(opsPagedQuery.error as Error).message}</p>
              </div>
            ) : opsPagedTotal === 0 ? (
              <p className="dash-table-empty">
                {opsQueueFilter === "actionable"
                  ? "No current-window exceptions - check Past window or Bookings."
                  : "No exceptions in this filter."}
              </p>
            ) : (
              <>
                <div className="bm-table-wrap">
                  <table className="bm-table bm-table--bookings">
                    <thead>
                      <tr>
                        <th>Reference</th>
                        <th>Status</th>
                        <th>Scheduled</th>
                        <th>Risk</th>
                        <th>Issue</th>
                        <th>Partner</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {opsPagedRows.map((row) => (
                        <OpsExceptionRow
                          key={row.booking_id}
                          row={row}
                          vendorNameById={vendorNameById}
                          onIntervene={() =>
                            openIntervention({
                              bookingId: row.booking_id,
                              referenceCode: row.reference_code ?? row.booking_id.slice(0, 8),
                              issueType: row.issue_type,
                              presetVendorId: row.vendor_id,
                            })
                          }
                        />
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
                                variant="primary"
                                size="sm"
                                type="button"
                                onClick={() =>
                                  openIntervention({
                                    bookingId: row.id,
                                    referenceCode: row.reference_code,
                                    presetVendorId: row.vendor_id,
                                  })
                                }
                              >
                                Intervene
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
                            {w.r30 != null ? w.r30.toFixed(1) : "-"} ({w.c30 ?? 0})
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
                          <td>{r.customer_rating ?? "-"}</td>
                          <td>{new Date(r.completed_at).toLocaleString()}</td>
                          <td>{r.feedback_hidden ? "Hidden" : "Visible"}</td>
                          <td style={{ maxWidth: 280, fontSize: "0.85rem" }}>
                            {r.feedback_hidden
                              ? r.feedback_hidden_reason ?? "Hidden"
                              : [r.customer_feedback, r.anomaly_notes].filter(Boolean).join(" · ") || "-"}
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

      <Modal
        open={Boolean(opsModal)}
        onClose={closeInterventionModal}
        title={
          opsModal?.view === "assign"
            ? `Assign partner · ${opsModal.referenceCode}`
            : `Intervene · ${opsModal?.referenceCode ?? ""}`
        }
      >
        {opsModal?.view === "assign" && interventionBooking ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            <p style={{ margin: 0, fontSize: webTypography.size.sm, color: "var(--wb-muted-fg)", lineHeight: 1.5 }}>
              Partner acceptance SLA starts on confirm (unless a marketplace window is already open).
            </p>
            <label className="dash-card-label" htmlFor="ops-assign-vendor-modal-select">
              Approved partner
            </label>
            <select
              id="ops-assign-vendor-modal-select"
              className="vd-select bm-select"
              value={assignVendorId}
              onChange={(e) => setAssignVendorId(e.target.value)}
            >
              <option value="">Select partner…</option>
              {(vendorsQuery.data ?? []).map((v) => (
                <option key={v.id} value={v.id}>
                  {v.business_name}
                  {v.trade_name ? ` (${v.trade_name})` : ""}
                </option>
              ))}
            </select>
            <div className="dash-card-actions bm-modal-actions">
              <Button
                variant="outline"
                size="sm"
                type="button"
                disabled={assignMut.isPending}
                onClick={() => setOpsModal({ ...opsModal, view: "menu" })}
              >
                Back
              </Button>
              <Button variant="outline" size="sm" type="button" disabled={assignMut.isPending} onClick={closeInterventionModal}>
                Cancel
              </Button>
              <Button
                size="sm"
                type="button"
                loading={assignMut.isPending}
                disabled={!assignVendorId}
                onClick={() => {
                  if (!assignVendorId || !opsModal) return;
                  void assignMut.mutateAsync({ bookingId: opsModal.bookingId, vendorId: assignVendorId });
                }}
              >
                Confirm assignment
              </Button>
            </div>
            {assignMut.isError ? <p className="bm-error">{(assignMut.error as Error).message}</p> : null}
          </div>
        ) : opsModal ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            {opsBookingQuery.isLoading ? (
              <p className="bm-muted">Loading booking…</p>
            ) : opsBookingQuery.isError ? (
              <p className="bm-error">{(opsBookingQuery.error as Error).message}</p>
            ) : interventionBooking ? (
              <>
                <dl
                  style={{
                    margin: 0,
                    display: "grid",
                    gridTemplateColumns: "auto 1fr",
                    gap: "0.35rem 1rem",
                    fontSize: webTypography.size.sm,
                  }}
                >
                  <dt style={{ color: "var(--wb-muted-fg)" }}>Status</dt>
                  <dd style={{ margin: 0 }}>{interventionBooking.status}</dd>
                  <dt style={{ color: "var(--wb-muted-fg)" }}>Scheduled</dt>
                  <dd style={{ margin: 0 }}>
                    {formatDisplayDateTimeRange(interventionBooking.scheduled_start, interventionBooking.scheduled_end)}
                  </dd>
                  {opsModal.issueType ? (
                    <>
                      <dt style={{ color: "var(--wb-muted-fg)" }}>Exception</dt>
                      <dd style={{ margin: 0 }}>{formatOpsIssueType(opsModal.issueType)}</dd>
                    </>
                  ) : null}
                  <dt style={{ color: "var(--wb-muted-fg)" }}>Partner</dt>
                  <dd style={{ margin: 0 }}>
                    {interventionBooking.vendor_id
                      ? (vendorNameById.get(interventionBooking.vendor_id) ??
                        `${interventionBooking.vendor_id.slice(0, 8)}…`)
                      : "Unassigned"}
                  </dd>
                </dl>

                {isOpsExceptionPastWindow({
                  booking_id: interventionBooking.id,
                  reference_code: interventionBooking.reference_code,
                  status: interventionBooking.status,
                  vendor_id: interventionBooking.vendor_id,
                  technician_id: interventionBooking.technician_id,
                  scheduled_start: interventionBooking.scheduled_start,
                  scheduled_end: interventionBooking.scheduled_end,
                  created_at: interventionBooking.created_at,
                  issue_type: opsModal.issueType ?? null,
                  issue_level: null,
                  issue_label: null,
                }) ? (
                  <p style={{ margin: 0, fontSize: webTypography.size.sm, color: "var(--wb-muted-fg)" }}>
                    Scheduled window has ended. Direct assignment is disabled - resolve on{" "}
                    <Link to="/dashboard/bookings">Bookings</Link> or cancel if appropriate.
                  </p>
                ) : null}

                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", alignItems: "stretch" }}>
                  {showAssignInModal ? (
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      disabled={mutating}
                      onClick={() => opsModal && setOpsModal({ ...opsModal, view: "assign" })}
                    >
                      Assign partner…
                    </Button>
                  ) : null}

                  {interventionBooking.status === "confirmed" && canFloatToMarketplace(interventionBooking) ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      loading={floatMut.isPending}
                      disabled={mutating && !floatMut.isPending}
                      onClick={() => void floatMut.mutateAsync(interventionBooking.id)}
                    >
                      Float to partners (broadcast)
                    </Button>
                  ) : null}

                  {interventionBooking.status === "confirmed" && canRefloatMarketplace(interventionBooking) ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      loading={refloatMut.isPending}
                      disabled={mutating && !refloatMut.isPending}
                      onClick={() => void refloatMut.mutateAsync(interventionBooking.id)}
                    >
                      Re-float window (+1 hour)
                    </Button>
                  ) : null}

                  {modalIssueType && OPS_ISSUE_LABELS[modalIssueType] ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      loading={opsFlagMut.isPending}
                      disabled={mutating && !opsFlagMut.isPending}
                      onClick={() =>
                        void opsFlagMut.mutateAsync({ bookingId: interventionBooking.id, type: modalIssueType })
                      }
                    >
                      Record ops alert on booking
                    </Button>
                  ) : null}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => navigate("/dashboard/bookings")}
                  >
                    Open Bookings board
                  </Button>
                  <Link to="/dashboard/booking-routing" style={{ fontSize: webTypography.size.sm }}>
                    Booking routing
                  </Link>
                </div>
              </>
            ) : null}
            <div className="bm-modal-actions">
              <Button variant="outline" size="sm" type="button" disabled={mutating} onClick={closeInterventionModal}>
                Close
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}

function OpsExceptionRow({
  row,
  vendorNameById,
  onIntervene,
}: {
  row: OpsBookingExceptionRow;
  vendorNameById: Map<string, string>;
  onIntervene: () => void;
}) {
  const past = isOpsExceptionPastWindow(row);
  const partnerLabel = row.vendor_id
    ? (vendorNameById.get(row.vendor_id) ?? `${row.vendor_id.slice(0, 8)}…`)
    : "Unassigned";

  return (
    <tr>
      <td>
        <code className="bm-ref">{row.reference_code ?? row.booking_id.slice(0, 8)}</code>
      </td>
      <td>{row.status}</td>
      <td style={{ fontSize: "0.85rem", whiteSpace: "nowrap" }}>
        {formatDisplayDateTimeRange(row.scheduled_start, row.scheduled_end)}
        {past ? (
          <div className="bm-muted" style={{ marginTop: "0.2rem" }}>
            Past window
          </div>
        ) : null}
      </td>
      <td>
        {row.issue_level ? (
          <Badge tone={row.issue_level === "high" ? "danger" : "warning"}>
            {formatOpsIssueLevel(row.issue_level)}
          </Badge>
        ) : (
          "-"
        )}
      </td>
      <td className="bm-risk-line">
        <div>{formatOpsIssueType(row.issue_type)}</div>
        {row.issue_label ? (
          <div className="bm-muted" style={{ fontSize: "0.8rem", marginTop: "0.15rem" }}>
            {row.issue_label}
          </div>
        ) : null}
      </td>
      <td>{partnerLabel}</td>
      <td>
        <Button variant="primary" size="sm" type="button" onClick={onIntervene}>
          Intervene
        </Button>
      </td>
    </tr>
  );
}
