import type { BookingRow } from "@oorjaman/api";

/** Prefix for React Query cache of completed-postpaid unpaid flags (Jobs Done list). */
export const TECHNICIAN_POSTPAID_UNPAID_QUERY_KEY = ["technician-postpaid-unpaid"] as const;

/** Completed postpaid visit that may still need Razorpay link or partner-collected. */
export function isPostpaidCompleted(
  booking: Pick<BookingRow, "status" | "payment_timing">,
): boolean {
  return booking.status === "completed" && booking.payment_timing === "postpaid";
}

export function bookingNeedsPostpaidCollect(
  booking: Pick<BookingRow, "status" | "payment_timing">,
  hasSuccessfulPayment: boolean,
): boolean {
  return isPostpaidCompleted(booking) && !hasSuccessfulPayment;
}
