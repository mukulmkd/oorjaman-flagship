import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  formatInrFromPaise,
  settlementStatusLabel,
  type Database,
  type Json,
  type VendorSettlementRow,
} from "@oorjaman/api";
import { formatDisplayDateTime } from "@oorjaman/utils";
import { Modal, TablePaginationBar, useSupabase } from "@oorjaman/web-ui";
import { Link } from "react-router-dom";

export type FinanceKpiId =
  | "recognized"
  | "settled"
  | "collections"
  | "amc_held"
  | "partner_payable"
  | "payouts_review"
  | "penalties_review";

type FinanceKpiLine = {
  id: string;
  bookingId: string | null;
  href: string | null;
  record: string;
  party: string;
  detail: string;
  channel: string;
  amountPaise: number;
  when: string | null;
};

type Breakdown = {
  lines: FinanceKpiLine[];
  truncated: boolean;
};

type BookingLite = {
  id: string;
  subscription_id: string | null;
  reference_code: string | null;
  vendor_id: string | null;
};

const PAGE_SIZE = 10;
const ROW_CAP = 1000;

const COPY: Record<FinanceKpiId, { title: string; description: string; party: string; amount: string }> = {
  recognized: {
    title: "Recognized revenue",
    description: "Platform fee on each completed visit, plus settled cancellation penalties and late-cancel fees.",
    party: "Partner",
    amount: "Recognized",
  },
  settled: {
    title: "Settled revenue",
    description: "The same kinds of fees, counted only after the partner payout or penalty is marked settled.",
    party: "Partner",
    amount: "Settled",
  },
  collections: {
    title: "Customer payments",
    description: "Successful payments from customers. A technician sending that money back to OorjaMan is not listed again.",
    party: "Customer",
    amount: "Received",
  },
  amc_held: {
    title: "AMC prepaid still held",
    description: "Prepaid AMC balances that have not been released for a visit yet.",
    party: "Customer",
    amount: "Still held",
  },
  partner_payable: {
    title: "Still to pay partners",
    description: "Partner share on finished visits that is not marked settled. Amounts still with a technician stay in the held list.",
    party: "Partner",
    amount: "To pay",
  },
  payouts_review: {
    title: "Payouts to review",
    description: "Visit payouts waiting for approval.",
    party: "Partner",
    amount: "Amount",
  },
  penalties_review: {
    title: "Penalties to review",
    description: "Cancellation charges waiting for a decision.",
    party: "Partner",
    amount: "Charge",
  },
};

function lateFeePaise(metadata: Json | null): number {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return 0;
  const cancel = (metadata as Record<string, unknown>).customer_cancellation;
  if (!cancel || typeof cancel !== "object" || Array.isArray(cancel)) return 0;
  const row = cancel as Record<string, unknown>;
  if (row.within_grace_window !== false) return 0;
  const amount = Number(row.late_fee_paise);
  return Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0;
}

async function rowsById<T extends { id: string }>(
  ids: string[],
  load: (slice: string[]) => Promise<T[]>,
): Promise<Map<string, T>> {
  const map = new Map<string, T>();
  const unique = [...new Set(ids.filter(Boolean))];
  for (let i = 0; i < unique.length; i += 80) {
    const rows = await load(unique.slice(i, i + 80));
    for (const row of rows) map.set(row.id, row);
  }
  return map;
}

async function bookingMap(client: SupabaseClient<Database>, ids: string[]): Promise<Map<string, BookingLite>> {
  return rowsById(ids, async (slice) => {
    const { data, error } = await client
      .from("bookings")
      .select("id, subscription_id, reference_code, vendor_id")
      .in("id", slice);
    if (error) throw error;
    return data ?? [];
  });
}

async function vendorNames(client: SupabaseClient<Database>, ids: string[]): Promise<Map<string, string>> {
  const rows = await rowsById(
    ids,
    async (slice) => {
      const { data, error } = await client.from("vendors").select("id, trade_name, business_name").in("id", slice);
      if (error) throw error;
      return data ?? [];
    },
  );
  const map = new Map<string, string>();
  for (const [id, row] of rows) {
    map.set(id, row.trade_name?.trim() || row.business_name || "Partner");
  }
  return map;
}

async function customerNames(client: SupabaseClient<Database>, ids: string[]): Promise<Map<string, string>> {
  const rows = await rowsById(ids, async (slice) => {
    const { data, error } = await client.from("customers").select("id, display_name").in("id", slice);
    if (error) throw error;
    return data ?? [];
  });
  const map = new Map<string, string>();
  for (const [id, row] of rows) map.set(id, row.display_name?.trim() || "Customer");
  return map;
}

function channelFor(booking: BookingLite | undefined): string {
  if (!booking) return "—";
  return booking.subscription_id ? "AMC" : "One-time";
}

function visitLine(
  row: VendorSettlementRow,
  bookings: Map<string, BookingLite>,
  vendors: Map<string, string>,
  amountPaise: number,
  detail: string,
  when: string | null,
  allowZero = false,
): FinanceKpiLine | null {
  const booking = bookings.get(row.booking_id);
  if (!booking || (!allowZero && amountPaise <= 0)) return null;
  return {
    id: row.id,
    bookingId: row.booking_id,
    href: null,
    record: row.reference_code ?? booking.reference_code ?? row.booking_id.slice(0, 8),
    party: vendors.get(row.vendor_id) ?? "Partner",
    detail,
    channel: channelFor(booking),
    amountPaise,
    when,
  };
}

async function loadRevenueLines(
  client: SupabaseClient<Database>,
  mode: "recognized" | "settled",
): Promise<Breakdown> {
  let visitQuery = client.from("vendor_settlements").select("*").eq("kind", "visit_payout").limit(ROW_CAP);
  visitQuery = mode === "settled" ? visitQuery.eq("status", "settled") : visitQuery.neq("status", "waived");
  const [visits, penalties, lateBookings] = await Promise.all([
    visitQuery,
    client
      .from("vendor_settlements")
      .select("*")
      .eq("kind", "cancellation_penalty")
      .eq("status", "settled")
      .limit(ROW_CAP),
    client
      .from("bookings")
      .select("id, reference_code, vendor_id, cancelled_at, metadata")
      .eq("status", "cancelled")
      .not("cancelled_at", "is", null)
      .filter("metadata->customer_cancellation->>within_grace_window", "eq", "false")
      .limit(ROW_CAP),
  ]);
  if (visits.error) throw visits.error;
  if (penalties.error) throw penalties.error;
  if (lateBookings.error) throw lateBookings.error;

  const visitRows = (visits.data ?? []) as VendorSettlementRow[];
  const penaltyRows = (penalties.data ?? []) as VendorSettlementRow[];
  const bookings = await bookingMap(client, [...visitRows, ...penaltyRows].map((row) => row.booking_id));
  const vendorIds = [
    ...visitRows.map((row) => row.vendor_id),
    ...penaltyRows.map((row) => row.vendor_id),
    ...(lateBookings.data ?? []).map((row) => row.vendor_id).filter((id): id is string => Boolean(id)),
  ];
  const vendors = await vendorNames(client, vendorIds);

  const lines: FinanceKpiLine[] = [];
  for (const row of visitRows) {
    const held = row.remittance_status === "pending" ? " · Still with the technician" : "";
    const line = visitLine(
      row,
      bookings,
      vendors,
      row.platform_fee_paise ?? 0,
      `Platform fee · ${settlementStatusLabel(row.status)}${held}`,
      mode === "settled" ? row.settled_at ?? row.updated_at : row.created_at,
    );
    if (line) lines.push(line);
  }
  for (const row of penaltyRows) {
    const line = visitLine(
      row,
      bookings,
      vendors,
      Math.max(0, row.penalty_final_paise ?? 0),
      "Cancellation penalty · Settled",
      row.settled_at ?? row.updated_at,
    );
    if (line) {
      line.channel = "—";
      lines.push(line);
    }
  }
  for (const booking of lateBookings.data ?? []) {
    const amount = lateFeePaise(booking.metadata);
    if (amount <= 0) continue;
    lines.push({
      id: `late-${booking.id}`,
      bookingId: booking.id,
      href: null,
      record: booking.reference_code ?? booking.id.slice(0, 8),
      party: booking.vendor_id ? vendors.get(booking.vendor_id) ?? "Partner" : "—",
      detail: "Late cancellation fee",
      channel: "—",
      amountPaise: amount,
      when: booking.cancelled_at,
    });
  }

  lines.sort((a, b) => (b.when ?? "").localeCompare(a.when ?? ""));
  return {
    lines,
    truncated: [visitRows, penaltyRows, lateBookings.data ?? []].some((rows) => rows.length >= ROW_CAP),
  };
}

async function loadCollections(client: SupabaseClient<Database>): Promise<Breakdown> {
  const { data, error } = await client
    .from("payments")
    .select("id, booking_id, subscription_id, customer_id, amount, collection_channel, payment_method, paid_at, created_at")
    .eq("status", "success")
    .or("collection_channel.is.null,collection_channel.neq.technician_remittance")
    .order("paid_at", { ascending: false })
    .limit(ROW_CAP);
  if (error) throw error;
  const payments = data ?? [];
  const [bookings, plans, customers] = await Promise.all([
    bookingMap(
      client,
      payments.map((row) => row.booking_id).filter((id): id is string => Boolean(id)),
    ),
    rowsById(
      payments.map((row) => row.subscription_id).filter((id): id is string => Boolean(id)),
      async (slice) => {
        const result = await client.from("subscriptions").select("id, plan_name").in("id", slice);
        if (result.error) throw result.error;
        return result.data ?? [];
      },
    ),
    customerNames(
      client,
      payments.map((row) => row.customer_id),
    ),
  ]);

  const lines = payments
    .filter((row) => row.amount > 0)
    .map((row): FinanceKpiLine => {
      const booking = row.booking_id ? bookings.get(row.booking_id) : undefined;
      const plan = row.subscription_id ? plans.get(row.subscription_id) : undefined;
      const paidToPartner = row.collection_channel === "partner";
      const method = row.payment_method?.trim();
      return {
        id: row.id,
        bookingId: row.booking_id,
        href: row.booking_id ? null : row.subscription_id ? `/dashboard/finance/amc-contracts?highlight=${row.subscription_id}` : null,
        record: booking?.reference_code ?? plan?.plan_name ?? row.id.slice(0, 8),
        party: customers.get(row.customer_id) ?? "Customer",
        detail: [paidToPartner ? "Paid to the partner" : "Paid to OorjaMan", method].filter(Boolean).join(" · "),
        channel: row.subscription_id ? "AMC plan" : "One-time",
        amountPaise: row.amount,
        when: row.paid_at ?? row.created_at,
      };
    });

  return { lines, truncated: payments.length >= ROW_CAP };
}

async function loadAmcHeld(client: SupabaseClient<Database>): Promise<Breakdown> {
  const { data, error } = await client
    .from("amc_wallets")
    .select(
      "id, subscription_id, customer_id, assigned_vendor_id, balance_paise, visits_allocated, visits_released, status, funded_at, created_at",
    )
    .in("status", ["pending_funding", "funded"])
    .order("created_at", { ascending: false })
    .limit(ROW_CAP);
  if (error) throw error;
  const wallets = (data ?? []).filter((row) => row.balance_paise > 0);
  const [plans, customers, vendors] = await Promise.all([
    rowsById(
      wallets.map((row) => row.subscription_id),
      async (slice) => {
        const result = await client.from("subscriptions").select("id, plan_name").in("id", slice);
        if (result.error) throw result.error;
        return result.data ?? [];
      },
    ),
    customerNames(
      client,
      wallets.map((row) => row.customer_id),
    ),
    vendorNames(
      client,
      wallets.map((row) => row.assigned_vendor_id).filter((id): id is string => Boolean(id)),
    ),
  ]);

  const lines = wallets.map((row): FinanceKpiLine => {
    const partner = row.assigned_vendor_id ? vendors.get(row.assigned_vendor_id) : null;
    const released = `${row.visits_released} of ${row.visits_allocated} visits released`;
    return {
      id: row.id,
      bookingId: null,
      href: `/dashboard/finance/amc-contracts?highlight=${row.subscription_id}`,
      record: plans.get(row.subscription_id)?.plan_name ?? "AMC plan",
      party: customers.get(row.customer_id) ?? "Customer",
      detail: partner ? `${released} · ${partner}` : released,
      channel: row.status === "funded" ? "Funded" : "Waiting for payment",
      amountPaise: row.balance_paise,
      when: row.funded_at ?? row.created_at,
    };
  });

  return { lines, truncated: (data ?? []).length >= ROW_CAP };
}

async function loadSettlementLines(
  client: SupabaseClient<Database>,
  mode: "partner_payable" | "payouts_review" | "penalties_review",
): Promise<Breakdown> {
  let query = client.from("vendor_settlements").select("*").order("created_at", { ascending: false }).limit(ROW_CAP);
  if (mode === "penalties_review") {
    query = query.eq("kind", "cancellation_penalty").eq("status", "pending_review");
  } else if (mode === "payouts_review") {
    query = query
      .eq("kind", "visit_payout")
      .eq("status", "pending_review")
      .or("remittance_status.is.null,remittance_status.eq.received");
  } else {
    query = query
      .eq("kind", "visit_payout")
      .in("status", ["pending_review", "approved"])
      .or("remittance_status.is.null,remittance_status.eq.received");
  }
  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as VendorSettlementRow[];
  const bookings = await bookingMap(
    client,
    rows.map((row) => row.booking_id),
  );
  const vendors = await vendorNames(
    client,
    rows.map((row) => row.vendor_id),
  );
  const lines: FinanceKpiLine[] = [];
  for (const row of rows) {
    const amount =
      mode === "penalties_review"
        ? Math.max(0, row.penalty_final_paise ?? row.penalty_assessed_paise ?? 0)
        : Math.max(0, row.net_payout_paise ?? 0);
    const paidToPartner = row.customer_paid_to === "partner" ? " · Customer paid the partner" : "";
    const line = visitLine(
      row,
      bookings,
      vendors,
      amount,
      `${mode === "penalties_review" ? "Cancellation penalty" : "Partner share"} · ${settlementStatusLabel(row.status)}${paidToPartner}`,
      row.created_at,
      mode !== "partner_payable",
    );
    if (!line) continue;
    if (mode === "penalties_review") line.channel = "—";
    lines.push(line);
  }
  return { lines, truncated: rows.length >= ROW_CAP };
}

async function loadBreakdown(client: SupabaseClient<Database>, kpi: FinanceKpiId): Promise<Breakdown> {
  if (kpi === "recognized" || kpi === "settled") return loadRevenueLines(client, kpi);
  if (kpi === "collections") return loadCollections(client);
  if (kpi === "amc_held") return loadAmcHeld(client);
  return loadSettlementLines(client, kpi);
}

export function FinanceKpiBreakdown({
  kpi,
  onOpenBooking,
  onClose,
}: {
  kpi: FinanceKpiId;
  onOpenBooking: (bookingId: string) => void;
  onClose: () => void;
}) {
  const supabase = useSupabase();
  const [page, setPage] = useState(1);
  const copy = COPY[kpi];
  const query = useQuery({
    queryKey: ["finance", "kpi-breakdown", kpi] as const,
    queryFn: () => loadBreakdown(supabase!, kpi),
    enabled: Boolean(supabase),
  });

  const lines = query.data?.lines ?? [];
  const pageRows = lines.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPaise = useMemo(() => lines.reduce((sum, line) => sum + line.amountPaise, 0), [lines]);

  return (
    <Modal open title={copy.title} description={copy.description} size="xl" onClose={onClose}>
      <div className="fin-kpi-detail">
      {query.isPending ? <p className="bm-empty">Loading rows…</p> : null}
      {query.isError ? (
        <p className="fin-error">{query.error instanceof Error ? query.error.message : "Could not load these rows."}</p>
      ) : null}
      {query.isSuccess && lines.length === 0 ? <p className="bm-empty">Nothing is included in this total.</p> : null}
      {query.isSuccess && lines.length > 0 ? (
        <>
          <div className="bm-table-wrap fin-kpi-detail-table">
            <table className="bm-table fin-table">
              <thead>
                <tr>
                  <th>Record</th>
                  <th>{copy.party}</th>
                  <th>What</th>
                  <th>Channel</th>
                  <th>{copy.amount}</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((line) => (
                  <tr key={line.id}>
                    <td className="bm-cell-mono">
                      {line.bookingId ? (
                        <button type="button" className="fin-booking-link" onClick={() => onOpenBooking(line.bookingId!)}>
                          {line.record}
                        </button>
                      ) : line.href ? (
                        <Link to={line.href} className="fin-booking-link">
                          {line.record}
                        </Link>
                      ) : (
                        line.record
                      )}
                    </td>
                    <td>{line.party}</td>
                    <td className="fin-breakdown">{line.detail}</td>
                    <td>{line.channel}</td>
                    <td className="fin-amount-payout">{formatInrFromPaise(line.amountPaise)}</td>
                    <td>{line.when ? formatDisplayDateTime(line.when) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="fin-kpi-detail-foot">
            <p className="fin-held-copy">
              {lines.length} {lines.length === 1 ? "row" : "rows"} · {formatInrFromPaise(totalPaise)}
              {query.data.truncated ? " · Showing the latest 1,000 matches" : ""}
            </p>
            {lines.length > PAGE_SIZE ? (
              <TablePaginationBar page={page} pageSize={PAGE_SIZE} total={lines.length} onPageChange={setPage} />
            ) : null}
          </div>
        </>
      ) : null}
      </div>
    </Modal>
  );
}
