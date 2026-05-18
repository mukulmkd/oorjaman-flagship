import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  adminAssignVendorToBooking,
  adminFloatDefaultVendorBooking,
  adminFlagBookingOpsIssue,
  adminGetBookingsMonitoringBySubscriptionBucket,
  adminGetBookingsMonitoringBySubscriptionBucketPaged,
  adminRefloatMarketplaceBooking,
  queryKeys,
  readBookingRecipientMeta,
  readBookingServiceOtpMeta,
  vendorApi,
  type AdminBookingsSubscriptionBucket,
  type BookingMonitoringEnriched,
  type OpsIssueType,
} from "@oorjaman/api";
import type { Json } from "@oorjaman/api";
import { formatDisplayDateTime, formatDisplayDateTimeRange } from "@oorjaman/utils";
import { Badge, Button, Card, Modal, PageHeader, TableRowsSkeleton } from "@oorjaman/web-ui";
import { webTypography } from "../styles/typography";
import { useSupabase } from "../lib/supabase-context";
import { TablePaginationBar } from "../components/TablePaginationBar";
import "../layouts/dashboard-layout.css";

/** Shown as tooltip / modal copy when `vendor_routing.used_fallback` is true */
export const FALLBACK_ROUTING_HELP =
  "The customer’s preferred partner could not cover this location (service area rules). The booking was routed using their backup partner choice or OorjaMan’s platform default partner instead.";

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

type OpsRisk = {
  level: "medium" | "high";
  type: OpsIssueType;
  label: string;
};

type BookingActionState =
  | null
  | {
      row: BookingMonitoringEnriched;
      view: "menu" | "assign";
    };

function isFallbackBooking(row: BookingMonitoringEnriched): boolean {
  const m = row.metadata;
  if (!m || typeof m !== "object" || Array.isArray(m)) return false;
  const vr = (m as Record<string, unknown>).vendor_routing;
  if (!vr || typeof vr !== "object" || Array.isArray(vr)) return false;
  return (vr as Record<string, unknown>).used_fallback === true;
}

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
  if (addr == null) return "—";
  if (typeof addr === "string") return addr.trim() || "—";
  if (typeof addr === "object" && !Array.isArray(addr)) {
    const o = addr as Record<string, unknown>;
    if (typeof o.formatted === "string" && o.formatted.trim()) return o.formatted.trim();
  }
  return "—";
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

function detectOpsRisks(row: BookingMonitoringEnriched, now = new Date()): OpsRisk[] {
  const risks: OpsRisk[] = [];
  const createdAt = new Date(row.created_at);
  const scheduledStart = new Date(row.scheduled_start);
  const scheduledEnd = new Date(row.scheduled_end);
  const ageMs = now.getTime() - createdAt.getTime();
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
    const { openUntil } = readMarketplaceWindow(row);
    if (openUntil && now.getTime() > openUntil.getTime()) {
      risks.push({
        level: "high",
        type: "default_vendor_unclaimed",
        label: "Default-vendor window expired without claim",
      });
    }
  }
  if (row.status === "confirmed" && row.vendor_id && ageMs > 90 * 60 * 1000) {
    risks.push({
      level: "medium",
      type: "vendor_slow_confirmation",
      label: "Vendor has not progressed booking after confirmation",
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
    canFloatToMarketplace(row) ||
    canRefloatMarketplace(row) ||
    risks.length > 0
  );
}

export function BookingMonitoringPage() {
  const supabase = useSupabase();
  const qc = useQueryClient();
  const [bucketTab, setBucketTab] = useState<AdminBookingsSubscriptionBucket>("one_time");
  const [page, setPage] = useState(1);
  const [bookingAction, setBookingAction] = useState<BookingActionState>(null);
  const [assignVendorId, setAssignVendorId] = useState<string>("");

  useEffect(() => {
    setPage(1);
  }, [bucketTab]);

  const query = useQuery({
    queryKey: queryKeys.bookings.adminBookingsBucketPage(bucketTab, page, PAGE_SIZE),
    queryFn: () =>
      adminGetBookingsMonitoringBySubscriptionBucketPaged(supabase!, bucketTab, {
        page,
        pageSize: PAGE_SIZE,
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
      await qc.invalidateQueries({ queryKey: queryKeys.bookings.all() });
      await query.refetch();
      setBookingAction(null);
      setAssignVendorId("");
    },
  });
  const refloatMut = useMutation({
    mutationFn: async (bookingId: string) => adminRefloatMarketplaceBooking(supabase!, bookingId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.bookings.all() });
      await query.refetch();
      setBookingAction(null);
      setAssignVendorId("");
    },
  });
  const opsFlagMut = useMutation({
    mutationFn: async ({ bookingId, type }: { bookingId: string; type: OpsIssueType }) =>
      adminFlagBookingOpsIssue(supabase!, bookingId, type),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.bookings.all() });
      await query.refetch();
      setBookingAction(null);
    },
  });
  const assignMut = useMutation({
    mutationFn: async ({ bookingId, vendorId }: { bookingId: string; vendorId: string }) =>
      adminAssignVendorToBooking(supabase!, bookingId, vendorId),
    onSuccess: async () => {
      setBookingAction(null);
      setAssignVendorId("");
      await qc.invalidateQueries({ queryKey: queryKeys.bookings.all() });
      await query.refetch();
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
    setBookingAction({ row, view: "menu" });
    setAssignVendorId("");
  };

  const actionRow = bookingAction?.row ?? null;

  return (
    <>
      <PageHeader
        title="Bookings"
        subtitle="Browse one-time and AMC bookings. Use Action to assign a partner, open or extend the marketplace window, or flag an ops issue."
        actions={
          <Button variant="outline" size="sm" type="button" onClick={() => void query.refetch()}>
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
                <table className="bm-table">
                  <thead>
                    <tr>
                      <th>Reference</th>
                      <th>Status</th>
                      <th>Partner</th>
                      <th>Scheduled</th>
                      <th>Service for</th>
                      <th>Site</th>
                      <th>Notes</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map(({ row, risks }) => {
                      const timing = formatTiming(row);
                      const fb = isFallbackBooking(row);
                      const otp = readBookingServiceOtpMeta(row.metadata);
                      const otpLine =
                        row.status === "accepted" || row.status === "in_progress" || row.status === "completed"
                          ? `Codes: ${otp.startCode ?? "—"} / ${otp.happyCode ?? "—"}`
                          : "";
                      const cancelLine =
                        row.status === "cancelled" && row.cancellation_reason
                          ? ellipsize(row.cancellation_reason, 80)
                          : "";
                      const riskLine = risks.length > 0 ? risks.map((r) => r.label).join("; ") : "";
                      const extraNotes = [riskLine, cancelLine, otpLine].filter(Boolean).join(" · ");
                      const showNotesCell = fb || Boolean(extraNotes);

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
                            <Badge tone="neutral">{row.status}</Badge>
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
                          <td className="bm-table-note">
                            {!showNotesCell ? (
                              "—"
                            ) : (
                              <>
                                {fb ? (
                                  <abbr
                                    title={FALLBACK_ROUTING_HELP}
                                    style={{ cursor: "help", textDecoration: "underline dotted" }}
                                  >
                                    Fallback routing
                                  </abbr>
                                ) : null}
                                {fb && extraNotes ? " · " : null}
                                {extraNotes}
                              </>
                            )}
                          </td>
                          <td>
                            <Button size="sm" type="button" variant="outline" onClick={() => openActionMenu(row)}>
                              Action
                            </Button>
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
              <dd style={{ margin: 0 }}>{actionRow.status}</dd>
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
              {isFallbackBooking(actionRow) ? (
                <>
                  <dt style={{ color: "var(--wb-muted-fg)" }}>Routing</dt>
                  <dd style={{ margin: 0 }}>{FALLBACK_ROUTING_HELP}</dd>
                </>
              ) : null}
            </dl>

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
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  loading={opsFlagMut.isPending}
                  disabled={mutating && !opsFlagMut.isPending}
                  onClick={() =>
                    void opsFlagMut.mutateAsync({
                      bookingId: actionRow.id,
                      type: detectOpsRisks(actionRow)[0]!.type,
                    })
                  }
                >
                  Flag ops issue on booking
                </Button>
              ) : null}

              {!hasAssignableAction(actionRow, detectOpsRisks(actionRow)) ? (
                <p style={{ margin: 0, fontSize: webTypography.size.sm, color: "var(--wb-muted-fg)" }}>
                  No routing actions apply to this booking in its current state. Use Booking routing or messaging for
                  other workflows.
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

        {bookingAction?.view === "assign" && actionRow ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            <p style={{ margin: 0, fontSize: webTypography.size.sm, color: "var(--wb-muted-fg)", lineHeight: 1.5 }}>
              The partner&apos;s one-hour acceptance window starts when you confirm (unless a marketplace window is
              already active—then timers follow <code style={{ fontSize: "0.85em" }}>open_at</code>).
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
                  void assignMut.mutateAsync({ bookingId: actionRow.id, vendorId: assignVendorId });
                }}
              >
                Confirm assignment
              </Button>
            </div>
            {assignMut.isError ? <p className="bm-error">{(assignMut.error as Error).message}</p> : null}
          </div>
        ) : null}
      </Modal>
    </>
  );
}
