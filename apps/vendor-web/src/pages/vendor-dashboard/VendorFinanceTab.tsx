import type { BookingRow, PaymentRow } from "@oorjaman/api";
import { DEFAULT_TABLE_PAGE_SIZE } from "@oorjaman/api";
import { Badge, Button, Card } from "@oorjaman/web-ui";
import { useMemo, useState } from "react";
import { TablePaginationBar } from "../../components/TablePaginationBar";
import { formatDisplayDateTime } from "@oorjaman/utils";
import { formatInr } from "./formatters";
import { downloadCsv } from "./csv";
import {
  bookingValueCents,
  DEFAULT_PLATFORM_FEE_PERCENT,
  estimateNetAfterPlatformFee,
} from "./metrics";

type Props = {
  payments: PaymentRow[] | undefined;
  bookings: BookingRow[];
  isLoading: boolean;
  error: Error | null;
};

export function VendorFinanceTab({ payments, bookings, isLoading, error }: Props) {
  const [paymentsPage, setPaymentsPage] = useState(1);
  const sortedPayments = useMemo(
    () => [...(payments ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [payments],
  );
  const payTotal = sortedPayments.length;
  const paymentsWindow = sortedPayments.slice(
    (paymentsPage - 1) * DEFAULT_TABLE_PAGE_SIZE,
    paymentsPage * DEFAULT_TABLE_PAGE_SIZE,
  );

  const completed = bookings.filter((b) => b.status === "completed");
  const grossCompletedCents = completed.reduce((s, b) => s + bookingValueCents(b), 0);
  const netEstimatedCents = estimateNetAfterPlatformFee(grossCompletedCents, DEFAULT_PLATFORM_FEE_PERCENT);
  const successPayments = sortedPayments.filter((p) => p.status === "success");
  const paymentsTotalCents = successPayments.reduce((s, p) => s + p.amount, 0);

  const exportBookingsCsv = () => {
    const headers = ["reference_or_visit", "status", "scheduled_start", "value_cents", "payment_status_note"];
    const rows = bookings.map((b) => [
      b.booking_code ?? b.reference_code,
      b.status,
      b.scheduled_start,
      String(bookingValueCents(b)),
      "",
    ]);
    downloadCsv(`oorjaman-bookings-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  };

  const exportPaymentsCsv = () => {
    if (!sortedPayments.length) return;
    const headers = ["id", "booking_id", "customer_id", "amount_paise", "status", "created_at"];
    const rows = sortedPayments.map((p) => [
      p.id,
      p.booking_id ?? "",
      p.customer_id,
      String(p.amount),
      p.status,
      p.created_at,
    ]);
    downloadCsv(`oorjaman-payments-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  };

  return (
    <div className="vd-stack">
      <div className="vd-kpi-grid">
        <div className="vd-kpi-card">
          <div className="vd-kpi-label">Completed visit value (gross)</div>
          <div className="vd-kpi-value">{formatInr(grossCompletedCents)}</div>
          <div className="vd-kpi-hint">Final or estimated on completed visits</div>
        </div>
        <div className="vd-kpi-card">
          <div className="vd-kpi-label">Est. net after platform fee</div>
          <div className="vd-kpi-value">{formatInr(netEstimatedCents)}</div>
          <div className="vd-kpi-hint">
            Using placeholder {DEFAULT_PLATFORM_FEE_PERCENT}% - configure real fees in ops settings later.
          </div>
        </div>
        <div className="vd-kpi-card">
          <div className="vd-kpi-label">Customer payments (success)</div>
          <div className="vd-kpi-value">{formatInr(paymentsTotalCents)}</div>
          <div className="vd-kpi-hint">Sum of successful payment rows you can see (checkout ledger)</div>
        </div>
      </div>

      <Card padded>
        <h3 className="vd-subtitle">Settlements with OorjaMan</h3>
        <p className="vd-note">
          Payout statements, GST withheld, and fee breakdowns will appear here once finance connects a settlement
          ledger. Export CSV below for offline reconciliation.
        </p>
      </Card>

      <div className="vd-actions-start">
        <Button variant="outline" size="sm" type="button" onClick={exportBookingsCsv}>
          Export bookings CSV
        </Button>
        <Button
          variant="outline"
          size="sm"
          type="button"
          disabled={!sortedPayments.length}
          onClick={exportPaymentsCsv}
        >
          Export payments CSV
        </Button>
      </div>

      <Card padded={false}>
        <div className="vd-card-head">
          <h2 className="vd-section-title">Payment rows</h2>
          <p className="vd-note vd-note-spaced">
            Checkout payments linked to your customers or bookings.
          </p>
        </div>
        {isLoading ? (
          <p className="vd-empty">Loading…</p>
        ) : error ? (
          <p className="vd-empty vd-error">
            {error.message}
          </p>
        ) : payTotal === 0 ? (
          <p className="vd-empty">No payments yet.</p>
        ) : (
          <>
            <div className="bm-table-wrap">
              <table className="bm-table">
                <thead>
                  <tr>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Booking</th>
                    <th>Customer</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentsWindow.map((p) => (
                    <tr key={p.id}>
                      <td>{formatInr(p.amount)}</td>
                      <td>
                        <Badge tone={p.status === "success" ? "success" : p.status === "failed" ? "danger" : "warning"}>
                          {p.status}
                        </Badge>
                      </td>
                      <td>{formatDisplayDateTime(p.created_at)}</td>
                      <td className="vd-mono">{p.booking_id?.slice(0, 8) ?? "—"}</td>
                      <td className="vd-mono">{p.customer_id.slice(0, 8)}…</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ padding: "0.75rem 1rem" }}>
              <TablePaginationBar page={paymentsPage} total={payTotal} onPageChange={setPaymentsPage} />
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
