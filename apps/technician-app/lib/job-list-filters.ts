import type { BookingRow, BookingStatus } from "@oorjaman/api";
import { formatJobDayKey, todayIstDayKey } from "./booking-display";

export type JobListSegment = "today" | "upcoming" | "active" | "completed";

export const JOB_LIST_SEGMENTS: { id: JobListSegment; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "upcoming", label: "Upcoming" },
  { id: "active", label: "Active" },
  { id: "completed", label: "Done" },
];

const OPEN_STATUSES: BookingStatus[] = ["confirmed", "accepted", "in_progress"];

function isOpenStatus(status: BookingStatus): boolean {
  return OPEN_STATUSES.includes(status);
}

/** Open visits scheduled before today (still assigned, not completed). */
function isOverdueOpenJob(row: BookingRow, today: string): boolean {
  const day = formatJobDayKey(row.scheduled_start);
  return day < today && isOpenStatus(row.status) && row.status !== "confirmed";
}

export function filterBookingsBySegment(rows: BookingRow[], segment: JobListSegment): BookingRow[] {
  const today = todayIstDayKey();

  return rows.filter((b) => {
    const day = formatJobDayKey(b.scheduled_start);

    switch (segment) {
      case "completed":
        return b.status === "completed";
      case "active":
        return b.status === "in_progress";
      case "today":
        return (
          isOpenStatus(b.status) &&
          (day === today || isOverdueOpenJob(b, today))
        );
      case "upcoming":
        return (
          isOpenStatus(b.status) &&
          b.status !== "in_progress" &&
          day > today
        );
      default:
        return true;
    }
  });
}

export function sortBookingsForSegment(rows: BookingRow[], segment: JobListSegment): BookingRow[] {
  const dir = segment === "completed" ? -1 : 1;
  return [...rows].sort((a, b) => {
    const ta = new Date(a.scheduled_start).getTime();
    const tb = new Date(b.scheduled_start).getTime();
    return (ta - tb) * dir;
  });
}

/** Next visit for Home: soonest open job from today onward (assigned / in progress). */
export function pickNextJob(rows: BookingRow[]): BookingRow | null {
  const now = Date.now();
  const candidates = rows
    .filter((b) => b.status === "accepted" || b.status === "in_progress")
    .sort((a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime());

  const inProgress = candidates.find((b) => b.status === "in_progress");
  if (inProgress) return inProgress;

  return (
    candidates.find((b) => new Date(b.scheduled_start).getTime() >= now - 60 * 60 * 1000) ??
    candidates[0] ??
    null
  );
}

export function completedBookings(rows: BookingRow[]): BookingRow[] {
  return sortBookingsForSegment(
    rows.filter((b) => b.status === "completed"),
    "completed",
  );
}

/** First Jobs tab segment that has at least one row (Today → Active → Upcoming → Done). */
export function pickDefaultJobListSegment(rows: BookingRow[]): JobListSegment {
  const order: JobListSegment[] = ["today", "active", "upcoming", "completed"];
  return order.find((seg) => filterBookingsBySegment(rows, seg).length > 0) ?? "today";
}
