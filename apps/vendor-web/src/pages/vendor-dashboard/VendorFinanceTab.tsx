import type { BookingRow, VendorSettlementRow } from "@oorjaman/api";
import {
  DEFAULT_TABLE_PAGE_SIZE,
  formatInrFromPaise,
  getVendorPlatformFeePercent,
  queryKeys,
  settlementDisplayAmountPaise,
  settlementKindLabel,
  settlementStatusLabel,
  vendorListMySettlements,
} from "@oorjaman/api";
import { Badge, Button, Card } from "@oorjaman/web-ui";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { formatDisplayDateTime } from "@oorjaman/utils";
import { TablePaginationBar } from "../../components/TablePaginationBar";
import { useSupabase } from "../../lib/supabase-context";
import { formatInr } from "./formatters";
import { downloadCsv } from "./csv";
import { bookingValueCents, estimateNetAfterPlatformFee } from "./metrics";

type Props = {
  bookings: BookingRow[];
};

function settlementStatusTone(
  status: VendorSettlementRow["status"],
): "neutral" | "warning" | "success" | "danger" {
  if (status === "settled") return "success";
  if (status === "waived") return "neutral";
  if (status === "approved") return "neutral";
  return "warning";
}

export function VendorFinanceTab({ bookings }: Props) {
  const supabase = useSupabase();
  const [settlementsPage, setSettlementsPage] = useState(1);

  const platformFeeQ = useQuery({
    queryKey: queryKeys.platform.settings(),
    queryFn: () => getVendorPlatformFeePercent(supabase!),
    enabled: Boolean(supabase),
  });

  const settlementsQuery = useQuery({
    queryKey: queryKeys.vendors.dashboardSettlements("all"),
    queryFn: () => vendorListMySettlements(supabase!, { limit: 200 }),
    enabled: Boolean(supabase),
  });

  const platformFeePercent = platformFeeQ.data ?? 10;
  const settlements = settlementsQuery.data ?? [];
  const settlementsTotal = settlements.length;
  const settlementsWindow = settlements.slice(
    (settlementsPage - 1) * DEFAULT_TABLE_PAGE_SIZE,
    settlementsPage * DEFAULT_TABLE_PAGE_SIZE,
  );

  const completed = bookings.filter((b) => b.status === "completed");
  const grossCompletedCents = completed.reduce((s, b) => s + bookingValueCents(b), 0);
  const netEstimatedCents = estimateNetAfterPlatformFee(grossCompletedCents, platformFeePercent);

  const pendingPayoutPaise = settlements
    .filter((r) => r.kind === "visit_payout" && (r.status === "pending_review" || r.status === "approved"))
    .reduce((s, r) => s + (r.net_payout_paise ?? 0), 0);
  const openPenaltyPaise = settlements
    .filter(
      (r) =>
        r.kind === "cancellation_penalty" &&
        r.status !== "waived" &&
        r.status !== "settled",
    )
    .reduce((s, r) => s + settlementDisplayAmountPaise(r), 0);

  const settledPayoutPaise = useMemo(
    () =>
      settlements
        .filter((r) => r.kind === "visit_payout" && r.status === "settled")
        .reduce((s, r) => s + (r.net_payout_paise ?? 0), 0),
    [settlements],
  );

  const exportSettlementsCsv = () => {
    if (!settlements.length) return;
    const headers = ["visit_ref", "kind", "status", "amount_paise", "created_at"];
    const rows = settlements.map((r) => [
      r.reference_code ?? r.booking_id,
      r.kind,
      r.status,
      String(settlementDisplayAmountPaise(r)),
      r.created_at,
    ]);
    downloadCsv(`oorjaman-settlements-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  };

  return (
    <div className="vd-stack">
      <div className="vd-kpi-grid">
        <div className="vd-kpi-card">
          <div className="vd-kpi-label">Pending payout from OorjaMan</div>
          <div className="vd-kpi-value">{formatInrFromPaise(pendingPayoutPaise)}</div>
          <div className="vd-kpi-hint">Visit payouts approved or under review</div>
        </div>
        <div className="vd-kpi-card">
          <div className="vd-kpi-label">Settled payouts</div>
          <div className="vd-kpi-value">{formatInrFromPaise(settledPayoutPaise)}</div>
          <div className="vd-kpi-hint">Marked settled by OorjaMan ops</div>
        </div>
        <div className="vd-kpi-card">
          <div className="vd-kpi-label">Open penalties</div>
          <div className="vd-kpi-value">{formatInrFromPaise(openPenaltyPaise)}</div>
          <div className="vd-kpi-hint">After cancelling an accepted visit</div>
        </div>
      </div>

      <Card padded>
        <h3 className="vd-subtitle">Settlements with OorjaMan</h3>
        <p className="vd-note">
          Each <strong>completed</strong> visit creates a payout row (OorjaMan platform fee currently{" "}
          {platformFeePercent}%). Cancelling an <strong>accepted</strong> visit may add a penalty row for ops to
          confirm. Rough net on your completed visits: {formatInr(netEstimatedCents)} before settlement status.
        </p>
      </Card>

      <div className="vd-actions-start">
        <Button
          variant="outline"
          size="sm"
          type="button"
          disabled={!settlements.length}
          onClick={exportSettlementsCsv}
        >
          Export settlements CSV
        </Button>
      </div>

      <Card padded={false}>
        <div className="vd-card-head">
          <h2 className="vd-section-title">Settlement ledger</h2>
          <p className="vd-note vd-note-spaced">
            What OorjaMan owes you or charges you. Customer checkout is handled separately.
          </p>
        </div>
        {settlementsQuery.isLoading ? (
          <p className="vd-empty">Loading settlements…</p>
        ) : settlementsQuery.isError ? (
          <p className="vd-empty vd-error">{(settlementsQuery.error as Error).message}</p>
        ) : settlementsTotal === 0 ? (
          <p className="vd-empty">
            No settlement rows yet. Complete a visit or check back after ops processes a cancellation penalty.
          </p>
        ) : (
          <>
            <div className="bm-table-wrap">
              <table className="bm-table">
                <thead>
                  <tr>
                    <th>Visit</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {settlementsWindow.map((r) => {
                    const isPenalty = r.kind === "cancellation_penalty";
                    const amount = settlementDisplayAmountPaise(r);
                    return (
                      <tr key={r.id}>
                        <td className="vd-mono">{r.reference_code ?? r.booking_id.slice(0, 8)}</td>
                        <td>{settlementKindLabel(r.kind)}</td>
                        <td>
                          {isPenalty ? "Charge " : "Payout "}
                          {formatInrFromPaise(amount)}
                        </td>
                        <td>
                          <Badge tone={settlementStatusTone(r.status)}>{settlementStatusLabel(r.status)}</Badge>
                        </td>
                        <td>{formatDisplayDateTime(r.created_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ padding: "0.75rem 1rem" }}>
              <TablePaginationBar
                page={settlementsPage}
                total={settlementsTotal}
                onPageChange={setSettlementsPage}
              />
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
