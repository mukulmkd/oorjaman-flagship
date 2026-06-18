import { webTypography } from "./../styles/typography";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useEffect, useMemo, useState } from "react";
import {
  adminGetPlatformSettings,
  adminListFallbackBookingsPaged,
  adminNotifyVendorFallbackReadiness,
  adminSetDefaultVendor,
  bookingUsedFallbackVendor,
  queryKeys,
  readBookingRecipientMeta,
  readBookingVendorRoutingMeta,
  vendorApi,
  type AdminFallbackRoutingFilter,
  type BookingRow,
} from "@oorjaman/api";
import { formatDisplayDateTime } from "@oorjaman/utils";
import { Badge, Button, Card, Modal, PageHeader, SkeletonBlock, TableRowsSkeleton } from "@oorjaman/web-ui";
import {
  formatRoutingDetailLines,
  getRoutingDisplay,
  ROUTING_REASON_LABELS,
} from "../lib/booking-routing-display";
import { useSupabase } from "@oorjaman/web-ui";
import { invalidateAdminBookingRoutingQueries } from "../lib/invalidate-admin-queries";
import { TablePaginationBar } from "@oorjaman/web-ui";

const PAGE_SIZE = 10;

const ROUTING_TABS: { id: AdminFallbackRoutingFilter; label: string; hint: string }[] = [
  {
    id: "partner_fallback",
    label: "Partner reassignment",
    hint: "Customer picked a specific partner but was routed to backup or platform default.",
  },
  {
    id: "marketplace",
    label: "Any partner (marketplace)",
    hint: "Customer chose any available partner, or AMC awaiting marketplace float.",
  },
  {
    id: "all",
    label: "All flagged",
    hint: "Every booking with used_fallback in metadata (includes marketplace).",
  },
];

function awaitingVendorReadiness(metadata: BookingRow["metadata"]): boolean {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return false;
  const vr = (metadata as Record<string, unknown>).vendor_routing;
  if (!vr || typeof vr !== "object" || Array.isArray(vr)) return false;
  return (vr as Record<string, unknown>).awaiting_vendor_readiness === true;
}

function serviceForLabel(row: BookingRow): string {
  const rec = readBookingRecipientMeta(row.metadata);
  if (!rec || rec.is_self) return "Customer";
  return rec.recipient_name?.trim() || "Someone else";
}

export function BookingRoutingPage() {
  const supabase = useSupabase();
  const qc = useQueryClient();
  const [selectedVendorId, setSelectedVendorId] = useState<string>("");
  const [routingTab, setRoutingTab] = useState<AdminFallbackRoutingFilter>("partner_fallback");
  const [page, setPage] = useState(1);
  const [actionRow, setActionRow] = useState<BookingRow | null>(null);

  useEffect(() => {
    setPage(1);
  }, [routingTab]);

  const settingsQuery = useQuery({
    queryKey: queryKeys.platform.settings(),
    queryFn: () => adminGetPlatformSettings(supabase!),
    enabled: Boolean(supabase),
  });

  const approvedVendorsQuery = useQuery({
    queryKey: queryKeys.vendors.adminList("approved"),
    queryFn: () => vendorApi.adminListVendors(supabase!, { approvalStatus: "approved", limit: 500 }),
    enabled: Boolean(supabase),
  });

  const fallbackBookingsQuery = useQuery({
    queryKey: queryKeys.bookings.adminFallbacksPage(page, PAGE_SIZE, routingTab),
    queryFn: () =>
      adminListFallbackBookingsPaged(supabase!, { page, pageSize: PAGE_SIZE, routingFilter: routingTab }),
    enabled: Boolean(supabase),
    placeholderData: (prev) => prev,
  });

  const fallbackRows = fallbackBookingsQuery.data?.rows ?? [];
  const fallbackTotal = fallbackBookingsQuery.data?.total ?? 0;

  const vendorNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const v of approvedVendorsQuery.data ?? []) {
      map.set(v.id, v.business_name);
    }
    return map;
  }, [approvedVendorsQuery.data]);

  useEffect(() => {
    const cur = settingsQuery.data?.default_vendor_id;
    if (cur != null) setSelectedVendorId(cur);
    else if (settingsQuery.isSuccess) setSelectedVendorId("");
  }, [settingsQuery.data?.default_vendor_id, settingsQuery.isSuccess]);

  const nudgeVendorMut = useMutation({
    mutationFn: async (bookingId: string) => {
      if (!supabase) throw new Error("No Supabase client");
      return adminNotifyVendorFallbackReadiness(supabase, bookingId);
    },
    onSuccess: async () => {
      setActionRow(null);
      await invalidateAdminBookingRoutingQueries(qc);
    },
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!supabase) throw new Error("No Supabase client");
      const id = selectedVendorId.trim() === "" ? null : selectedVendorId;
      return adminSetDefaultVendor(supabase, id);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.platform.settings() });
    },
  });

  const fmtTime = (iso: string) => formatDisplayDateTime(iso);
  const tabHint = ROUTING_TABS.find((t) => t.id === routingTab)?.hint ?? "";

  const canNudge =
    actionRow && bookingUsedFallbackVendor(actionRow) && actionRow.status === "confirmed" && actionRow.vendor_id
      ? actionRow
      : null;

  return (
    <>
      <PageHeader
        title="Booking routing"
        subtitle="Routing policy and marketplace configuration. Actionable marketplace rows also appear on Operations desk."
        actions={
          <Button variant="outline" size="sm" type="button" onClick={() => void fallbackBookingsQuery.refetch()}>
            Refresh activity
          </Button>
        }
      />

      {!supabase ? (
        <Card padded>
          <p className="dash-muted-line">Connect Supabase via Vite env variables.</p>
        </Card>
      ) : (
        <>
          <Card padded style={{ marginBottom: "1.25rem" }}>
            <h2 style={{ margin: "0 0 0.75rem", fontSize: webTypography.size.md, fontWeight: webTypography.weight.semibold }}>
              Platform default vendor
            </h2>
            <p style={{ margin: "0 0 1rem", fontSize: webTypography.size.sm, color: "var(--wb-muted-fg)", lineHeight: 1.5 }}>
              Used when the customer&apos;s own backup (Partners tab) cannot serve the saved location after their
              preferred partner is ineligible.
            </p>
            {settingsQuery.isLoading || approvedVendorsQuery.isLoading ? (
              <SkeletonBlock style={{ height: 48, maxWidth: "28rem" }} />
            ) : (
              <>
                <label className="dash-card-label" htmlFor="default-vendor">
                  Default vendor
                </label>
                <select
                  id="default-vendor"
                  className="vd-select vd-select--wide"
                  value={selectedVendorId}
                  onChange={(e) => setSelectedVendorId(e.target.value)}
                >
                  <option value="">- None (no platform fallback) -</option>
                  {(approvedVendorsQuery.data ?? []).map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.business_name}
                      {v.trade_name ? ` (${v.trade_name})` : ""}
                    </option>
                  ))}
                </select>
                <div style={{ marginTop: "1rem" }}>
                  <Button
                    variant="primary"
                    size="sm"
                    type="button"
                    loading={saveMut.isPending}
                    onClick={() => void saveMut.mutate()}
                  >
                    Save default
                  </Button>
                </div>
                {saveMut.isError ? (
                  <p style={{ marginTop: "0.75rem", color: "var(--wb-destructive, #b91c1c)", fontSize: webTypography.size.sm }}>
                    {(saveMut.error as Error).message}
                  </p>
                ) : null}
              </>
            )}
          </Card>

          <Card padded={false}>
            <div className="vd-card-head">
              <h2 style={{ margin: 0, fontSize: webTypography.size.md, fontWeight: webTypography.weight.semibold }}>
                Routing activity
              </h2>
              <div className="bm-tabs" role="tablist" aria-label="Routing type" style={{ marginTop: "0.75rem" }}>
                {ROUTING_TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={routingTab === t.id}
                    onClick={() => setRoutingTab(t.id)}
                    className={`bm-tab-btn ${routingTab === t.id ? "is-active" : ""}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <p className="vd-note vd-note-spaced">{tabHint}</p>
            </div>
            {fallbackBookingsQuery.isLoading ? (
              <div className="dash-table-skeleton-wrap">
                <TableRowsSkeleton rows={6} />
              </div>
            ) : fallbackBookingsQuery.isError ? (
              <div className="bm-block">
                <p className="dash-empty-title">Couldn&apos;t load routing bookings</p>
                <p className="dash-empty-error">{(fallbackBookingsQuery.error as Error).message}</p>
                <Button variant="primary" size="sm" type="button" onClick={() => void fallbackBookingsQuery.refetch()}>
                  Retry
                </Button>
              </div>
            ) : fallbackTotal === 0 ? (
              <p className="vd-empty">No bookings in this view.</p>
            ) : (
              <>
                <div className="bm-table-wrap">
                  <table className="bm-table">
                    <thead>
                      <tr>
                        <th>Reference</th>
                        <th>Status</th>
                        <th>Created</th>
                        <th>Assigned partner</th>
                        <th>Routing</th>
                        <th>Service for</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fallbackRows.map((row) => {
                        const routing = getRoutingDisplay(row.metadata);
                        const reasonKey = readBookingVendorRoutingMeta(row.metadata)?.reason;
                        const reasonLabel =
                          (reasonKey && ROUTING_REASON_LABELS[reasonKey]) || routing.shortLabel;
                        const assignedName = row.vendor_id
                          ? (vendorNameById.get(row.vendor_id) ?? row.vendor_id.slice(0, 8))
                          : "Unassigned";
                        return (
                          <tr key={row.id}>
                            <td className="bm-cell-mono">
                              <code>{row.reference_code}</code>
                            </td>
                            <td>
                              <Badge tone="neutral">{row.status}</Badge>
                            </td>
                            <td>{fmtTime(row.created_at)}</td>
                            <td>{assignedName}</td>
                            <td className="bm-col-routing">
                              <span
                                title={routing.detail ?? undefined}
                                className={`bm-routing-chip bm-routing-chip--${routing.kind === "marketplace" ? "marketplace" : routing.kind === "partner_fallback" ? "fallback" : "preferred"}`}
                              >
                                {reasonLabel}
                              </span>
                            </td>
                            <td>{serviceForLabel(row)}</td>
                            <td>
                              <Button size="sm" type="button" variant="outline" onClick={() => setActionRow(row)}>
                                Details
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div style={{ padding: "0.75rem 1rem" }}>
                  <TablePaginationBar page={page} pageSize={PAGE_SIZE} total={fallbackTotal} onPageChange={setPage} />
                </div>
                {nudgeVendorMut.isError ? (
                  <p className="dash-empty-error" style={{ padding: "0 1rem 1rem" }}>
                    {(nudgeVendorMut.error as Error).message}
                  </p>
                ) : null}
              </>
            )}
          </Card>

          <Modal
            open={Boolean(actionRow)}
            title={actionRow ? `Routing · ${actionRow.reference_code}` : "Booking"}
            onClose={() => {
              if (nudgeVendorMut.isPending) return;
              setActionRow(null);
            }}
          >
            {actionRow ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem", fontSize: webTypography.size.sm }}>
                <p style={{ margin: 0 }}>
                  <strong>Created:</strong> {fmtTime(actionRow.created_at)}
                </p>
                <p style={{ margin: 0 }}>
                  <strong>Service for:</strong> {serviceForLabel(actionRow)}
                </p>
                {getRoutingDisplay(actionRow.metadata).detail ? (
                  <p style={{ margin: 0, lineHeight: 1.45 }}>{getRoutingDisplay(actionRow.metadata).detail}</p>
                ) : null}
                <dl
                  style={{
                    margin: 0,
                    display: "grid",
                    gridTemplateColumns: "auto 1fr",
                    gap: "0.35rem 1rem",
                  }}
                >
                  {formatRoutingDetailLines(actionRow, vendorNameById).map((line) => (
                    <Fragment key={line.label}>
                      <dt style={{ color: "var(--wb-muted-fg)" }}>{line.label}</dt>
                      <dd style={{ margin: 0 }}>{line.value}</dd>
                    </Fragment>
                  ))}
                </dl>
                {actionRow.customer_notes?.trim() ? (
                  <p style={{ margin: 0 }}>
                    <strong>Customer notes:</strong> {actionRow.customer_notes.trim()}
                  </p>
                ) : null}
                {canNudge ? (
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    loading={nudgeVendorMut.isPending}
                    disabled={nudgeVendorMut.isPending}
                    onClick={() => void nudgeVendorMut.mutateAsync(canNudge.id)}
                  >
                    {awaitingVendorReadiness(canNudge.metadata) ? "Remind assigned partner" : "Notify assigned partner"}
                  </Button>
                ) : (
                  <p style={{ margin: 0, color: "var(--wb-muted-fg)" }}>
                    Partner nudge applies only to confirmed bookings with an assigned partner.
                  </p>
                )}
                <div className="web-modal-actions">
                  <Button variant="outline" type="button" disabled={nudgeVendorMut.isPending} onClick={() => setActionRow(null)}>
                    Close
                  </Button>
                </div>
              </div>
            ) : null}
          </Modal>
        </>
      )}
    </>
  );
}
