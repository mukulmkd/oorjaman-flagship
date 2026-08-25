import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminGetPaymentOpsDetail,
  adminInitiatePaymentRefund,
  adminListPayments,
  adminPaymentStatusLabel,
  adminPaymentStatusTone,
  formatInrFromPaise,
  isRefundableRazorpayPayment,
  queryKeys,
  remainingRefundablePaise,
  type PaymentStatus,
} from "@oorjaman/api";
import { formatDisplayDateTime } from "@oorjaman/utils";
import {
  Badge,
  Button,
  Card,
  Modal,
  PageHeader,
  TablePaginationBar,
  TableRowsSkeleton,
  useSupabase,
} from "@oorjaman/web-ui";
import "./payments-ops-page.css";

const PAGE_SIZE = 15;

const STATUS_FILTERS: Array<{ id: "" | PaymentStatus; label: string }> = [
  { id: "", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "authorized", label: "Authorized" },
  { id: "success", label: "Paid" },
  { id: "failed", label: "Failed" },
  { id: "cancelled", label: "Cancelled" },
  { id: "timeout", label: "Timeout" },
  { id: "refund_pending", label: "Refund pending" },
  { id: "partially_refunded", label: "Partial refund" },
  { id: "refunded", label: "Refunded" },
  { id: "refund_failed", label: "Refund failed" },
];

function mono(value: string | null | undefined): string {
  if (!value) return "—";
  return value;
}

export function PaymentsOpsPage() {
  const supabase = useSupabase();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const bookingIdFromUrl = searchParams.get("booking_id")?.trim() || "";
  const paymentIdFromUrl = searchParams.get("payment_id")?.trim() || "";

  const [statusFilter, setStatusFilter] = useState<"" | PaymentStatus>("");
  const [providerFilter, setProviderFilter] = useState<"" | "dummy" | "razorpay">("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(paymentIdFromUrl || null);
  const [refundAmountRupees, setRefundAmountRupees] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refundNotice, setRefundNotice] = useState<string | null>(null);

  useEffect(() => {
    if (paymentIdFromUrl) setSelectedPaymentId(paymentIdFromUrl);
  }, [paymentIdFromUrl]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, providerFilter, search, bookingIdFromUrl]);

  const filtersKey = `${statusFilter}|${providerFilter}|${search}|${bookingIdFromUrl}`;

  const listQuery = useQuery({
    queryKey: queryKeys.payments.adminList(filtersKey),
    queryFn: () =>
      adminListPayments(supabase!, {
        status: statusFilter,
        provider: providerFilter,
        search: search || undefined,
        bookingId: bookingIdFromUrl || undefined,
        limit: 300,
      }),
    enabled: Boolean(supabase),
  });

  const detailQuery = useQuery({
    queryKey: queryKeys.payments.adminDetail(selectedPaymentId ?? ""),
    queryFn: () => adminGetPaymentOpsDetail(supabase!, selectedPaymentId!),
    enabled: Boolean(supabase && selectedPaymentId),
  });

  const refundMut = useMutation({
    mutationFn: async () => {
      if (!supabase || !selectedPaymentId) throw new Error("Payment not ready.");
      const current = detailQuery.data?.payment;
      if (!current) throw new Error("Payment not ready.");
      const remaining = remainingRefundablePaise(current);
      const trimmed = refundAmountRupees.replace(/,/g, "").trim();
      let amountPaise: number | undefined;
      if (trimmed) {
        const rupees = Number(trimmed);
        if (!Number.isFinite(rupees) || rupees <= 0) {
          throw new Error("Enter a positive refund amount in rupees, or leave blank for full remaining.");
        }
        amountPaise = Math.round(rupees * 100);
        if (amountPaise > remaining) {
          throw new Error(`Amount exceeds remaining ${formatInrFromPaise(remaining)}.`);
        }
      }
      return adminInitiatePaymentRefund(supabase, {
        paymentId: selectedPaymentId,
        amountPaise,
        reason: refundReason.trim() || "Admin-initiated refund",
      });
    },
    onSuccess: async (result) => {
      setRefundNotice(
        result.status === "already_refunded"
          ? "Payment was already fully refunded."
          : `Refund of ${formatInrFromPaise(result.amountPaise)} initiated. Webhook will mark it processed.`,
      );
      setRefundAmountRupees("");
      setRefundReason("");
      await qc.invalidateQueries({ queryKey: queryKeys.payments.adminDetail(selectedPaymentId ?? "") });
      await qc.invalidateQueries({ queryKey: queryKeys.payments.adminList(filtersKey) });
    },
    onError: (e: unknown) => {
      setRefundNotice(e instanceof Error ? e.message : "Refund failed.");
    },
  });

  const rows = listQuery.data ?? [];
  const pageRows = useMemo(
    () => rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [rows, page],
  );

  const clearBookingFilter = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("booking_id");
    setSearchParams(next, { replace: true });
  };

  const closeDetail = () => {
    setSelectedPaymentId(null);
    setRefundAmountRupees("");
    setRefundReason("");
    setRefundNotice(null);
    if (paymentIdFromUrl) {
      const next = new URLSearchParams(searchParams);
      next.delete("payment_id");
      setSearchParams(next, { replace: true });
    }
  };

  const detail = detailQuery.data;
  const pay = detail?.payment;
  const canInitiateRefund = pay ? isRefundableRazorpayPayment(pay) : false;

  return (
    <div className="dash-page pay-ops-page">
      <PageHeader
        title="Payments"
        subtitle="Gateway payment trail for support. Booking status stays separate from payment status. Secrets and card data are never shown."
        actions={
          <Link to="/dashboard/finance" className="fin-amc-wallets-link">
            ← Settlements
          </Link>
        }
      />

      {!supabase ? (
        <Card padded>
          <p className="dash-muted-line">Connect Supabase via Vite env variables.</p>
        </Card>
      ) : (
        <div className="pay-ops-root">
          <Card padded className="pay-ops-filters">
            <div className="pay-ops-filter-row">
              <label className="pay-ops-field">
                <span>Search</span>
                <input
                  className="web-input"
                  type="search"
                  placeholder="Razorpay order / payment id, or UUID"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") setSearch(searchInput.trim());
                  }}
                />
              </label>
              <Button
                type="button"
                size="sm"
                variant="primary"
                onClick={() => setSearch(searchInput.trim())}
              >
                Search
              </Button>
              <label className="pay-ops-field">
                <span>Provider</span>
                <select
                  className="web-input"
                  value={providerFilter}
                  onChange={(e) => setProviderFilter(e.target.value as "" | "dummy" | "razorpay")}
                >
                  <option value="">All</option>
                  <option value="razorpay">Razorpay</option>
                  <option value="dummy">Dummy</option>
                </select>
              </label>
            </div>

            <div className="pay-ops-status-tabs" role="tablist" aria-label="Payment status">
              {STATUS_FILTERS.map((s) => (
                <button
                  key={s.id || "all"}
                  type="button"
                  role="tab"
                  className={statusFilter === s.id ? "pay-ops-tab pay-ops-tab-active" : "pay-ops-tab"}
                  aria-selected={statusFilter === s.id}
                  onClick={() => setStatusFilter(s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {bookingIdFromUrl ? (
              <p className="pay-ops-booking-filter">
                Filtered by booking{" "}
                <code>{bookingIdFromUrl}</code>
                {" · "}
                <button type="button" className="pay-ops-text-btn" onClick={clearBookingFilter}>
                  Clear
                </button>
                {" · "}
                <Link to={`/dashboard/bookings`}>Open bookings</Link>
              </p>
            ) : null}
          </Card>

          <Card padded={false}>
            {listQuery.isPending ? (
              <div className="bm-block-skeleton" style={{ padding: "1rem" }}>
                <TableRowsSkeleton rows={8} />
              </div>
            ) : (
              <>
            <div className="bm-table-wrap">
              <table className="bm-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Provider</th>
                    <th>Customer</th>
                    <th>Booking</th>
                    <th>Razorpay</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {listQuery.isError ? (
                    <tr>
                      <td colSpan={8} className="dash-muted-line">
                        {(listQuery.error as Error).message}
                      </td>
                    </tr>
                  ) : pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="dash-muted-line">
                        No payments match these filters.
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((row) => (
                      <tr key={row.id}>
                        <td>{formatDisplayDateTime(row.created_at)}</td>
                        <td>{formatInrFromPaise(row.amount)}</td>
                        <td>
                          <Badge tone={adminPaymentStatusTone(row.status)}>
                            {adminPaymentStatusLabel(row.status)}
                          </Badge>
                        </td>
                        <td>{row.provider}</td>
                        <td>{row.customer_display_name?.trim() || row.customer_id.slice(0, 8)}</td>
                        <td>
                          {row.booking_reference_code ? (
                            <span title={row.booking_id ?? undefined}>{row.booking_reference_code}</span>
                          ) : row.subscription_id ? (
                            <span className="dash-muted-line">AMC</span>
                          ) : (
                            "—"
                          )}
                          {row.booking_status ? (
                            <div className="pay-ops-submeta">Booking: {row.booking_status}</div>
                          ) : null}
                        </td>
                        <td className="pay-ops-mono">
                          {row.razorpay_payment_id
                            ? row.razorpay_payment_id
                            : row.razorpay_order_id
                              ? row.razorpay_order_id
                              : "—"}
                        </td>
                        <td>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedPaymentId(row.id)}
                          >
                            Details
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <TablePaginationBar
              page={page}
              pageSize={PAGE_SIZE}
              total={rows.length}
              onPageChange={setPage}
            />
              </>
            )}
          </Card>
        </div>
      )}

      <Modal
        open={Boolean(selectedPaymentId)}
        size="lg"
        title={pay ? `Payment · ${adminPaymentStatusLabel(pay.status)}` : "Payment details"}
        onClose={closeDetail}
      >
        {detailQuery.isPending ? (
          <p className="dash-muted-line">Loading…</p>
        ) : detailQuery.isError ? (
          <p className="dash-muted-line">{(detailQuery.error as Error).message}</p>
        ) : !pay ? (
          <p className="dash-muted-line">Payment not found.</p>
        ) : (
          <div className="pay-ops-detail">
            <dl className="pay-ops-dl">
              <dt>OorjaMan status</dt>
              <dd>
                <Badge tone={adminPaymentStatusTone(pay.status)}>
                  {adminPaymentStatusLabel(pay.status)}
                </Badge>
              </dd>
              <dt>Amount</dt>
              <dd>
                {formatInrFromPaise(pay.amount)}
                {pay.amount_refunded > 0
                  ? ` · refunded ${formatInrFromPaise(pay.amount_refunded)}`
                  : null}
              </dd>
              <dt>Provider / method</dt>
              <dd>
                {pay.provider}
                {pay.payment_method ? ` · ${pay.payment_method}` : ""}
                {pay.method_type ? ` · ${pay.method_type}` : ""}
              </dd>
              <dt>Attempt #</dt>
              <dd>{pay.attempt_number}</dd>
              <dt>Customer</dt>
              <dd>
                {pay.customer_display_name?.trim() || "—"}
                <div className="pay-ops-mono pay-ops-submeta">{pay.customer_id}</div>
              </dd>
              <dt>Booking</dt>
              <dd>
                {pay.booking_reference_code || "—"}
                {pay.booking_status ? ` · status ${pay.booking_status}` : ""}
                {pay.booking_id ? (
                  <div className="pay-ops-submeta">
                    <Link to={`/dashboard/finance/payments?booking_id=${pay.booking_id}`}>
                      All payments for this booking
                    </Link>
                    {" · "}
                    <span className="pay-ops-mono">{pay.booking_id}</span>
                  </div>
                ) : null}
              </dd>
              <dt>Subscription</dt>
              <dd className="pay-ops-mono">{mono(pay.subscription_id)}</dd>
              <dt>Razorpay order</dt>
              <dd className="pay-ops-mono">
                {mono(pay.razorpay_order_id)}
                {pay.razorpay_order_status ? ` (${pay.razorpay_order_status})` : ""}
              </dd>
              <dt>Razorpay payment</dt>
              <dd className="pay-ops-mono">
                {mono(pay.razorpay_payment_id)}
                {pay.razorpay_payment_status ? ` (${pay.razorpay_payment_status})` : ""}
              </dd>
              <dt>Refund status</dt>
              <dd>{pay.razorpay_refund_status || "—"}</dd>
              <dt>Paid at</dt>
              <dd>{pay.paid_at ? formatDisplayDateTime(pay.paid_at) : "—"}</dd>
              <dt>Created / updated</dt>
              <dd>
                {formatDisplayDateTime(pay.created_at)}
                {pay.updated_at ? ` · ${formatDisplayDateTime(pay.updated_at)}` : ""}
              </dd>
              <dt>Payment id</dt>
              <dd className="pay-ops-mono">{pay.id}</dd>
            </dl>

            {(pay.customer_error_category ||
              pay.customer_error_message ||
              pay.error_reason ||
              pay.error_code) && (
              <section className="pay-ops-section">
                <h3 className="pay-ops-section-title">Failure diagnostics</h3>
                <dl className="pay-ops-dl">
                  <dt>Category</dt>
                  <dd>{pay.customer_error_category || "—"}</dd>
                  <dt>Customer message</dt>
                  <dd>{pay.customer_error_message || "—"}</dd>
                  <dt>Reason / code</dt>
                  <dd className="pay-ops-mono">
                    {[pay.error_reason, pay.error_code].filter(Boolean).join(" · ") || "—"}
                  </dd>
                  <dt>Source / step / field</dt>
                  <dd className="pay-ops-mono">
                    {[pay.error_source, pay.error_step, pay.error_field].filter(Boolean).join(" · ") ||
                      "—"}
                  </dd>
                  <dt>Description</dt>
                  <dd>{pay.error_description || "—"}</dd>
                </dl>
              </section>
            )}

            <section className="pay-ops-section">
              <h3 className="pay-ops-section-title">Attempts</h3>
              {(detail.attempts?.length ?? 0) === 0 ? (
                <p className="dash-muted-line">No attempt rows recorded yet.</p>
              ) : (
                <div className="bm-table-wrap">
                  <table className="bm-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Status</th>
                        <th>Razorpay payment</th>
                        <th>Failure</th>
                        <th>When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.attempts.map((a) => (
                        <tr key={a.id}>
                          <td>{a.attempt_number}</td>
                          <td>{a.status}</td>
                          <td className="pay-ops-mono">{a.razorpay_payment_id || "—"}</td>
                          <td>
                            {a.failure_category || a.failure_reason
                              ? `${a.failure_category ?? ""} ${a.failure_reason ?? ""}`.trim()
                              : "—"}
                          </td>
                          <td>{formatDisplayDateTime(a.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="pay-ops-section">
              <h3 className="pay-ops-section-title">Refunds</h3>
              {canInitiateRefund ? (
                <div style={{ marginBottom: "1rem" }}>
                  <p className="dash-muted-line" style={{ marginBottom: "0.75rem" }}>
                    Remaining refundable: {formatInrFromPaise(remainingRefundablePaise(pay!))}. Leave amount blank to
                    refund the full remaining balance.
                  </p>
                  <label className="pay-ops-field" style={{ display: "block", marginBottom: "0.5rem" }}>
                    <span>Amount (₹, optional)</span>
                    <input
                      className="web-input"
                      type="text"
                      inputMode="decimal"
                      placeholder="Full remaining"
                      value={refundAmountRupees}
                      onChange={(e) => setRefundAmountRupees(e.target.value)}
                    />
                  </label>
                  <label className="pay-ops-field" style={{ display: "block", marginBottom: "0.75rem" }}>
                    <span>Reason</span>
                    <textarea
                      className="web-input"
                      rows={2}
                      value={refundReason}
                      onChange={(e) => setRefundReason(e.target.value)}
                      placeholder="Admin-initiated refund"
                    />
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    variant="danger"
                    loading={refundMut.isPending}
                    disabled={refundMut.isPending}
                    onClick={() => {
                      setRefundNotice(null);
                      void refundMut.mutateAsync();
                    }}
                  >
                    Initiate refund
                  </Button>
                  {refundNotice ? (
                    <p className="dash-muted-line" style={{ marginTop: "0.5rem" }}>
                      {refundNotice}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {(detail.refunds?.length ?? 0) === 0 ? (
                <p className="dash-muted-line">No refunds recorded.</p>
              ) : (
                <div className="bm-table-wrap">
                  <table className="bm-table">
                    <thead>
                      <tr>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Refund id</th>
                        <th>Reason</th>
                        <th>When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.refunds.map((r) => (
                        <tr key={r.id}>
                          <td>{formatInrFromPaise(r.amount_paise)}</td>
                          <td>{r.status}</td>
                          <td className="pay-ops-mono">{r.razorpay_refund_id || "—"}</td>
                          <td>{r.reason || "—"}</td>
                          <td>
                            {formatDisplayDateTime(r.created_at)}
                            {r.processed_at
                              ? ` · processed ${formatDisplayDateTime(r.processed_at)}`
                              : ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}
      </Modal>
    </div>
  );
}
