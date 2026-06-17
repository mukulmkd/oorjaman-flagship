import type { SupabaseClient } from "@supabase/supabase-js";
import type { BookingRow, Database, PaymentRow, SubscriptionRow } from "../database.types";
import { createBookingAsCustomer, type CreateBookingInput } from "../bookings/booking-api";
import { fundAmcWalletFromPayment } from "../finance/amc-wallet-api";
import { emitAdminAmcAwaitingPartnerNotification } from "../notifications/amc-notifications";
import { customerAbandonUnpaidCheckoutBooking } from "../bookings/booking-api";
import { requireSessionUserId, SupabaseApiError, takeRows, takeSingleRow } from "../result";

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
  return data;
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
    })
    .select()
    .single();
  return takeSingleRow(data, error);
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
  return takeRows(data, error);
}

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
 * Customer left checkout: fail the dummy payment row and cancel the linked `pending_payment` booking.
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
 * Booking must not advance unless payment succeeds first.
 */
export async function completeDummyPaymentSuccess(
  client: SupabaseClient<Database>,
  paymentId: string,
  options?: { paymentMethod?: string },
): Promise<{ booking: BookingRow; payment: PaymentRow }> {
  const payment = await assertPendingPaymentOwned(client, paymentId);
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

  return { booking: notifiedBooking, payment: payUpdated };
}

/**
 * One-time visit: create the booking and successful payment together after checkout succeeds.
 * No `pending_payment` row is written — incomplete checkouts stay in the app only.
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
    })
    .select()
    .single();

  const paymentInserted = takeSingleRow(data, error);

  const { data: payUpdated, error: payUpdateErr } = await client
    .from("payments")
    .update({ paid_at: paidAt, payment_method: method })
    .eq("id", paymentInserted.id)
    .select()
    .single();

  return { booking, payment: takeSingleRow(payUpdated, payUpdateErr) };
}

/** Pending payment for AMC subscription (wallet funding). */
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
    })
    .select()
    .single();
  return takeSingleRow(data, error);
}

/** Simulated AMC checkout success: records payment with OorjaMan and activates the AMC contract. */
export async function completeAmcSubscriptionPayment(
  client: SupabaseClient<Database>,
  paymentId: string,
  options?: { paymentMethod?: string },
): Promise<{ subscription: SubscriptionRow; payment: PaymentRow; walletFunded: boolean }> {
  const payment = await assertPendingPaymentOwned(client, paymentId);
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

  return { subscription: subRow, payment: payUpdated, walletFunded: true };
}
