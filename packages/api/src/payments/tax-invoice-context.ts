import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BookingRow,
  CustomerRow,
  Database,
  PaymentRow,
  UserRow,
} from "../database.types";
import { SupabaseApiError } from "../result";

export type AdminTaxInvoiceContext = {
  booking: BookingRow;
  customer: CustomerRow | null;
  user: UserRow | null;
  payment: PaymentRow;
};

/**
 * Admin: load booking + customer + payment needed to view/download a tax invoice.
 * Prefers the given payment; otherwise the latest successful payment on the booking.
 */
export async function adminGetTaxInvoiceContext(
  client: SupabaseClient<Database>,
  params: { paymentId?: string; bookingId?: string },
): Promise<AdminTaxInvoiceContext> {
  let payment: PaymentRow | null = null;
  let bookingId = params.bookingId?.trim() || "";

  if (params.paymentId?.trim()) {
    const { data, error } = await client
      .from("payments")
      .select("*")
      .eq("id", params.paymentId.trim())
      .maybeSingle();
    if (error) throw new SupabaseApiError(error.message, error);
    payment = data;
    if (!payment) throw new SupabaseApiError("Payment not found");
    if (!payment.booking_id) {
      throw new SupabaseApiError(
        "This payment is not linked to a booking visit invoice (for example AMC contract prepay).",
      );
    }
    bookingId = payment.booking_id;
  }

  if (!bookingId) throw new SupabaseApiError("bookingId or paymentId is required");

  const { data: booking, error: bookingErr } = await client
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .maybeSingle();
  if (bookingErr) throw new SupabaseApiError(bookingErr.message, bookingErr);
  if (!booking) throw new SupabaseApiError("Booking not found");

  if (!payment) {
    const { data: pays, error: payErr } = await client
      .from("payments")
      .select("*")
      .eq("booking_id", bookingId)
      .in("status", ["success", "partially_refunded", "refunded"])
      .order("paid_at", { ascending: false })
      .limit(1);
    if (payErr) throw new SupabaseApiError(payErr.message, payErr);
    payment = pays?.[0] ?? null;
    if (!payment) {
      throw new SupabaseApiError("No successful payment found for this booking");
    }
  }

  const { data: customer, error: custErr } = await client
    .from("customers")
    .select("*")
    .eq("id", booking.customer_id)
    .maybeSingle();
  if (custErr) throw new SupabaseApiError(custErr.message, custErr);

  let user: UserRow | null = null;
  if (customer?.user_id) {
    const { data: userRow, error: userErr } = await client
      .from("users")
      .select("*")
      .eq("id", customer.user_id)
      .maybeSingle();
    if (userErr) throw new SupabaseApiError(userErr.message, userErr);
    user = userRow;
  }

  return {
    booking,
    customer,
    user,
    payment,
  };
}
