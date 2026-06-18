import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import {
  adminAssignVendorToBooking,
  adminFlagBookingOpsIssue,
  adminFloatDefaultVendorBooking,
  adminRefloatMarketplaceBooking,
  getBookingById,
  queryKeys,
  vendorApi,
  type OpsIssueType,
} from "@oorjaman/api";
import { formatDisplayDateTimeRange } from "@oorjaman/utils";
import { Button, Modal } from "@oorjaman/web-ui";
import {
  canFloatToMarketplace,
  canRefloatMarketplace,
  formatOpsIssueType,
  isOpsExceptionPastWindow,
  needsPartnerAssignment,
} from "../lib/ops-exceptions-display";
import { OPS_ISSUE_LABELS } from "../lib/booking-routing-display";
import { webTypography } from "../styles/typography";
import { useSupabase } from "@oorjaman/web-ui";

export type OpsInterventionTarget = {
  bookingId: string;
  referenceCode: string;
  issueType?: string | null;
  presetVendorId?: string | null;
};

type Props = {
  target: OpsInterventionTarget | null;
  onClose: () => void;
  onSuccess?: () => void;
};

export function OpsInterventionModal({ target, onClose, onSuccess }: Props) {
  const supabase = useSupabase();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [view, setView] = useState<"menu" | "assign">("menu");
  const [assignVendorId, setAssignVendorId] = useState("");

  useEffect(() => {
    if (!target) return;
    setView("menu");
    setAssignVendorId(target.presetVendorId?.trim() ?? "");
  }, [target]);

  const bookingQuery = useQuery({
    queryKey: [...queryKeys.bookings.all(), "ops-intervention", target?.bookingId] as const,
    queryFn: () => getBookingById(supabase!, target!.bookingId),
    enabled: Boolean(supabase && target?.bookingId),
  });

  const vendorsQuery = useQuery({
    queryKey: queryKeys.vendors.adminList("approved"),
    queryFn: () => vendorApi.adminListVendors(supabase!, { approvalStatus: "approved" }),
    enabled: Boolean(supabase && target),
  });

  const vendorNameById = useMemo(
    () => new Map((vendorsQuery.data ?? []).map((v) => [v.id, v.business_name] as const)),
    [vendorsQuery.data],
  );

  async function refreshQueues() {
    await qc.invalidateQueries({ queryKey: queryKeys.bookings.opsDeskSummary() });
    await qc.invalidateQueries({
      predicate: (q) =>
        Array.isArray(q.queryKey) &&
        (q.queryKey as unknown[]).includes("ops-exceptions"),
    });
    await qc.invalidateQueries({
      predicate: (q) =>
        Array.isArray(q.queryKey) &&
        (q.queryKey as unknown[]).includes("admin-monitoring"),
    });
    onSuccess?.();
  }

  const assignMut = useMutation({
    mutationFn: async ({ bookingId, vendorId }: { bookingId: string; vendorId: string }) =>
      adminAssignVendorToBooking(supabase!, bookingId, vendorId),
    onSuccess: async () => {
      onClose();
      await refreshQueues();
    },
  });
  const floatMut = useMutation({
    mutationFn: async (bookingId: string) => adminFloatDefaultVendorBooking(supabase!, bookingId),
    onSuccess: async () => {
      if (target?.bookingId) {
        await qc.invalidateQueries({
          queryKey: [...queryKeys.bookings.all(), "ops-intervention", target.bookingId] as const,
        });
      }
      await refreshQueues();
    },
  });
  const refloatMut = useMutation({
    mutationFn: async (bookingId: string) => adminRefloatMarketplaceBooking(supabase!, bookingId),
    onSuccess: async () => {
      if (target?.bookingId) {
        await qc.invalidateQueries({
          queryKey: [...queryKeys.bookings.all(), "ops-intervention", target.bookingId] as const,
        });
      }
      await refreshQueues();
    },
  });
  const opsFlagMut = useMutation({
    mutationFn: async ({ bookingId, type }: { bookingId: string; type: OpsIssueType }) =>
      adminFlagBookingOpsIssue(supabase!, bookingId, type),
    onSuccess: async () => {
      if (target?.bookingId) {
        await qc.invalidateQueries({
          queryKey: [...queryKeys.bookings.all(), "ops-intervention", target.bookingId] as const,
        });
      }
    },
  });

  const booking = bookingQuery.data ?? null;
  const mutating =
    floatMut.isPending || refloatMut.isPending || opsFlagMut.isPending || assignMut.isPending;

  const modalIssueType =
    target?.issueType && target.issueType in OPS_ISSUE_LABELS
      ? (target.issueType as OpsIssueType)
      : undefined;

  const showAssignInModal =
    Boolean(
      booking &&
      view === "menu" &&
      needsPartnerAssignment(booking) &&
      !isOpsExceptionPastWindow({
        booking_id: booking.id,
        reference_code: booking.reference_code,
        status: booking.status,
        vendor_id: booking.vendor_id,
        technician_id: booking.technician_id,
        scheduled_start: booking.scheduled_start,
        scheduled_end: booking.scheduled_end,
        created_at: booking.created_at,
        issue_type: target?.issueType ?? null,
        issue_level: null,
        issue_label: null,
      }),
    );

  if (!target) return null;

  return (
    <Modal
      open
      onClose={onClose}
      title={view === "assign" ? `Assign partner · ${target.referenceCode}` : `Intervene · ${target.referenceCode}`}
    >
      {view === "assign" && booking ? (
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
            <Button variant="outline" size="sm" type="button" disabled={assignMut.isPending} onClick={() => setView("menu")}>
              Back
            </Button>
            <Button variant="outline" size="sm" type="button" disabled={assignMut.isPending} onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              type="button"
              loading={assignMut.isPending}
              disabled={!assignVendorId}
              onClick={() => {
                if (!assignVendorId) return;
                void assignMut.mutateAsync({ bookingId: target.bookingId, vendorId: assignVendorId });
              }}
            >
              Confirm assignment
            </Button>
          </div>
          {assignMut.isError ? <p className="bm-error">{(assignMut.error as Error).message}</p> : null}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          {bookingQuery.isLoading ? (
            <p className="bm-muted">Loading booking…</p>
          ) : bookingQuery.isError ? (
            <p className="bm-error">{(bookingQuery.error as Error).message}</p>
          ) : booking ? (
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
                <dd style={{ margin: 0 }}>{booking.status}</dd>
                <dt style={{ color: "var(--wb-muted-fg)" }}>Scheduled</dt>
                <dd style={{ margin: 0 }}>
                  {formatDisplayDateTimeRange(booking.scheduled_start, booking.scheduled_end)}
                </dd>
                {target.issueType ? (
                  <>
                    <dt style={{ color: "var(--wb-muted-fg)" }}>Exception</dt>
                    <dd style={{ margin: 0 }}>{formatOpsIssueType(target.issueType)}</dd>
                  </>
                ) : null}
                <dt style={{ color: "var(--wb-muted-fg)" }}>Partner</dt>
                <dd style={{ margin: 0 }}>
                  {booking.vendor_id
                    ? (vendorNameById.get(booking.vendor_id) ?? `${booking.vendor_id.slice(0, 8)}…`)
                    : "Unassigned"}
                </dd>
              </dl>

              {isOpsExceptionPastWindow({
                booking_id: booking.id,
                reference_code: booking.reference_code,
                status: booking.status,
                vendor_id: booking.vendor_id,
                technician_id: booking.technician_id,
                scheduled_start: booking.scheduled_start,
                scheduled_end: booking.scheduled_end,
                created_at: booking.created_at,
                issue_type: target.issueType ?? null,
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
                    onClick={() => setView("assign")}
                  >
                    Assign partner…
                  </Button>
                ) : null}

                {booking.status === "confirmed" && canFloatToMarketplace(booking) ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    loading={floatMut.isPending}
                    disabled={mutating && !floatMut.isPending}
                    onClick={() => void floatMut.mutateAsync(booking.id)}
                  >
                    Float to partners (broadcast)
                  </Button>
                ) : null}

                {booking.status === "confirmed" && canRefloatMarketplace(booking) ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    loading={refloatMut.isPending}
                    disabled={mutating && !refloatMut.isPending}
                    onClick={() => void refloatMut.mutateAsync(booking.id)}
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
                      void opsFlagMut.mutateAsync({ bookingId: booking.id, type: modalIssueType })
                    }
                  >
                    Record ops alert on booking
                  </Button>
                ) : null}

                <Button type="button" variant="outline" size="sm" onClick={() => navigate("/dashboard/bookings")}>
                  Open Bookings board
                </Button>
                <Link to="/dashboard/booking-routing" style={{ fontSize: webTypography.size.sm }}>
                  Booking routing
                </Link>
              </div>
            </>
          ) : null}
          <div className="bm-modal-actions">
            <Button variant="outline" size="sm" type="button" disabled={mutating} onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
