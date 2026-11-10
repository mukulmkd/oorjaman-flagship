import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  adminGetTaxInvoiceContext,
  adminListPayments,
  adminPaymentStatusLabel,
  adminPaymentStatusTone,
  formatInrFromPaise,
  queryKeys,
  type AdminPaymentListRow,
  type PaymentStatus,
} from "@oorjaman/api";
import { formatDisplayDateTime, invoiceNumberForBooking } from "@oorjaman/utils";
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
import {
  buildBookingTaxInvoiceHtml,
  downloadBookingTaxInvoicePdf,
} from "../lib/booking-tax-invoice";
import "./invoices-page.css";

const PAGE_SIZE = 20;

const PAID_STATUSES: PaymentStatus[] = ["success", "partially_refunded", "refunded"];

const STATUS_FILTERS: Array<{ id: "" | PaymentStatus; label: string }> = [
  { id: "", label: "All paid" },
  { id: "success", label: "Paid" },
  { id: "partially_refunded", label: "Partial refund" },
  { id: "refunded", label: "Refunded" },
];

function invoiceEligible(row: AdminPaymentListRow): boolean {
  return Boolean(row.booking_id) && PAID_STATUSES.includes(row.status);
}

export function InvoicesPage() {
  const supabase = useSupabase();
  const [searchParams] = useSearchParams();
  const bookingIdFromUrl = searchParams.get("booking_id")?.trim() || "";
  const paymentIdFromUrl = searchParams.get("payment_id")?.trim() || "";

  const [statusFilter, setStatusFilter] = useState<"" | PaymentStatus>("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(
    paymentIdFromUrl || null,
  );
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (paymentIdFromUrl) setSelectedPaymentId(paymentIdFromUrl);
  }, [paymentIdFromUrl]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, search, bookingIdFromUrl]);

  const filtersKey = `invoices|${statusFilter}|${search}|${bookingIdFromUrl}`;

  const listQuery = useQuery({
    queryKey: queryKeys.finance.invoices(filtersKey),
    queryFn: () =>
      adminListPayments(supabase!, {
        status: statusFilter || PAID_STATUSES,
        requireBookingId: true,
        search: search || undefined,
        bookingId: bookingIdFromUrl || undefined,
        limit: 500,
      }),
    enabled: Boolean(supabase),
  });

  const invoiceRows = useMemo(
    () => (listQuery.data ?? []).filter(invoiceEligible),
    [listQuery.data],
  );

  const pageRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return invoiceRows.slice(start, start + PAGE_SIZE);
  }, [invoiceRows, page]);

  const invoiceQuery = useQuery({
    queryKey: queryKeys.payments.adminTaxInvoice(selectedPaymentId ?? ""),
    queryFn: () =>
      adminGetTaxInvoiceContext(supabase!, { paymentId: selectedPaymentId! }),
    enabled: Boolean(supabase && selectedPaymentId),
  });

  const previewQuery = useQuery({
    queryKey: queryKeys.payments.adminTaxInvoiceHtml(selectedPaymentId ?? ""),
    queryFn: () => buildBookingTaxInvoiceHtml(invoiceQuery.data!, "screen"),
    enabled: Boolean(invoiceQuery.data && selectedPaymentId),
  });

  const previewHtml = previewQuery.data ?? null;

  async function handleDownload() {
    const ctx = invoiceQuery.data;
    if (!ctx) return;
    setDownloadError(null);
    setDownloading(true);
    try {
      await downloadBookingTaxInvoicePdf(ctx);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "Could not download invoice PDF.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="dash-page inv-page">
      <PageHeader
        title="Invoices"
        subtitle="Tax invoices for paid bookings (including past visits). Generated from booking + payment records — same document customers receive."
        actions={
          <>
            <Link to="/dashboard/finance" className="inv-back-link">
              ← Finance
            </Link>
            <Link to="/dashboard/finance/payments" className="inv-back-link" style={{ marginLeft: "0.75rem" }}>
              Payments
            </Link>
          </>
        }
      />

      {!supabase ? (
        <Card padded>
          <p className="dash-muted-line">Connect Supabase via Vite env variables.</p>
        </Card>
      ) : (
        <div className="bm-stack">
          <Card padded className="inv-filters">
            <div className="inv-filter-row">
              <label className="inv-filter-label" htmlFor="inv-status">
                Status
              </label>
              <select
                id="inv-status"
                className="inv-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as "" | PaymentStatus)}
              >
                {STATUS_FILTERS.map((opt) => (
                  <option key={opt.id || "all"} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <label className="inv-filter-label" htmlFor="inv-search">
                Search
              </label>
              <input
                id="inv-search"
                className="inv-input"
                placeholder="Booking ref, Razorpay id, payment UUID…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setSearch(searchInput.trim());
                }}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setSearch(searchInput.trim())}
              >
                Search
              </Button>
            </div>
            {bookingIdFromUrl ? (
              <p className="inv-filter-hint">
                Filtered to booking <code>{bookingIdFromUrl}</code>.{" "}
                <Link to="/dashboard/finance/invoices">Clear filter</Link>
              </p>
            ) : null}
          </Card>

          <Card padded={false}>
            {listQuery.isPending ? (
              <div style={{ padding: "1rem" }}>
                <TableRowsSkeleton rows={8} />
              </div>
            ) : listQuery.isError ? (
              <p className="dash-muted-line" style={{ padding: "1rem" }}>
                {(listQuery.error as Error).message}
              </p>
            ) : (
              <>
                <div className="bm-table-wrap">
                  <table className="bm-table">
                    <thead>
                      <tr>
                        <th>Invoice</th>
                        <th>Paid</th>
                        <th>Amount</th>
                        <th>Payment status</th>
                        <th>Customer</th>
                        <th>Booking</th>
                        <th>Visit status</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="dash-muted-line">
                            No booking invoices match these filters. AMC contract prepays without a visit
                            booking are not listed here.
                          </td>
                        </tr>
                      ) : (
                        pageRows.map((row) => {
                          const invNo = invoiceNumberForBooking(
                            row.booking_reference_code || row.booking_id || row.id,
                          );
                          return (
                            <tr key={row.id}>
                              <td className="inv-mono">{invNo}</td>
                              <td>
                                {row.paid_at
                                  ? formatDisplayDateTime(row.paid_at)
                                  : formatDisplayDateTime(row.created_at)}
                              </td>
                              <td>{formatInrFromPaise(row.amount)}</td>
                              <td>
                                <Badge tone={adminPaymentStatusTone(row.status)}>
                                  {adminPaymentStatusLabel(row.status)}
                                </Badge>
                              </td>
                              <td>
                                {row.customer_display_name?.trim() ||
                                  row.customer_id.slice(0, 8)}
                              </td>
                              <td>{row.booking_reference_code || "—"}</td>
                              <td>{row.booking_status || "—"}</td>
                              <td>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setSelectedPaymentId(row.id)}
                                >
                                  View invoice
                                </Button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                <TablePaginationBar
                  page={page}
                  pageSize={PAGE_SIZE}
                  total={invoiceRows.length}
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
        title={
          invoiceQuery.data
            ? `Tax invoice · ${invoiceQuery.data.booking.reference_code}`
            : "Tax invoice"
        }
        onClose={() => {
          setSelectedPaymentId(null);
          setDownloadError(null);
        }}
      >
        {invoiceQuery.isPending || (invoiceQuery.data && previewQuery.isPending) ? (
          <p className="dash-muted-line">Loading invoice…</p>
        ) : invoiceQuery.isError ? (
          <p className="dash-muted-line">{(invoiceQuery.error as Error).message}</p>
        ) : previewQuery.isError ? (
          <p className="dash-muted-line">{(previewQuery.error as Error).message}</p>
        ) : !invoiceQuery.data || !previewHtml ? (
          <p className="dash-muted-line">Invoice not available.</p>
        ) : (
          <div className="inv-detail">
            <div className="inv-detail-actions">
              <Button
                type="button"
                size="sm"
                loading={downloading}
                onClick={() => void handleDownload()}
              >
                Download PDF
              </Button>
              {invoiceQuery.data.booking.id ? (
                <Link
                  className="inv-detail-link"
                  to={`/dashboard/finance/payments?booking_id=${invoiceQuery.data.booking.id}`}
                >
                  Payment trail
                </Link>
              ) : null}
            </div>
            {downloadError ? <p className="inv-error">{downloadError}</p> : null}
            <iframe
              title="Tax invoice preview"
              className="inv-preview-frame"
              srcDoc={previewHtml}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
