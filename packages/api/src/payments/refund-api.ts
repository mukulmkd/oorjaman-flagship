import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json, PaymentRow } from "../database.types";
import { requireSessionUserId, SupabaseApiError } from "../result";
import { listPaymentsForBooking } from "./payment-queries";

export type RefundAttemptStatus =
  | "initiated"
  | "skipped"
  | "failed"
  | "already_refunded"
  | "already_initiated";

export type RefundAttemptResult = {
  status: RefundAttemptStatus;
  amountPaise: number;
  paymentId: string | null;
  razorpayRefundId: string | null;
  error: string | null;
};

export type BookingRefundAttemptMeta = {
  status: RefundAttemptStatus;
  amountPaise: number;
  paymentId: string | null;
  razorpayRefundId: string | null;
  error: string | null;
  at: string | null;
  reason: string | null;
};

type CreateRefundFnResponse = {
  ok?: boolean;
  error?: string;
  payment_id?: string;
  razorpay_refund_id?: string | null;
  amount_paise?: number;
  already_refunded?: boolean;
  already_initiated?: boolean;
  apply_warning?: string;
};

/** Prefer Edge Function JSON `error` over the generic non-2xx supabase-js message. */
async function messageFromFunctionsInvokeError(error: unknown): Promise<string> {
  const fallback =
    error && typeof error === "object" && typeof (error as { message?: unknown }).message === "string"
      ? (error as { message: string }).message
      : "Could not initiate Razorpay refund.";
  const context = error && typeof error === "object" ? (error as { context?: unknown }).context : undefined;
  if (context && typeof context === "object" && typeof (context as Response).json === "function") {
    try {
      const body = (await (context as Response).json()) as { error?: unknown };
      if (typeof body?.error === "string" && body.error.trim()) return body.error.trim();
    } catch {
      /* body already consumed or not JSON */
    }
  }
  if (fallback.includes("non-2xx")) {
    return "Refund could not start. Deploy create-razorpay-refund and verify Razorpay secrets.";
  }
  return fallback;
}

/** Captured Razorpay payment still eligible for (further) refund. */
export function isRefundableRazorpayPayment(payment: PaymentRow): boolean {
  if (payment.provider !== "razorpay") return false;
  if (payment.status !== "success" && payment.status !== "partially_refunded") return false;
  if (!payment.razorpay_payment_id?.trim()) return false;
  const remaining = Math.max(0, Math.round(payment.amount) - Math.max(0, Math.round(payment.amount_refunded)));
  return remaining > 0;
}

export function remainingRefundablePaise(payment: PaymentRow): number {
  return Math.max(0, Math.round(payment.amount) - Math.max(0, Math.round(payment.amount_refunded)));
}

/**
 * Net refund after late fee: `max(0, remaining − lateFeePaise)`.
 * Grace / vendor reject / admin full: pass lateFeePaise = 0.
 */
export function computeCancelRefundPaise(
  payment: PaymentRow,
  lateFeePaise: number,
): number {
  const remaining = remainingRefundablePaise(payment);
  const fee = Math.max(0, Math.round(lateFeePaise));
  return Math.max(0, remaining - fee);
}

/** Newest refundable Razorpay payment for a booking, or null. */
export async function findRefundableRazorpayPaymentForBooking(
  client: SupabaseClient<Database>,
  bookingId: string,
): Promise<PaymentRow | null> {
  const rows = await listPaymentsForBooking(client, bookingId);
  return rows.find(isRefundableRazorpayPayment) ?? null;
}

/**
 * Estimate refund before cancel (for UI). Returns null when there is nothing to refund
 * (unpaid / postpaid / already refunded).
 */
export async function estimateBookingCancelRefund(
  client: SupabaseClient<Database>,
  bookingId: string,
  lateFeePaise: number,
): Promise<{ payment: PaymentRow; refundPaise: number; lateFeePaise: number } | null> {
  const payment = await findRefundableRazorpayPaymentForBooking(client, bookingId);
  if (!payment) return null;
  const fee = Math.max(0, Math.round(lateFeePaise));
  return {
    payment,
    refundPaise: computeCancelRefundPaise(payment, fee),
    lateFeePaise: fee,
  };
}

export function readBookingRefundAttemptMeta(
  metadata: Json | null | undefined,
): BookingRefundAttemptMeta | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const row = (metadata as Record<string, unknown>).refund_attempt;
  if (!row || typeof row !== "object" || Array.isArray(row)) return null;
  const r = row as Record<string, unknown>;
  const statusRaw = typeof r.status === "string" ? r.status : "failed";
  const status: RefundAttemptStatus =
    statusRaw === "initiated" ||
    statusRaw === "skipped" ||
    statusRaw === "failed" ||
    statusRaw === "already_refunded" ||
    statusRaw === "already_initiated"
      ? statusRaw
      : "failed";
  return {
    status,
    amountPaise:
      typeof r.amount_paise === "number" ? Math.max(0, Math.round(r.amount_paise)) : 0,
    paymentId: typeof r.payment_id === "string" ? r.payment_id : null,
    razorpayRefundId:
      typeof r.razorpay_refund_id === "string" ? r.razorpay_refund_id : null,
    error: typeof r.error === "string" ? r.error : null,
    at: typeof r.at === "string" ? r.at : null,
    reason: typeof r.reason === "string" ? r.reason : null,
  };
}

export function refundAttemptToMetadataJson(
  attempt: RefundAttemptResult,
  reason: string,
): Json {
  return {
    status: attempt.status,
    amount_paise: attempt.amountPaise,
    payment_id: attempt.paymentId,
    razorpay_refund_id: attempt.razorpayRefundId,
    error: attempt.error,
    at: new Date().toISOString(),
    reason,
  };
}

export async function invokeCreateRazorpayRefund(
  client: SupabaseClient<Database>,
  body: {
    payment_id: string;
    amount_paise: number;
    reason?: string;
    idempotency_key?: string;
  },
): Promise<RefundAttemptResult> {
  const { data, error } = await client.functions.invoke<CreateRefundFnResponse>(
    "create-razorpay-refund",
    { body },
  );
  if (error) {
    return {
      status: "failed",
      amountPaise: body.amount_paise,
      paymentId: body.payment_id,
      razorpayRefundId: null,
      error: await messageFromFunctionsInvokeError(error),
    };
  }
  if (!data?.ok) {
    return {
      status: "failed",
      amountPaise: body.amount_paise,
      paymentId: body.payment_id,
      razorpayRefundId: null,
      error: data?.error ?? "Could not initiate Razorpay refund.",
    };
  }
  if (data.already_refunded) {
    return {
      status: "already_refunded",
      amountPaise: 0,
      paymentId: data.payment_id ?? body.payment_id,
      razorpayRefundId: null,
      error: null,
    };
  }
  if (data.already_initiated) {
    return {
      status: "already_initiated",
      amountPaise: data.amount_paise ?? body.amount_paise,
      paymentId: data.payment_id ?? body.payment_id,
      razorpayRefundId: data.razorpay_refund_id ?? null,
      error: null,
    };
  }
  return {
    status: "initiated",
    amountPaise: data.amount_paise ?? body.amount_paise,
    paymentId: data.payment_id ?? body.payment_id,
    razorpayRefundId: data.razorpay_refund_id ?? null,
    error: data.apply_warning ?? null,
  };
}

/**
 * Find refundable payment for booking and initiate Razorpay refund.
 * Soft-fails: never throws for gateway errors (caller still cancels booking).
 */
export async function initiateBookingPaymentRefund(
  client: SupabaseClient<Database>,
  params: {
    bookingId: string;
    /** Explicit amount; defaults to full remaining. */
    amountPaise?: number;
    lateFeePaise?: number;
    reason: string;
    idempotencyKey?: string;
  },
): Promise<RefundAttemptResult> {
  const payment = await findRefundableRazorpayPaymentForBooking(client, params.bookingId);
  if (!payment) {
    return {
      status: "skipped",
      amountPaise: 0,
      paymentId: null,
      razorpayRefundId: null,
      error: null,
    };
  }

  const amount =
    params.amountPaise != null
      ? Math.max(0, Math.round(params.amountPaise))
      : computeCancelRefundPaise(payment, params.lateFeePaise ?? 0);

  if (amount <= 0) {
    return {
      status: "skipped",
      amountPaise: 0,
      paymentId: payment.id,
      razorpayRefundId: null,
      error: null,
    };
  }

  return invokeCreateRazorpayRefund(client, {
    payment_id: payment.id,
    amount_paise: amount,
    reason: params.reason,
    idempotency_key: params.idempotencyKey,
  });
}

/** Admin: refund a specific payment (full remaining or explicit amount). */
export async function adminInitiatePaymentRefund(
  client: SupabaseClient<Database>,
  params: {
    paymentId: string;
    amountPaise?: number;
    reason?: string;
  },
): Promise<RefundAttemptResult> {
  const { data: userData } = await client.auth.getUser();
  requireSessionUserId(userData.user?.id);

  const { data, error } = await client
    .from("payments")
    .select("*")
    .eq("id", params.paymentId)
    .maybeSingle();
  if (error) throw new SupabaseApiError(error.message, error);
  if (!data) throw new SupabaseApiError("Payment not found.");
  const payment = data as PaymentRow;

  if (!isRefundableRazorpayPayment(payment)) {
    throw new SupabaseApiError("This payment is not eligible for a Razorpay refund.");
  }

  const remaining = remainingRefundablePaise(payment);
  const amount =
    params.amountPaise != null ? Math.max(0, Math.round(params.amountPaise)) : remaining;
  if (amount <= 0) {
    return {
      status: "already_refunded",
      amountPaise: 0,
      paymentId: payment.id,
      razorpayRefundId: null,
      error: null,
    };
  }
  if (amount > remaining) {
    throw new SupabaseApiError(
      `Refund amount exceeds remaining balance (${remaining} paise).`,
    );
  }

  const result = await invokeCreateRazorpayRefund(client, {
    payment_id: payment.id,
    amount_paise: amount,
    reason: params.reason?.trim() || "Admin-initiated refund",
    idempotency_key: `admin-${payment.id}-${amount}`,
  });
  if (result.status === "failed") {
    throw new SupabaseApiError(result.error ?? "Refund failed.");
  }
  return result;
}

export function customerFacingRefundMessage(attempt: RefundAttemptResult): string {
  if (attempt.status === "initiated" || attempt.status === "already_initiated") {
    const amt =
      attempt.amountPaise > 0
        ? ` ₹${(attempt.amountPaise / 100).toFixed(attempt.amountPaise % 100 === 0 ? 0 : 2)}`
        : "";
    return ` Refund of${amt} has been initiated and typically reaches your original payment method in 5–10 business days.`;
  }
  if (attempt.status === "failed") {
    return " Booking was cancelled. Refund could not be started automatically — OorjaMan ops will process it shortly.";
  }
  if (attempt.status === "already_refunded") {
    return " This payment was already refunded.";
  }
  return "";
}
