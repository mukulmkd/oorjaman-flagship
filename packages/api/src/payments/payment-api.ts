import type { SupabaseClient } from "@supabase/supabase-js";
import type { BookingRow, Database, PaymentRow, SubscriptionRow } from "../database.types";
import { createBookingAsCustomer, type CreateBookingInput } from "../bookings/booking-api";
import { fundAmcWalletFromPayment } from "../finance/amc-wallet-api";
import { emitAdminAmcAwaitingPartnerNotification } from "../notifications/amc-notifications";
import { customerAbandonUnpaidCheckoutBooking } from "../bookings/booking-api";
import { requireSessionUserId, SupabaseApiError, takeRows, takeSingleRow } from "../result";
import { isPaymentPaidDbStatus, isPaymentTerminalDbStatus } from "./razorpay-status";
import { normalizeRazorpayError } from "./razorpay-errors";

async function getCustomerIdForSession(client: SupabaseClient<Database>): Promise<string> {
  const { data: userData } = await client.auth.getUser();
  const uid = requireSessionUserId(userData.user?.id);
  const { data, error } = await client.from("customers").select("id").eq("user_id", uid).maybeSingle();
  if (error) throw new SupabaseApiError(error.message, error);
  if (!data?.id) throw new SupabaseApiError("Customer profile not found.");
  return data.id;
}

async function assertPendingPaymentOwned(
  client: SupabaseClient<Database>,
  paymentId: string,
): Promise<PaymentRow> {
  const customerId = await getCustomerIdForSession(client);
  const { data, error } = await client
    .from("payments")
    .select("*")
    .eq("id", paymentId)
    .eq("customer_id", customerId)
    .maybeSingle();
  if (error) throw new SupabaseApiError(error.message, error);
  if (!data) throw new SupabaseApiError("Payment not found.");
  if (data.status !== "pending") {
    throw new SupabaseApiError("This payment was already completed or failed.");
  }
  return data as PaymentRow;
}

/** Pending dummy payment row linked to a checkout booking (`pending_payment`). */
export async function createPendingPayment(
  client: SupabaseClient<Database>,
  params: { customerId: string; bookingId: string; amountPaise: number },
): Promise<PaymentRow> {
  const sessionCustomerId = await getCustomerIdForSession(client);
  if (params.customerId !== sessionCustomerId) {
    throw new SupabaseApiError("Customer mismatch.");
  }
  const amount = Math.max(0, Math.round(params.amountPaise));
  const { data, error } = await client
    .from("payments")
    .insert({
      customer_id: params.customerId,
      booking_id: params.bookingId,
      amount,
      status: "pending",
      provider: "dummy",
    })
    .select()
    .single();
  return takeSingleRow(data, error) as PaymentRow;
}

/** Payments linked to a booking (RLS: customer / vendor / admin). Newest first. */
export async function listPaymentsForBooking(
  client: SupabaseClient<Database>,
  bookingId: string,
): Promise<PaymentRow[]> {
  const { data, error } = await client
    .from("payments")
    .select("*")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false });
  return takeRows(data, error) as PaymentRow[];
}

export async function getPaymentById(
  client: SupabaseClient<Database>,
  paymentId: string,
): Promise<PaymentRow | null> {
  const customerId = await getCustomerIdForSession(client);
  const { data, error } = await client
    .from("payments")
    .select("*")
    .eq("id", paymentId)
    .eq("customer_id", customerId)
    .maybeSingle();
  if (error) throw new SupabaseApiError(error.message, error);
  return (data as PaymentRow) ?? null;
}

/** Poll until payment reaches a terminal status (not merely authorized) or timeout. */
export async function waitForPaymentTerminalStatus(
  client: SupabaseClient<Database>,
  paymentId: string,
  options?: { timeoutMs?: number; intervalMs?: number },
): Promise<PaymentRow> {
  const timeoutMs = options?.timeoutMs ?? 45_000;
  const intervalMs = options?.intervalMs ?? 1_500;
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const row = await getPaymentById(client, paymentId);
    if (!row) throw new SupabaseApiError("Payment not found.");
    // authorized = not paid yet — keep polling for capture
    if (row.status === "authorized") {
      await new Promise((r) => setTimeout(r, intervalMs));
      continue;
    }
    if (isPaymentTerminalDbStatus(row.status)) return row;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  const last = await getPaymentById(client, paymentId);
  if (!last) throw new SupabaseApiError("Payment not found.");
  if (last.status === "authorized") {
    throw new SupabaseApiError(
      "Payment was authorized but not yet captured. If you were charged, wait a moment and open My bookings.",
    );
  }
  if (isPaymentTerminalDbStatus(last.status)) return last;
  throw new SupabaseApiError(
    "Payment is still pending. If you were charged, wait a moment and open My bookings — confirmation can take a few seconds.",
  );
}

/**
 * After Checkout SDK success: verify HMAC + Razorpay payment on the server (never trust client alone).
 */
export async function verifyRazorpayCheckoutCallback(
  client: SupabaseClient<Database>,
  params: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    oorjaman_payment_id?: string;
  },
): Promise<{ ok: boolean; status?: string; payment_id?: string; message?: string }> {
  const { data, error } = await client.functions.invoke<{
    ok?: boolean;
    status?: string;
    payment_id?: string;
    message?: string;
    error?: string;
  }>("verify-razorpay-payment", { body: params });
  if (error) {
    const detail = await messageFromFunctionsInvokeError(error);
    const lower = detail.toLowerCase();
    if (lower.includes("non-2xx") || lower.includes("failed to send") || lower.includes("not found")) {
      throw new SupabaseApiError(
        "Payment verification service is unavailable. Deploy verify-razorpay-payment on UAT (and ensure the webhook is live). If you were charged, check My bookings shortly.",
        error,
      );
    }
    throw new SupabaseApiError(detail, error);
  }
  if (!data?.ok) {
    throw new SupabaseApiError(data?.error ?? data?.message ?? "Payment verification failed.");
  }
  return {
    ok: true,
    status: data.status,
    payment_id: data.payment_id,
    message: data.message,
  };
}

export { isPaymentPaidDbStatus, isPaymentTerminalDbStatus };

/** Simulated failure: marks payment failed (customer can retry with a new pending row for the same booking). */
export async function markDummyPaymentFailed(
  client: SupabaseClient<Database>,
  paymentId: string,
): Promise<void> {
  await assertPendingPaymentOwned(client, paymentId);
  const { error } = await client
    .from("payments")
    .update({ status: "failed" })
    .eq("id", paymentId)
    .eq("status", "pending");
  if (error) throw new SupabaseApiError(error.message, error);
}

/**
 * Customer left checkout: fail the payment row and cancel the linked `pending_payment` booking.
 * Works for dummy and razorpay (RLS allows razorpay → failed only).
 */
export async function abandonPendingCheckout(
  client: SupabaseClient<Database>,
  paymentId: string,
): Promise<void> {
  const payment = await assertPendingPaymentOwned(client, paymentId);
  if (!payment.booking_id) {
    throw new SupabaseApiError("Payment is not linked to a booking.");
  }
  await markDummyPaymentFailed(client, paymentId);
  await customerAbandonUnpaidCheckoutBooking(client, payment.booking_id);
}

/**
 * Simulated success: records payment success, then advances booking `pending_payment` → `confirmed`.
 * Booking must not advance unless payment succeeds first. Dummy provider only.
 */
export async function completeDummyPaymentSuccess(
  client: SupabaseClient<Database>,
  paymentId: string,
  options?: { paymentMethod?: string },
): Promise<{ booking: BookingRow; payment: PaymentRow }> {
  const payment = await assertPendingPaymentOwned(client, paymentId);
  if (payment.provider !== "dummy") {
    throw new SupabaseApiError("Use Razorpay checkout for this payment.");
  }
  if (!payment.booking_id) {
    throw new SupabaseApiError("Payment is not linked to a booking.");
  }

  const { data: bookingSnap, error: bookFetchErr } = await client
    .from("bookings")
    .select("id, status")
    .eq("id", payment.booking_id)
    .maybeSingle();
  if (bookFetchErr) throw new SupabaseApiError(bookFetchErr.message, bookFetchErr);
  if (!bookingSnap || bookingSnap.status !== "pending_payment") {
    throw new SupabaseApiError("Booking is not awaiting payment confirmation.");
  }

  const paidAt = new Date().toISOString();
  const method = options?.paymentMethod?.trim() || "UPI";

  const { data: payUpdated, error: payErr } = await client
    .from("payments")
    .update({ status: "success", paid_at: paidAt, payment_method: method })
    .eq("id", paymentId)
    .eq("status", "pending")
    .eq("provider", "dummy")
    .select()
    .single();

  if (payErr) throw new SupabaseApiError(payErr.message, payErr);
  if (!payUpdated) {
    throw new SupabaseApiError("Could not confirm payment - it may have already been processed.");
  }

  const { data: booking, error: bookErr } = await client
    .from("bookings")
    .update({ status: "confirmed" })
    .eq("id", payment.booking_id)
    .eq("status", "pending_payment")
    .select()
    .single();

  if (bookErr || !booking) {
    await client
      .from("payments")
      .update({ status: "pending", paid_at: null, payment_method: null })
      .eq("id", paymentId)
      .eq("status", "success");
    throw new SupabaseApiError(
      bookErr?.message ?? "Could not activate the booking after payment.",
      bookErr ?? undefined,
    );
  }

  const { postBookingConfirmedNotifications } = await import("../bookings/booking-confirm-notifications");
  const notifiedBooking = await postBookingConfirmedNotifications(client, booking);

  return { booking: notifiedBooking, payment: payUpdated as PaymentRow };
}

/**
 * One-time visit: create the booking and successful payment together after checkout succeeds.
 * No `pending_payment` row is written — incomplete checkouts stay in the app only.
 * Dummy / local simulate only.
 */
export async function createPaidOneTimeBookingCheckout(
  client: SupabaseClient<Database>,
  params: {
    bookingInput: CreateBookingInput;
    amountPaise: number;
    paymentMethod?: string;
  },
): Promise<{ booking: BookingRow; payment: PaymentRow }> {
  const booking = await createBookingAsCustomer(client, {
    ...params.bookingInput,
    status: "confirmed",
  });

  const paidAt = new Date().toISOString();
  const method = params.paymentMethod?.trim() || "UPI";
  const amount = Math.max(0, Math.round(params.amountPaise));

  const { data, error } = await client
    .from("payments")
    .insert({
      customer_id: booking.customer_id,
      booking_id: booking.id,
      amount,
      status: "success",
      provider: "dummy",
      paid_at: paidAt,
      payment_method: method,
    })
    .select()
    .single();

  return { booking, payment: takeSingleRow(data, error) as PaymentRow };
}

export type RazorpayCheckoutSession = {
  keyId: string;
  orderId: string;
  amountPaise: number;
  currency: string;
  paymentId: string;
  bookingId: string | null;
  subscriptionId: string | null;
};

type CreateOrderFnResponse = {
  ok?: boolean;
  error?: string;
  key_id?: string;
  order_id?: string;
  amount?: number;
  currency?: string;
  payment_id?: string;
  booking_id?: string | null;
  subscription_id?: string | null;
};

/** Prefer Edge Function JSON `error` over the generic non-2xx supabase-js message. */
async function messageFromFunctionsInvokeError(error: unknown): Promise<string> {
  const fallback =
    error && typeof error === "object" && typeof (error as { message?: unknown }).message === "string"
      ? (error as { message: string }).message
      : "Could not start Razorpay checkout.";
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
    return "Checkout could not start. Deploy create-razorpay-order on UAT and set RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET secrets.";
  }
  return fallback;
}

async function invokeCreateRazorpayOrder(
  client: SupabaseClient<Database>,
  body: {
    purpose: "one_time" | "amc" | "postpaid_collect";
    amount_paise: number;
    booking_id?: string;
    subscription_id?: string;
  },
): Promise<RazorpayCheckoutSession & { paymentLinkUrl?: string | null }> {
  const { data, error } = await client.functions.invoke<
    CreateOrderFnResponse & { payment_link_url?: string | null }
  >("create-razorpay-order", {
    body,
  });
  if (error) throw new SupabaseApiError(await messageFromFunctionsInvokeError(error), error);
  if (!data?.ok || !data.order_id || !data.payment_id || !data.key_id) {
    throw new SupabaseApiError(data?.error ?? "Could not start Razorpay checkout.");
  }
  return {
    keyId: data.key_id,
    orderId: data.order_id,
    amountPaise: data.amount ?? body.amount_paise,
    currency: data.currency ?? "INR",
    paymentId: data.payment_id,
    bookingId: data.booking_id ?? body.booking_id ?? null,
    subscriptionId: data.subscription_id ?? body.subscription_id ?? null,
    paymentLinkUrl: data.payment_link_url ?? null,
  };
}

/**
 * One-time Razorpay: create `pending_payment` booking, then Razorpay order + pending payment via Edge Function.
 */
export async function createRazorpayOneTimeCheckoutSession(
  client: SupabaseClient<Database>,
  params: { bookingInput: CreateBookingInput; amountPaise: number },
): Promise<{ booking: BookingRow; session: RazorpayCheckoutSession }> {
  const amount = Math.max(0, Math.round(params.amountPaise));
  const booking = await createBookingAsCustomer(client, {
    ...params.bookingInput,
    status: "pending_payment",
  });
  const session = await invokeCreateRazorpayOrder(client, {
    purpose: "one_time",
    amount_paise: amount,
    booking_id: booking.id,
  });
  return { booking, session };
}

/**
 * After webhook confirms payment: run booking notification side-effects (idempotent via metadata flag).
 */
export async function finalizeRazorpayOneTimeAfterCapture(
  client: SupabaseClient<Database>,
  paymentId: string,
): Promise<{ booking: BookingRow; payment: PaymentRow }> {
  const payment = await getPaymentById(client, paymentId);
  if (!payment || payment.provider !== "razorpay") {
    throw new SupabaseApiError("Razorpay payment not found.");
  }
  if (payment.status !== "success") {
    throw new SupabaseApiError("Payment is not successful yet.");
  }
  if (!payment.booking_id) {
    throw new SupabaseApiError("Payment is not linked to a booking.");
  }

  const { data: booking, error } = await client
    .from("bookings")
    .select("*")
    .eq("id", payment.booking_id)
    .single();
  if (error || !booking) throw new SupabaseApiError(error?.message ?? "Booking not found.", error ?? undefined);

  // Postpaid collect: booking was already confirmed; do not re-fire confirm notifications.
  if ((booking as BookingRow).payment_timing === "postpaid" && booking.status !== "pending_payment") {
    return { booking: booking as BookingRow, payment };
  }

  const meta =
    booking.metadata && typeof booking.metadata === "object" && !Array.isArray(booking.metadata)
      ? ({ ...(booking.metadata as Record<string, unknown>) } as Record<string, unknown>)
      : {};
  const rz = meta.razorpay && typeof meta.razorpay === "object" && !Array.isArray(meta.razorpay)
    ? ({ ...(meta.razorpay as Record<string, unknown>) } as Record<string, unknown>)
    : {};

  if (rz.confirm_notifications_at) {
    return { booking: booking as BookingRow, payment };
  }

  const { postBookingConfirmedNotifications } = await import("../bookings/booking-confirm-notifications");
  const notified = await postBookingConfirmedNotifications(client, booking as BookingRow);

  const nextMeta = {
    ...meta,
    razorpay: { ...rz, confirm_notifications_at: new Date().toISOString() },
  };
  const { data: patched, error: patchErr } = await client
    .from("bookings")
    .update({ metadata: nextMeta })
    .eq("id", notified.id)
    .select()
    .single();
  if (patchErr) throw new SupabaseApiError(patchErr.message, patchErr);

  return { booking: takeSingleRow(patched, null) as BookingRow, payment };
}

/** Pending payment for AMC subscription (wallet funding). Dummy path. */
export async function createPendingAmcPayment(
  client: SupabaseClient<Database>,
  params: { customerId: string; subscriptionId: string; amountPaise: number },
): Promise<PaymentRow> {
  const sessionCustomerId = await getCustomerIdForSession(client);
  if (params.customerId !== sessionCustomerId) {
    throw new SupabaseApiError("Customer mismatch.");
  }
  const amount = Math.max(0, Math.round(params.amountPaise));
  const { data, error } = await client
    .from("payments")
    .insert({
      customer_id: params.customerId,
      subscription_id: params.subscriptionId,
      amount,
      status: "pending",
      provider: "dummy",
    })
    .select()
    .single();
  return takeSingleRow(data, error) as PaymentRow;
}

/** Razorpay AMC: Edge Function creates order + pending payment for a trialing subscription. */
export async function createRazorpayAmcCheckoutSession(
  client: SupabaseClient<Database>,
  params: { subscriptionId: string; amountPaise: number },
): Promise<RazorpayCheckoutSession> {
  const amount = Math.max(0, Math.round(params.amountPaise));
  return invokeCreateRazorpayOrder(client, {
    purpose: "amc",
    amount_paise: amount,
    subscription_id: params.subscriptionId,
  });
}

/**
 * After AMC Razorpay capture: emit admin awaiting-partner notification (wallet already funded by webhook).
 */
export async function finalizeRazorpayAmcAfterCapture(
  client: SupabaseClient<Database>,
  paymentId: string,
): Promise<{ subscription: SubscriptionRow; payment: PaymentRow }> {
  const payment = await getPaymentById(client, paymentId);
  if (!payment || payment.provider !== "razorpay" || payment.status !== "success") {
    throw new SupabaseApiError("Razorpay AMC payment not successful yet.");
  }
  if (!payment.subscription_id) {
    throw new SupabaseApiError("Payment is not linked to an AMC subscription.");
  }

  const { data: subscription, error } = await client
    .from("subscriptions")
    .select("*")
    .eq("id", payment.subscription_id)
    .single();
  if (error) throw new SupabaseApiError(error.message, error);
  const subRow = subscription as SubscriptionRow;
  try {
    await emitAdminAmcAwaitingPartnerNotification(client, subRow);
  } catch {
    /* best-effort */
  }
  return { subscription: subRow, payment };
}

/** Simulated AMC checkout success: records payment with OorjaMan and activates the AMC contract. */
export async function completeAmcSubscriptionPayment(
  client: SupabaseClient<Database>,
  paymentId: string,
  options?: { paymentMethod?: string },
): Promise<{ subscription: SubscriptionRow; payment: PaymentRow; walletFunded: boolean }> {
  const payment = await assertPendingPaymentOwned(client, paymentId);
  if (payment.provider !== "dummy") {
    throw new SupabaseApiError("Use Razorpay checkout for this payment.");
  }
  if (!payment.subscription_id) {
    throw new SupabaseApiError("Payment is not linked to an AMC subscription.");
  }

  const { data: subSnap, error: subErr } = await client
    .from("subscriptions")
    .select("*")
    .eq("id", payment.subscription_id)
    .maybeSingle();
  if (subErr) throw new SupabaseApiError(subErr.message, subErr);
  if (!subSnap || subSnap.status !== "trialing") {
    throw new SupabaseApiError("Subscription is not awaiting AMC payment.");
  }

  const paidAt = new Date().toISOString();
  const method = options?.paymentMethod?.trim() || "UPI";

  const { data: payUpdated, error: payErr } = await client
    .from("payments")
    .update({ status: "success", paid_at: paidAt, payment_method: method })
    .eq("id", paymentId)
    .eq("status", "pending")
    .eq("provider", "dummy")
    .select()
    .single();

  if (payErr) throw new SupabaseApiError(payErr.message, payErr);
  if (!payUpdated) {
    throw new SupabaseApiError("Could not confirm payment.");
  }

  try {
    await fundAmcWalletFromPayment(client, {
      subscriptionId: payment.subscription_id,
      paymentId: payUpdated.id,
      amountPaise: payUpdated.amount,
    });
  } catch (e) {
    await client
      .from("payments")
      .update({ status: "pending", paid_at: null, payment_method: null })
      .eq("id", paymentId)
      .eq("status", "success");
    throw e;
  }

  const { data: subscription, error: subFetchErr } = await client
    .from("subscriptions")
    .select("*")
    .eq("id", payment.subscription_id)
    .single();
  if (subFetchErr) throw new SupabaseApiError(subFetchErr.message, subFetchErr);

  const subRow = subscription as SubscriptionRow;
  try {
    await emitAdminAmcAwaitingPartnerNotification(client, subRow);
  } catch {
    /* payment succeeded; admin alert is best-effort */
  }

  return { subscription: subRow, payment: payUpdated as PaymentRow, walletFunded: true };
}

/** Postpaid one-time: confirm booking immediately (vendor timer starts); collect after job completed. */
export async function createPostpaidOneTimeBooking(
  client: SupabaseClient<Database>,
  params: { bookingInput: CreateBookingInput },
): Promise<BookingRow> {
  return createBookingAsCustomer(client, {
    ...params.bookingInput,
    payment_timing: "postpaid",
    status: "confirmed",
  });
}

export type PostpaidCollectSession = RazorpayCheckoutSession & {
  paymentLinkUrl: string | null;
};

/** After job completed: create Razorpay order (+ optional payment link) for outstanding postpaid balance. */
export async function createPostpaidCollectSession(
  client: SupabaseClient<Database>,
  params: { bookingId: string; amountPaise?: number },
): Promise<PostpaidCollectSession> {
  const { data: booking, error } = await client
    .from("bookings")
    .select("*")
    .eq("id", params.bookingId)
    .single();
  if (error || !booking) throw new SupabaseApiError(error?.message ?? "Booking not found.", error ?? undefined);
  const b = booking as BookingRow;
  if (b.payment_timing !== "postpaid") {
    throw new SupabaseApiError("This booking is not postpaid.");
  }
  if (b.status !== "completed") {
    throw new SupabaseApiError("Payment opens after the technician completes the visit.");
  }

  const paid = await listPaymentsForBooking(client, b.id);
  if (paid.some((p) => p.status === "success")) {
    throw new SupabaseApiError("This booking is already paid.");
  }

  const amount =
    params.amountPaise != null
      ? Math.max(0, Math.round(params.amountPaise))
      : Math.max(0, b.final_price_cents ?? b.estimated_price_cents ?? 0);
  if (amount < 100) throw new SupabaseApiError("Invalid amount for collection.");

  const session = await invokeCreateRazorpayOrder(client, {
    purpose: "postpaid_collect",
    amount_paise: amount,
    booking_id: b.id,
  });
  return {
    ...session,
    paymentLinkUrl: session.paymentLinkUrl ?? null,
  };
}

/** Technician/vendor/admin: customer paid partner (cash / personal UPI). Settles as fee receivable. */
export async function markPartnerCollectedPayment(
  client: SupabaseClient<Database>,
  params: { bookingId: string; amountPaise?: number; method?: string; note?: string },
): Promise<{ ok: boolean; paymentId?: string; settlementId?: string; already?: boolean }> {
  const { data, error } = await client.rpc("mark_partner_collected_payment", {
    p_booking_id: params.bookingId,
    p_amount_paise: params.amountPaise ?? null,
    p_method: params.method ?? "Partner collected",
    p_note: params.note ?? null,
  });
  if (error) throw new SupabaseApiError(error.message, error);
  const row = data as {
    ok?: boolean;
    payment_id?: string;
    settlement_id?: string;
    already?: boolean;
  } | null;
  return {
    ok: Boolean(row?.ok),
    paymentId: row?.payment_id,
    settlementId: row?.settlement_id,
    already: Boolean(row?.already),
  };
}

export async function bookingHasSuccessfulPayment(
  client: SupabaseClient<Database>,
  bookingId: string,
): Promise<boolean> {
  const rows = await listPaymentsForBooking(client, bookingId);
  return rows.some((p) => p.status === "success");
}
