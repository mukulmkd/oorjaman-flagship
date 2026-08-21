import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  PaymentAttemptRow,
  PaymentRefundRow,
  PaymentRow,
  PaymentStatus,
} from "../database.types";
import { takeRows } from "../result";
import { dbPaymentStatusToDomain } from "./razorpay-status";

export type AdminPaymentListFilters = {
  status?: PaymentStatus | "";
  provider?: "dummy" | "razorpay" | "";
  /** Free text: razorpay order/payment id, payment uuid, booking uuid */
  search?: string;
  bookingId?: string;
  subscriptionId?: string;
  limit?: number;
};

export type AdminPaymentListRow = PaymentRow & {
  customer_display_name?: string | null;
  booking_reference_code?: string | null;
  booking_status?: string | null;
};

export type AdminPaymentOpsDetail = {
  payment: AdminPaymentListRow;
  attempts: PaymentAttemptRow[];
  refunds: PaymentRefundRow[];
};

function escapeIlike(term: string): string {
  return term.replace(/[%_,]/g, (ch) => `\\${ch}`);
}

/** Admin payment list for ops console (RLS: is_admin). */
export async function adminListPayments(
  client: SupabaseClient<Database>,
  filters: AdminPaymentListFilters = {},
): Promise<AdminPaymentListRow[]> {
  const limit = Math.min(Math.max(filters.limit ?? 200, 1), 500);
  let q = client
    .from("payments")
    .select(
      `
      *,
      customers ( display_name ),
      bookings ( reference_code, status )
    `,
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (filters.status) q = q.eq("status", filters.status);
  if (filters.provider) q = q.eq("provider", filters.provider);
  if (filters.bookingId) q = q.eq("booking_id", filters.bookingId);
  if (filters.subscriptionId) q = q.eq("subscription_id", filters.subscriptionId);

  const search = filters.search?.trim();
  if (search) {
    const like = `%${escapeIlike(search)}%`;
    // uuid-shaped: exact match on ids; otherwise ilike gateway ids
    const uuidish = /^[0-9a-f-]{36}$/i.test(search);
    if (uuidish) {
      q = q.or(
        `id.eq.${search},booking_id.eq.${search},subscription_id.eq.${search},customer_id.eq.${search}`,
      );
    } else {
      q = q.or(
        `razorpay_order_id.ilike.${like},razorpay_payment_id.ilike.${like},payment_method.ilike.${like},customer_error_category.ilike.${like}`,
      );
    }
  }

  const { data, error } = await q;
  if (error) throw error;

  const rows = (data ?? []) as Array<
    PaymentRow & {
      customers?: { display_name?: string | null } | null;
      bookings?: { reference_code?: string | null; status?: string | null } | null;
    }
  >;

  return rows.map((r) => {
    const { customers, bookings, ...pay } = r;
    return {
      ...(pay as PaymentRow),
      customer_display_name: customers?.display_name ?? null,
      booking_reference_code: bookings?.reference_code ?? null,
      booking_status: bookings?.status ?? null,
    };
  });
}

export async function adminGetPaymentById(
  client: SupabaseClient<Database>,
  paymentId: string,
): Promise<AdminPaymentListRow | null> {
  const { data, error } = await client
    .from("payments")
    .select(
      `
      *,
      customers ( display_name ),
      bookings ( reference_code, status )
    `,
    )
    .eq("id", paymentId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as PaymentRow & {
    customers?: { display_name?: string | null } | null;
    bookings?: { reference_code?: string | null; status?: string | null } | null;
  };
  const { customers, bookings, ...pay } = row;
  return {
    ...(pay as PaymentRow),
    customer_display_name: customers?.display_name ?? null,
    booking_reference_code: bookings?.reference_code ?? null,
    booking_status: bookings?.status ?? null,
  };
}

export async function adminListPaymentAttempts(
  client: SupabaseClient<Database>,
  paymentId: string,
): Promise<PaymentAttemptRow[]> {
  const { data, error } = await client
    .from("payment_attempts")
    .select("*")
    .eq("payment_id", paymentId)
    .order("attempt_number", { ascending: true });
  return takeRows(data, error) as PaymentAttemptRow[];
}

export async function adminListPaymentRefunds(
  client: SupabaseClient<Database>,
  paymentId: string,
): Promise<PaymentRefundRow[]> {
  const { data, error } = await client
    .from("payment_refunds")
    .select("*")
    .eq("payment_id", paymentId)
    .order("created_at", { ascending: false });
  return takeRows(data, error) as PaymentRefundRow[];
}

export async function adminGetPaymentOpsDetail(
  client: SupabaseClient<Database>,
  paymentId: string,
): Promise<AdminPaymentOpsDetail | null> {
  const payment = await adminGetPaymentById(client, paymentId);
  if (!payment) return null;
  const [attempts, refunds] = await Promise.all([
    adminListPaymentAttempts(client, paymentId).catch(() => [] as PaymentAttemptRow[]),
    adminListPaymentRefunds(client, paymentId).catch(() => [] as PaymentRefundRow[]),
  ]);
  return { payment, attempts, refunds };
}

export function adminPaymentStatusLabel(status: string | null | undefined): string {
  const domain = dbPaymentStatusToDomain(status);
  const labels: Record<string, string> = {
    PAYMENT_PENDING: "Pending",
    PAYMENT_AUTHORIZED: "Authorized (not paid)",
    PAID: "Paid (captured)",
    PAYMENT_FAILED: "Failed",
    PAYMENT_CANCELLED: "Cancelled",
    PAYMENT_TIMEOUT: "Timed out",
    PARTIALLY_REFUNDED: "Partially refunded",
    REFUND_PENDING: "Refund pending",
    REFUND_PROCESSED: "Refund processed",
    REFUND_FAILED: "Refund failed",
    REFUNDED: "Refunded",
  };
  return labels[domain] ?? status ?? "—";
}

export function adminPaymentStatusTone(
  status: string | null | undefined,
): "neutral" | "warning" | "success" | "danger" {
  switch (status) {
    case "success":
      return "success";
    case "authorized":
    case "pending":
    case "refund_pending":
      return "warning";
    case "failed":
    case "cancelled":
    case "timeout":
    case "refund_failed":
      return "danger";
    case "partially_refunded":
    case "refunded":
      return "neutral";
    default:
      return "neutral";
  }
}

/** Soft require for callers. */
export function requireAdminPayment(row: AdminPaymentListRow | null): AdminPaymentListRow {
  if (!row) throw new Error("Payment not found");
  return row;
}
