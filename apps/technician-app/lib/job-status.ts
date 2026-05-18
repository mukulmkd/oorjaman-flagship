import type { BookingStatus } from "@oorjaman/api";

export type JobUiBucket = "upcoming" | "active" | "done" | "ended";

export function jobUiBucket(status: BookingStatus): JobUiBucket {
  switch (status) {
    case "pending_payment":
    case "confirmed":
    case "accepted":
      return "upcoming";
    case "in_progress":
      return "active";
    case "completed":
      return "done";
    case "cancelled":
      return "ended";
    default:
      return "upcoming";
  }
}

/** Technician-facing job status labels. */
export function jobStatusLabel(status: BookingStatus): string {
  switch (status) {
    case "pending_payment":
      return "Awaiting payment";
    case "confirmed":
      return "Awaiting vendor action";
    case "accepted":
      return "Assigned";
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
