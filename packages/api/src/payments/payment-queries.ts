import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, PaymentRow } from "../database.types";
import { takeRows } from "../result";

/** Shared payment reads used by payment-api and refund-api (avoids require cycles). */
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
