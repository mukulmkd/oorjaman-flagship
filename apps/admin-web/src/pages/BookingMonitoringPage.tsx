import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Fragment, useEffect, useMemo, useState } from "react";
import {
  adminAssignVendorToBooking,
  adminReassignAmcBookingVendor,
  adminNotifyOverdueVendorResponses,
  adminFloatDefaultVendorBooking,
  adminFlagBookingOpsIssue,
  adminGetBookingsMonitoringBySubscriptionBucket,
  adminGetBookingsMonitoringBySubscriptionBucketPaged,
  adminRefloatMarketplaceBooking,
  queryKeys,
  readBookingRecipientMeta,
  readBookingServiceOtpMeta,
  vendorApi,
  type AdminBookingsStatusFilter,
  type AdminBookingsSubscriptionBucket,
  type BookingStatus,
  isWithinVendorResponseWindow,
  readBookingVendorRoutingMeta,
  type BookingMonitoringEnriched,
  type OpsIssueType,
} from "@oorjaman/api";
import type { Json } from "@oorjaman/api";
import { formatDisplayDateTime, formatDisplayDateTimeRange } from "@oorjaman/utils";
import { Badge, Button, Card, Modal, PageHeader, TableRowsSkeleton } from "@oorjaman/web-ui";
import {
  formatRoutingDetailLines,
  getRoutingDisplay,
  OPS_ISSUE_LABELS,
} from "../lib/booking-routing-display";
import { webTypography } from "../styles/typography";
import { useSupabase } from "../lib/supabase-client";
import { invalidateAdminBookingMonitoringQueries } from "../lib/invalidate-admin-queries";
import { TablePaginationBar } from "../components/TablePaginationBar";

const BUCKET_TABS: { id: AdminBookingsSubscriptionBucket; label: string; hint: string }[] = [
  {
    id: "one_time",
    label: "One-time bookings",
    hint: "Pay-per-visit rows (no subscription). Partner response timer starts when assigned or when a marketplace window opens.",
  },
  {
    id: "amc",
    label: "AMC bookings",
    hint: "Subscription / AMC visits. Same assignment rules as one-time bookings.",
  },
];

const PAGE_SIZE = 10;
const RISK_SUMMARY_LIMIT = 800;

const STATUS_FILTER_TABS: { id: AdminBookingsStatusFilter; label: string }[] = [
  { id: "all", label: "All statuses" },
  { id: "pending_payment", label: "Pending payment" },
  { id: "confirmed", label: "Confirmed" },
  { id: "vendor_acknowledged", label: "Acknowledged" },
  { id: "accepted", label: "Accepted" },
  { id: "in_progress", label: "In progress" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
];

function bookingStatusTone(
  status: BookingStatus,
): "neutral" | "warning" | "success" | "danger" {
  switch (status) {
    case "confirmed":
    case "vendor_acknowledged":
      return "warning";
    case "accepted":
    case "in_progress":
    case "completed":
      return "success";
    case "cancelled":
      return "danger";
    default:
      return "neutral";
  }
}

function adminBookingStatusLabel(status: BookingStatus): string {
  switch (status) {
    case "pending_payment":
      return "Pending payment";
    case "confirmed":
      return "Confirmed";
    case "vendor_acknowledged":
      return "Acknowledged";
    case "accepted":
      return "Accepted";
    case "in_progress":
      return "In progress";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

type OpsRisk = {
  level: "medium" | "high";
  type: OpsIssueType;
  label: string;
};

type BookingActionState =
  | null
  | {
    row: BookingMonitoringEnriched;
    view: "menu" | "assign" | "amc_reassign";
  };

function formatTiming(row: BookingMonitoringEnriched): { scheduled: string; actual?: string } {
  const scheduled = formatDisplayDateTimeRange(row.scheduled_start, row.scheduled_end);
  if (row.actual_start || row.actual_end) {
    const parts: string[] = [];
    if (row.actual_start) parts.push(`Start ${formatDisplayDateTime(row.actual_start)}`);
    if (row.actual_end) parts.push(`End ${formatDisplayDateTime(row.actual_end)}`);
    return { scheduled, actual: parts.join(" · ") };
  }
  return { scheduled };
}

function formatSiteLine(addr: Json): string {
  if (addr == null) return "-";
  if (typeof addr === "string") return addr.trim() || "-";
  if (typeof addr === "object" && !Array.isArray(addr)) {
    const o = addr as Record<string, unknown>;
    if (typeof o.formatted === "string" && o.formatted.trim()) return o.formatted.trim();
  }
  return "-";
}

function ellipsize(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return t.slice(0, Math.max(0, max - 1)) + "…";
}

function bookingForLabel(row: BookingMonitoringEnriched): string {
  const rec = readBookingRecipientMeta(row.metadata);
  if (!rec) return "Customer";
  if (rec.is_self) return "Customer";
  return rec.recipient_name?.trim() || "Someone else";
}

function readMarketplaceWindow(row: BookingMonitoringEnriched): { openUntil: Date | null } {
  const m = row.metadata;
  if (!m || typeof m !== "object" || Array.isArray(m)) return { openUntil: null };
  const marketplace = (m as Record<string, unknown>).marketplace;
  if (!marketplace || typeof marketplace !== "object" || Array.isArray(marketplace)) return { openUntil: null };
  const ou = (marketplace as Record<string, unknown>).open_until;
  if (typeof ou !== "string") return { openUntil: null };
  const d = new Date(ou);
  return { openUntil: Number.isFinite(d.getTime()) ? d : null };
}

function awaitingVendorReassignment(row: BookingMonitoringEnriched): boolean {
  const m = row.metadata;
  if (!m || typeof m !== "object" || Array.isArray(m)) return false;
  const vr = (m as Record<string, unknown>).vendor_reassignment;
  if (!vr || typeof vr !== "object" || Array.isArray(vr)) return false;
  return (vr as Record<string, unknown>).awaiting_admin_assignment === true;
}

function canFloatToMarketplace(row: BookingMonitoringEnriched): boolean {
  if (row.vendor_id) return false;
  if (row.status !== "confirmed") return false;
  const m = row.metadata;
  if (!m || typeof m !== "object" || Array.isArray(m)) return false;
  const marketplace = (m as Record<string, unknown>).marketplace;
  if (!marketplace || typeof marketplace !== "object" || Array.isArray(marketplace)) return false;
  const mp = marketplace as Record<string, unknown>;
  return mp.mode === "default_vendor" && mp.floated !== true;
}

function canRefloatMarketplace(row: BookingMonitoringEnriched): boolean {
  if (row.vendor_id) return false;
  if (row.status !== "confirmed") return false;
  const m = row.metadata;
  if (!m || typeof m !== "object" || Array.isArray(m)) return false;
  const marketplace = (m as Record<string, unknown>).marketplace;
  if (!marketplace || typeof marketplace !== "object" || Array.isArray(marketplace)) return false;
  const mp = marketplace as Record<string, unknown>;
  return mp.mode === "default_vendor" && mp.floated === true;
}

function needsVendorAssignment(row: BookingMonitoringEnriched): boolean {
  return row.status === "confirmed" && !row.vendor_id;
}

const AMC_REASSIGN_STATUSES: BookingStatus[] = ["confirmed", "accepted", "in_progress"];

function canReassignAmcBooking(row: BookingMonitoringEnriched): boolean {
  if (!row.subscription_id) return false;
  if (!AMC_REASSIGN_STATUSES.includes(row.status)) return false;
  return Boolean(row.vendor_id);
}

function detectOpsRisks(row: BookingMonitoringEnriched, now = new Date()): OpsRisk[] {
  const risks: OpsRisk[] = [];
  const scheduledStart = new Date(row.scheduled_start);
  const scheduledEnd = new Date(row.scheduled_end);
  const sinceStartMs = now.getTime() - scheduledStart.getTime();
  const sinceEndMs = now.getTime() - scheduledEnd.getTime();

  if (row.status === "confirmed" && awaitingVendorReassignment(row)) {
    risks.push({
      level: "high",
      type: "default_vendor_unclaimed",
      label: "Vendor cancelled after acceptance; reassignment needed",
    });
  }

  if (row.status === "confirmed" && !row.vendor_id) {
    const m = row.metadata;
    const marketplace =
      m && typeof m === "object" && !Array.isArray(m)
        ? (m as Record<string, unknown>).marketplace
        : null;
    const mp =
      marketplace && typeof marketplace === "object" && !Array.isArray(marketplace)
        ? (marketplace as Record<string, unknown>)
        : null;
    if (mp?.mode === "default_vendor" && mp?.awaiting_admin_float === true) {
      risks.push({
        level: "high",
        type: "awaiting_admin_float",
        label: "Any-partner booking - float to marketplace from Actions",
      });
    }
    const { openUntil } = readMarketplaceWindow(row);
    if (openUntil && now.getTime() > openUntil.getTime()) {
      risks.push({
        level: "high",
        type: "default_vendor_unclaimed",
        label: "Default-vendor window expired without claim",
      });
    }
  }
  if (
    row.status === "confirmed" &&
    row.vendor_id &&
    !row.technician_id &&
    !isWithinVendorResponseWindow(row, now)
  ) {
    const routing = readBookingVendorRoutingMeta(row.metadata);
    const isPreferred = routing?.reason === "preferred_ok";
    risks.push({
      level: isPreferred ? "high" : "medium",
      type: isPreferred ? "preferred_vendor_no_response" : "vendor_slow_confirmation",
      label: isPreferred
        ? "Preferred partner missed 1-hour accept/assign window"
        : "Partner missed 1-hour accept/assign window",
    });
  }
  if ((row.status === "accepted" || row.status === "in_progress") && !row.actual_start && sinceStartMs > 2 * 60 * 60 * 1000) {
    risks.push({
      level: "high",
      type: "visit_not_started",
      label: "Visit not started 2h after scheduled start",
    });
  }
  if (row.status === "in_progress" && !row.actual_end && sinceEndMs > 2 * 60 * 60 * 1000) {
    risks.push({
      level: "medium",
      type: "visit_not_closed",
      label: "Visit not closed 2h after scheduled end",
    });
  }
  if (row.status === "confirmed" && sinceStartMs > 60 * 60 * 1000) {
    risks.push({
      level: "high",
      type: "schedule_missed",
      label: "Scheduled window already started without assignment/progress",
    });
  }
  return risks;
}

function hasAssignableAction(row: BookingMonitoringEnriched, risks: OpsRisk[]): boolean {
  return (
    needsVendorAssignment(row) ||
    canReassignAmcBooking(row) ||
    canFloatToMarketplace(row) ||
    canRefloatMarketplace(row) ||
    risks.length > 0
  );
}

export function BookingMonitoringPage() {
  const supabase = useSupabase();
  const qc = useQueryClient();
  const [bucketTab, setBucketTab] = useState<AdminBookingsSubscriptionBucket>("one_time");
  const [statusFilter, setStatusFilter] = useState<AdminBookingsStatusFilter>("all");
  const [page, setPage] = useState(1);
  const [bookingAction, setBookingAction] = useState<BookingActionState>(null);
  const [assignVendorId, setAssignVendorId] = useState<string>("");
  const [opsIssueType, setOpsIssueType] = useState<OpsIssueType | "">("");

  useEffect(() => {
    setPage(1);
  }, [bucketTab, statusFilter]);

  const query = useQuery({
    queryKey: queryKeys.bookings.adminBookingsBucketPage(bucketTab, page, PAGE_SIZE, statusFilter),
    queryFn: () =>
      adminGetBookingsMonitoringBySubscriptionBucketPaged(supabase!, bucketTab, {
        page,
        pageSize: PAGE_SIZE,
        status: statusFilter,
      }),
    enabled: Boolean(supabase),
    placeholderData: (prev) => prev,
  });

  const summaryQuery = useQuery({
    queryKey: queryKeys.bookings.adminBookingsBucket(bucketTab, RISK_SUMMARY_LIMIT),
    queryFn: () => adminGetBookingsMonitoringBySubscriptionBucket(supabase!, bucketTab, { limit: RISK_SUMMARY_LIMIT }),
    enabled: Boolean(supabase),
    staleTime: 60_000,
  });
  const approvedVendorsQuery = useQuery({
    queryKey: queryKeys.vendors.adminList("approved"),
    queryFn: () => vendorApi.adminListVendors(supabase!, { approvalStatus: "approved", limit: 500 }),
    enabled: Boolean(supabase),
  });

  const tabHint = useMemo(() => BUCKET_TABS.find((t) => t.id === bucketTab)?.hint ?? "", [bucketTab]);

  const floatMut = useMutation({
    mutationFn: async (bookingId: string) => adminFloatDefaultVendorBooking(supabase!, bookingId),
    onSuccess: async () => {
      await invalidateAdminBookingMonitoringQueries(qc, bucketTab);
      setBookingAction(null);
      setAssignVendorId("");
    },
  });
  const refloatMut = useMutation({
    mutationFn: async (bookingId: string) => adminRefloatMarketplaceBooking(supabase!, bookingId),
    onSuccess: async () => {
      await invalidateAdminBookingMonitoringQueries(qc, bucketTab);
      setBookingAction(null);
      setAssignVendorId("");
    },
  });
  const opsFlagMut = useMutation({
    mutationFn: async ({ bookingId, type }: { bookingId: string; type: OpsIssueType }) =>
      adminFlagBookingOpsIssue(supabase!, bookingId, type),
    onSuccess: async () => {
      await invalidateAdminBookingMonitoringQueries(qc, bucketTab);
      setBookingAction(null);
    },
  });
  const assignMut = useMutation({
    mutationFn: async ({
      bookingId,
      vendorId,
      amcReassign,
    }: {
      bookingId: string;
      vendorId: string;
      amcReassign?: boolean;
    }) =>
      amcReassign
        ? adminReassignAmcBookingVendor(supabase!, bookingId, vendorId)
        : adminAssignVendorToBooking(supabase!, bookingId, vendorId),
    onSuccess: async () => {
      setBookingAction(null);
      setAssignVendorId("");
      await invalidateAdminBookingMonitoringQueries(qc, bucketTab);
    },
  });

  const rowsWithRisk = useMemo(
    () =>
      (summaryQuery.data ?? []).map((row) => ({
        row,
        risks: detectOpsRisks(row),
      })),
    [summaryQuery.data],
  );
  const tableRows =
    (query.data?.rows ?? []).map((row) => ({
      row,
      risks: detectOpsRisks(row),
    })) ?? [];
  const totalBookings = query.data?.total ?? 0;
  const highRiskCount = rowsWithRisk.filter((x) => x.risks.some((r) => r.level === "high")).length;
  const medRiskCount = rowsWithRisk.filter((x) => x.risks.some((r) => r.level === "medium")).length;

  const mutating =
    floatMut.isPending || refloatMut.isPending || opsFlagMut.isPending || assignMut.isPending;

  const closeActionModal = () => {
    if (mutating) return;
    setBookingAction(null);
    setAssignVendorId("");
  };

  const openActionMenu = (row: BookingMonitoringEnriched) => {
    const risks = detectOpsRisks(row);
    setBookingAction({ row, view: "menu" });
    setAssignVendorId("");
    setOpsIssueType(risks[0]?.type ?? "");
  };

  const vendorNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const v of approvedVendorsQuery.data ?? []) {
      map.set(v.id, v.business_name);
    }
    return map;
  }, [approvedVendorsQuery.data]);

  const actionRow = bookingAction?.row ?? null;

  return (
    <>
      <PageHeader
        title="Bookings"
        subtitle="Search and audit all bookings. For live triage (assign partner, OTP reset, AMC setup), use Operations desk."
        actions={
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => {
              if (supabase) {
                void adminNotifyOverdueVendorResponses(supabase, { limit: 200 }).then(() => query.refetch());
              } else {
                void query.refetch();
              }
            }}
          >
            Refresh
          </Button>
        }
      />

      {!supabase ? (
        <Card padded>
          <p className="bm-muted">Connect Supabase via Vite env variables.</p>
        </Card>
      ) : (
        <div className="bm-stack">
          <Card padded className="bm-filter-card">
            <div className="bm-risk-kpis">
              <span className="bm-risk-chip bm-risk-chip-high">High risk: {highRiskCount}</span>
              <span className="bm-risk-chip bm-risk-chip-med">Medium risk: {medRiskCount}</span>
              <span className="bm-hint" style={{ marginLeft: "0.35rem" }}>
                Risk counts from the latest {RISK_SUMMARY_LIMIT.toLocaleString()} loaded rows.
              </span>
            </div>
            <div className="bm-tabs" role="tablist" aria-label="Booking type">
              {BUCKET_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={bucketTab === t.id}
                  onClick={() => setBucketTab(t.id)}
                  className={`bm-tab-btn ${bucketTab === t.id ? "is-active" : ""}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="bm-tabs bm-status-tabs" role="tablist" aria-label="Booking status">
              {STATUS_FILTER_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={statusFilter === t.id}
                  onClick={() => setStatusFilter(t.id)}
                  className={`bm-tab-btn bm-status-tab-btn bm-status-tab-btn--${t.id} ${statusFilter === t.id ? "is-active" : ""}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <p className="bm-hint">{tabHint}</p>
          </Card>

          <Card padded={false}>
            {query.isLoading ? (
              <div className="bm-block-skeleton">
                <TableRowsSkeleton rows={8} />
              </div>
            ) : query.isError ? (
              <div className="bm-block">
                <p className="bm-title">Couldn&apos;t load bookings</p>
                <p className="bm-error">{(query.error as Error).message}</p>
                <Button variant="primary" size="sm" type="button" onClick={() => void query.refetch()}>
                  Retry
                </Button>
              </div>
            ) : totalBookings === 0 ? (
              <p className="bm-empty">No bookings in this view.</p>
            ) : (
              <>
                <div className="bm-table-wrap">
                  <table className="bm-table bm-table--bookings">
                    <thead>
                      <tr>
                        <th>Reference</th>
                        <th>Status</th>
                        <th>Partner</th>
                        <th>Scheduled</th>
                        <th>Service for</th>
                        <th>Site</th>
                        <th className="bm-col-routing">Routing</th>
                        <th className="bm-col-alerts">Alerts</th>
                        <th className="bm-col-action">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableRows.map(({ row, risks }) => {
                        const timing = formatTiming(row);
                        const routing = getRoutingDisplay(row.metadata);
                        const routingChipClass =
                          routing.kind === "marketplace"
                            ? "bm-routing-chip bm-routing-chip--marketplace"
                            : routing.kind === "partner_fallback"
                              ? "bm-routing-chip bm-routing-chip--fallback"
                              : routing.kind === "preferred"
                                ? "bm-routing-chip bm-routing-chip--preferred"
                                : "bm-routing-chip";
                        const sortedRisks = [...risks].sort((a, b) =>
                          a.level === "high" && b.level !== "high" ? -1 : b.level === "high" && a.level !== "high" ? 1 : 0,
                        );
                        const primaryRisk = sortedRisks[0];
                        const extraRiskCount = Math.max(0, sortedRisks.length - 1);
                        const hasAlerts = primaryRisk != null;

                        return (
                          <tr key={row.id}>
                            <td className="bm-cell-mono">
                              {row.reference_code}
                              {bucketTab === "amc" ? (
                                <Badge
                                  tone="neutral"
                                  style={{ marginLeft: "0.35rem", fontSize: webTypography.size.xs }}
                                >
                                  AMC
                                </Badge>
                              ) : null}
                            </td>
                            <td>
                              <Badge tone={bookingStatusTone(row.status)}>{adminBookingStatusLabel(row.status)}</Badge>
                            </td>
                            <td>
                              {row.vendorDisplayName ??
                                (row.vendor_id ? row.vendor_id.slice(0, 8) + "…" : "Unassigned")}
                            </td>
                            <td className="bm-timing">
                              {timing.scheduled}
                              {timing.actual ? (
                                <div className="bm-timing-actual">{timing.actual}</div>
                              ) : null}
                            </td>
                            <td>{bookingForLabel(row)}</td>
                            <td className="bm-table-note">{ellipsize(formatSiteLine(row.service_site_address), 48)}</td>
                            <td className="bm-col-routing">
                              <div className="bm-cell-stack">
                                {routing.kind === "none" ? (
                                  <span className="bm-muted-dash">-</span>
                                ) : (
                                  <span title={routing.detail ?? undefined} className={routingChipClass}>
                                    {routing.shortLabel}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="bm-col-alerts">
                              <div className="bm-cell-stack">
                                {!hasAlerts ? (
                                  <span className="bm-muted-dash">-</span>
                                ) : (
                                  <>
                                    {primaryRisk ? (
                                      <span
                                        className={`bm-alert-chip bm-alert-chip--${primaryRisk.level}`}
                                        title={primaryRisk.label}
                                      >
                                        {primaryRisk.label}
                                      </span>
                                    ) : null}
                                    {extraRiskCount > 0 ? (
                                      <span className="bm-alert-chip bm-alert-chip--more">
                                        +{extraRiskCount} more in Action
                                      </span>
                                    ) : null}
                                  </>
                                )}
                              </div>
                            </td>
                            <td className="bm-col-action">
                              <div className="bm-cell-stack bm-cell-stack--end">
                                <Button size="sm" type="button" variant="outline" onClick={() => openActionMenu(row)}>
                                  Action
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div style={{ padding: "0.75rem 1rem" }}>
                  <TablePaginationBar page={page} pageSize={PAGE_SIZE} total={totalBookings} onPageChange={setPage} />
                </div>
              </>
            )}
          </Card>
        </div>
      )}

      <Modal
        open={Boolean(bookingAction && actionRow)}
        title={
          bookingAction?.view === "assign"
            ? "Assign partner"
            : bookingAction?.view === "amc_reassign"
              ? "Change AMC partner"
              : bookingAction?.row
                ? `Actions · ${bookingAction.row.reference_code}`
                : "Actions"
        }
        description={
          actionRow
            ? `${formatTiming(actionRow).scheduled} · ${bookingForLabel(actionRow)}`
            : undefined
        }
        onClose={closeActionModal}
      >
        {bookingAction?.view === "menu" && actionRow ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
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
              <dd style={{ margin: 0 }}>
                <Badge tone={bookingStatusTone(actionRow.status)}>{adminBookingStatusLabel(actionRow.status)}</Badge>
              </dd>
              <dt style={{ color: "var(--wb-muted-fg)" }}>Partner</dt>
              <dd style={{ margin: 0 }}>
                {actionRow.vendorDisplayName ??
                  (actionRow.vendor_id ? actionRow.vendor_id.slice(0, 12) + "…" : "Unassigned")}
              </dd>
              <dt style={{ color: "var(--wb-muted-fg)" }}>Site</dt>
              <dd style={{ margin: 0, lineHeight: 1.45 }}>
                {formatSiteLine(actionRow.service_site_address)}
              </dd>
              {bucketTab === "amc" && actionRow.subscription_id ? (
                <>
                  <dt style={{ color: "var(--wb-muted-fg)" }}>Subscription</dt>
                  <dd style={{ margin: 0, fontFamily: "ui-monospace, monospace", fontSize: webTypography.size.xs }}>
                    {actionRow.subscription_id}
                  </dd>
                </>
              ) : null}
              {getRoutingDisplay(actionRow.metadata).detail ? (
                <>
                  <dt style={{ color: "var(--wb-muted-fg)" }}>Routing note</dt>
                  <dd style={{ margin: 0, lineHeight: 1.45 }}>{getRoutingDisplay(actionRow.metadata).detail}</dd>
                </>
              ) : null}
              {actionRow.customer_notes?.trim() ? (
                <>
                  <dt style={{ color: "var(--wb-muted-fg)" }}>Customer notes</dt>
                  <dd style={{ margin: 0, lineHeight: 1.45 }}>{actionRow.customer_notes.trim()}</dd>
                </>
              ) : null}
              {actionRow.status === "cancelled" && actionRow.cancellation_reason ? (
                <>
                  <dt style={{ color: "var(--wb-muted-fg)" }}>Cancellation</dt>
                  <dd style={{ margin: 0, lineHeight: 1.45 }}>{actionRow.cancellation_reason}</dd>
                </>
              ) : null}
              {actionRow.status === "accepted" ||
                actionRow.status === "in_progress" ||
                actionRow.status === "completed" ? (
                <>
                  <dt style={{ color: "var(--wb-muted-fg)" }}>Visit codes</dt>
                  <dd style={{ margin: 0, fontFamily: "ui-monospace, monospace", fontSize: webTypography.size.xs }}>
                    {(() => {
                      const otp = readBookingServiceOtpMeta(actionRow.metadata);
                      return `${otp.startCode ?? "-"} / ${otp.happyCode ?? "-"}`;
                    })()}
                  </dd>
                </>
              ) : null}
            </dl>

            {formatRoutingDetailLines(actionRow, vendorNameById).length > 0 ? (
              <dl
                style={{
                  margin: 0,
                  display: "grid",
                  gridTemplateColumns: "auto 1fr",
                  gap: "0.35rem 1rem",
                  fontSize: webTypography.size.sm,
                  padding: "0.65rem 0.75rem",
                  borderRadius: 8,
                  background: "var(--wb-muted)",
                }}
              >
                {formatRoutingDetailLines(actionRow, vendorNameById).map((line) => (
                  <Fragment key={line.label}>
                    <dt style={{ color: "var(--wb-muted-fg)" }}>{line.label}</dt>
                    <dd style={{ margin: 0 }}>{line.value}</dd>
                  </Fragment>
                ))}
              </dl>
            ) : null}

            {(getRoutingDisplay(actionRow.metadata).kind === "partner_fallback" ||
              getRoutingDisplay(actionRow.metadata).kind === "marketplace") && (
                <p style={{ margin: 0, fontSize: webTypography.size.sm }}>
                  <Link to="/dashboard/booking-routing">Open Booking routing</Link> for marketplace defaults and
                  reassignment history.
                </p>
              )}

            {detectOpsRisks(actionRow).length > 0 ? (
              <p style={{ margin: 0, fontSize: webTypography.size.sm, color: "var(--wb-destructive, #b91c1c)" }}>
                Alerts: {detectOpsRisks(actionRow)
                  .map((r) => r.label)
                  .join(" · ")}
              </p>
            ) : null}

            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", alignItems: "stretch" }}>
              {needsVendorAssignment(actionRow) ? (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={mutating}
                  onClick={() => setBookingAction({ row: actionRow, view: "assign" })}
                >
                  Assign partner…
                </Button>
              ) : null}

              {canReassignAmcBooking(actionRow) ? (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={mutating}
                  onClick={() => setBookingAction({ row: actionRow, view: "amc_reassign" })}
                >
                  Change AMC partner…
                </Button>
              ) : null}

              {canFloatToMarketplace(actionRow) ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  loading={floatMut.isPending}
                  disabled={mutating && !floatMut.isPending}
                  onClick={() => void floatMut.mutateAsync(actionRow.id)}
                >
                  Float to vendors (broadcast)
                </Button>
              ) : null}

              {canRefloatMarketplace(actionRow) ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  loading={refloatMut.isPending}
                  disabled={mutating && !refloatMut.isPending}
                  onClick={() => void refloatMut.mutateAsync(actionRow.id)}
                >
                  Re-float window (+1 hour)
                </Button>
              ) : null}

              {detectOpsRisks(actionRow).length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <p style={{ margin: 0, fontSize: webTypography.size.sm, color: "var(--wb-muted-fg)" }}>
                    Record an ops alert on this booking for reporting (saved on the booking record).
                  </p>
                  {detectOpsRisks(actionRow).length > 1 ? (
                    <label className="dash-card-label" htmlFor="ops-issue-type-select">
                      Alert type
                    </label>
                  ) : null}
                  {detectOpsRisks(actionRow).length > 1 ? (
                    <select
                      id="ops-issue-type-select"
                      className="vd-select bm-select"
                      value={opsIssueType}
                      onChange={(e) => setOpsIssueType(e.target.value as OpsIssueType)}
                    >
                      {detectOpsRisks(actionRow).map((r) => (
                        <option key={r.type} value={r.type}>
                          {OPS_ISSUE_LABELS[r.type]} - {r.label}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    loading={opsFlagMut.isPending}
                    disabled={mutating && !opsFlagMut.isPending}
                    onClick={() => {
                      const type = (opsIssueType || detectOpsRisks(actionRow)[0]?.type) as OpsIssueType;
                      if (!type) return;
                      void opsFlagMut.mutateAsync({ bookingId: actionRow.id, type });
                    }}
                  >
                    Record ops alert on booking
                  </Button>
                </div>
              ) : null}

              {!hasAssignableAction(actionRow, detectOpsRisks(actionRow)) ? (
                <p style={{ margin: 0, fontSize: webTypography.size.sm, color: "var(--wb-muted-fg)" }}>
                  No assignment actions for this state. Use{" "}
                  <Link to="/dashboard/booking-routing">Booking routing</Link> or support messaging if needed.
                </p>
              ) : null}
            </div>
            <div className="bm-modal-actions">
              <Button variant="outline" size="sm" type="button" disabled={mutating} onClick={closeActionModal}>
                Close
              </Button>
            </div>
          </div>
        ) : null}

        {(bookingAction?.view === "assign" || bookingAction?.view === "amc_reassign") && actionRow ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            <p style={{ margin: 0, fontSize: webTypography.size.sm, color: "var(--wb-muted-fg)", lineHeight: 1.5 }}>
              {bookingAction.view === "amc_reassign"
                ? "Reassign this AMC visit only. The contract default partner stays the same unless you change it from AMC wallets. Wallet payout goes to whoever completes the visit."
                : "The partner's one-hour acceptance window starts when you confirm (unless a marketplace window is already active-then timers follow open_at)."}
            </p>
            <label className="dash-card-label" htmlFor="assign-vendor-modal-select">
              Approved partner
            </label>
            <select
              id="assign-vendor-modal-select"
              className="vd-select bm-select"
              value={assignVendorId}
              onChange={(e) => setAssignVendorId(e.target.value)}
            >
              <option value="">Select partner…</option>
              {(approvedVendorsQuery.data ?? []).map((v) => (
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
                onClick={() => setBookingAction({ row: actionRow, view: "menu" })}
              >
                Back
              </Button>
              <Button
                variant="outline"
                size="sm"
                type="button"
                disabled={assignMut.isPending}
                onClick={closeActionModal}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                type="button"
                loading={assignMut.isPending}
                disabled={!assignVendorId}
                onClick={() => {
                  if (!assignVendorId) return;
                  void assignMut.mutateAsync({
                    bookingId: actionRow.id,
                    vendorId: assignVendorId,
                    amcReassign: bookingAction?.view === "amc_reassign",
                  });
                }}
              >
                {bookingAction?.view === "amc_reassign" ? "Confirm change" : "Confirm assignment"}
              </Button>
            </div>
            {assignMut.isError ? <p className="bm-error">{(assignMut.error as Error).message}</p> : null}
          </div>
        ) : null}
      </Modal>
    </>
  );
}
