import { webTypography } from "./../styles/typography";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  adminGetPlatformSettings,
  adminListFallbackBookingsPaged,
  adminNotifyVendorFallbackReadiness,
  adminSetDefaultVendor,
  bookingUsedFallbackVendor,
  queryKeys,
  readBookingRecipientMeta,
  vendorApi,
} from "@oorjaman/api";
import type { BookingRow } from "@oorjaman/api";
import { formatDisplayDateTime } from "@oorjaman/utils";
import { Badge, Button, Card, Modal, PageHeader, SkeletonBlock, TableRowsSkeleton } from "@oorjaman/web-ui";
import { useSupabase } from "../lib/supabase-context";
import { TablePaginationBar } from "../components/TablePaginationBar";
import "../layouts/dashboard-layout.css";

const PAGE_SIZE = 10;

const REASON_LABELS: Record<string, string> = {
  preferred_ok: "Preferred served",
  preferred_ineligible_customer_fallback: "Fallback: customer default",
  preferred_ineligible_platform_default: "Fallback: platform default",
  preferred_missing_customer_fallback: "Preferred missing - customer default",
  preferred_missing_platform_default: "Preferred missing - platform default",
};

function awaitingVendorReadiness(metadata: BookingRow["metadata"]): boolean {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return false;
  const vr = (metadata as Record<string, unknown>).vendor_routing;
  if (!vr || typeof vr !== "object" || Array.isArray(vr)) return false;
  return (vr as Record<string, unknown>).awaiting_vendor_readiness === true;
}

function routingMeta(row: BookingRow): {
  requested?: string;
  resolved?: string;
  usedFallback?: boolean;
  reason?: string;
} {
  const m = row.metadata;
  if (!m || typeof m !== "object" || Array.isArray(m)) return {};
  const vr = (m as Record<string, unknown>).vendor_routing;
  if (!vr || typeof vr !== "object" || Array.isArray(vr)) return {};
  const o = vr as Record<string, unknown>;
  return {
    requested: typeof o.requested_vendor_id === "string" ? o.requested_vendor_id : undefined,
    resolved: typeof o.resolved_vendor_id === "string" ? o.resolved_vendor_id : undefined,
    usedFallback: o.used_fallback === true,
    reason: typeof o.reason === "string" ? o.reason : undefined,
  };
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
  const [page, setPage] = useState(1);
  const [actionRow, setActionRow] = useState<BookingRow | null>(null);

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
    queryKey: queryKeys.bookings.adminFallbacksPage(page, PAGE_SIZE),
    queryFn: () => adminListFallbackBookingsPaged(supabase!, { page, pageSize: PAGE_SIZE }),
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
      await qc.invalidateQueries({ queryKey: queryKeys.bookings.all() });
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

  const canNudge =
    actionRow && bookingUsedFallbackVendor(actionRow) && actionRow.status === "confirmed" ? actionRow : null;

  return (
    <>
      <PageHeader
        title="Booking routing"
        subtitle="Set the platform-wide fallback vendor when a customer’s preferred partner cannot serve their saved location. Monitor automatic reassignments."
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
            <h2 style={{ margin: "0 0 0.75rem", fontSize: webTypography.size.md, fontWeight: webTypography.weight.semibold }}>Platform default vendor</h2>
            <p style={{ margin: "0 0 1rem", fontSize: webTypography.size.sm, color: "var(--wb-muted-fg)", lineHeight: 1.5 }}>
              Used after the customer’s own fallback (Partners tab) when the selected vendor doesn’t cover the service
              area.
            </p>
            {settingsQuery.isLoading || approvedVendorsQuery.isLoading ? (
              <SkeletonBlock style={{ height: 48, maxWidth: "28rem" }} />
            ) : (
              <>
                <label htmlFor="default-vendor" style={{ display: "block", fontSize: webTypography.size.sm, marginBottom: "0.5rem" }}>
                  Default vendor
                </label>
                <select
                  id="default-vendor"
                  value={selectedVendorId}
                  onChange={(e) => setSelectedVendorId(e.target.value)}
                  style={{
                    width: "100%",
                    maxWidth: "28rem",
                    padding: "0.5rem 0.75rem",
                    borderRadius: "8px",
                    border: "1px solid var(--wb-border, #e5e5e5)",
                    fontSize: webTypography.size.sm,
                  }}
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
              <h2 style={{ margin: 0, fontSize: webTypography.size.md, fontWeight: webTypography.weight.semibold }}>Fallback assignments</h2>
              <p className="vd-note vd-note-spaced">
                Bookings where the assigned partner was chosen automatically (metadata.vendor_routing.used_fallback).
              </p>
            </div>
            {fallbackBookingsQuery.isLoading ? (
              <div className="dash-table-skeleton-wrap">
                <TableRowsSkeleton rows={6} />
              </div>
            ) : fallbackBookingsQuery.isError ? (
              <div className="bm-block">
                <p className="dash-empty-title">
                  Couldn&apos;t load fallback bookings
                </p>
                <p className="dash-empty-error">
                  {(fallbackBookingsQuery.error as Error).message}
                </p>
                <Button variant="primary" size="sm" type="button" onClick={() => void fallbackBookingsQuery.refetch()}>
                  Retry
                </Button>
              </div>
            ) : fallbackTotal === 0 ? (
              <p className="vd-empty">No fallback bookings yet.</p>
            ) : (
              <>
                <div className="bm-table-wrap">
                  <table className="bm-table">
                    <thead>
                      <tr>
                        <th>Reference</th>
                        <th>Status</th>
                        <th>Created</th>
                        <th>Assigned vendor</th>
                        <th>Reason</th>
                        <th>Service for</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fallbackRows.map((row) => {
                        const rm = routingMeta(row);
                        const reasonLabel = rm.reason ? REASON_LABELS[rm.reason] ?? rm.reason : "-";
                        const assignedName = row.vendor_id ? vendorNameById.get(row.vendor_id) ?? row.vendor_id.slice(0, 8) : "-";
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
                            <td>{reasonLabel}</td>
                            <td>{serviceForLabel(row)}</td>
                            <td>
                              <Button size="sm" type="button" variant="outline" onClick={() => setActionRow(row)}>
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
            title={actionRow ? `Fallback · ${actionRow.reference_code}` : "Booking"}
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
                <p style={{ margin: 0 }}>
                  <strong>Reason:</strong>{" "}
                  {routingMeta(actionRow).reason
                    ? REASON_LABELS[routingMeta(actionRow).reason!] ?? routingMeta(actionRow).reason
                    : "—"}
                </p>
                {canNudge ? (
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    loading={nudgeVendorMut.isPending}
                    disabled={nudgeVendorMut.isPending}
                    onClick={() => void nudgeVendorMut.mutateAsync(canNudge.id)}
                  >
                    {awaitingVendorReadiness(canNudge.metadata) ? "Remind vendor" : "Notify vendor"}
                  </Button>
                ) : (
                  <p style={{ margin: 0, color: "var(--wb-muted-fg)" }}>No vendor notification applies for this row.</p>
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
