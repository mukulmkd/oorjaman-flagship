import type { BookingStatus } from "@oorjaman/api";

export type BookingUiBucket = "pending" | "accepted" | "completed" | "ended";

/**
 * Maps DB statuses to customer-facing buckets.
 */
export function bookingUiBucket(status: BookingStatus): BookingUiBucket {
  switch (status) {
    case "pending_payment":
    case "confirmed":
      return "pending";
    case "accepted":
    case "in_progress":
      return "accepted";
    case "completed":
      return "completed";
    case "cancelled":
      return "ended";
    default:
      return "pending";
  }
}

/** Display label - stable wording for chips and detail rows. */
export function bookingStatusLabel(status: BookingStatus): string {
  switch (status) {
    case "pending_payment":
      return "Awaiting payment";
    case "confirmed":
      return "Awaiting confirmation";
    case "accepted":
      return "Accepted";
    case "in_progress":
      return "In progress";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}
