import type { BookingRow, BookingStatus } from "@oorjaman/api";

export type BookingUiBucket = "pending" | "accepted" | "completed" | "ended";

export type BookingStatusLabelContext = Pick<
  BookingRow,
  "status" | "vendor_id" | "technician_id" | "technician_en_route_at"
>;

export function isValidBookingRow(row: BookingRow | null | undefined): row is BookingRow {
  return Boolean(row?.id && row?.status);
}

/**
 * Maps DB statuses to customer-facing buckets.
 */
export function bookingUiBucket(status: BookingStatus): BookingUiBucket {
  switch (status) {
    case "pending_payment":
    case "confirmed":
    case "vendor_acknowledged":
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
export function bookingStatusLabel(
  status: BookingStatus,
  row?: BookingStatusLabelContext | null,
): string {
  switch (status) {
    case "pending_payment":
      return "Awaiting payment";
    case "confirmed":
      if (row?.technician_id) return "Technician assigned";
      if (row?.vendor_id) return "Partner confirming";
      return "Awaiting partner";
    case "vendor_acknowledged":
      return "Partner acknowledged";
    case "accepted":
      if (row?.technician_en_route_at) return "Technician on the way";
      if (row?.technician_id) return "Technician assigned";
      return "Accepted";
    case "in_progress":
      return "Visit in progress";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}
