import type {
  BookingStatus,
  Json,
  SubscriptionVisitSlotRow,
} from "../database.types";

const DISPLAY_LOCALE = "en-IN";
const DEFAULT_NUDGE_LOOKAHEAD_DAYS = 30;

/** Customer-facing title for an included AMC visit slot. */
export function formatAmcIncludedVisitTitle(
  sequence: number,
  totalVisits: number,
): string {
  const seq = Math.max(1, Math.floor(sequence));
  const total = Math.max(1, Math.floor(totalVisits));
  return `Included visit ${seq} of ${total}`;
}

function formatSuggestedMonthYear(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat(DISPLAY_LOCALE, {
    month: "short",
    year: "numeric",
  }).format(d);
}

/** Optional quarter hint for evenly spaced 3-visit annual plans. */
export function formatAmcQuarterLabel(
  sequence: number,
  totalVisits: number,
): string | null {
  if (totalVisits !== 3) return null;
  const seq = Math.floor(sequence);
  if (seq === 1) return "Early year";
  if (seq === 2) return "Mid year";
  if (seq === 3) return "Late year";
  return null;
}

/** Gentle timing hint from the contract ideal window - not a fixed appointment. */
export function formatAmcSuggestedVisitWindow(
  idealScheduledStart: string,
  options?: { sequence?: number; totalVisits?: number },
): string {
  const monthYear = formatSuggestedMonthYear(idealScheduledStart);
  const quarter =
    options?.sequence != null && options?.totalVisits != null
      ? formatAmcQuarterLabel(options.sequence, options.totalVisits)
      : null;

  if (!monthYear) return "Suggested window on your contract";
  if (quarter) return `${quarter} · suggested around ${monthYear}`;
  return `Suggested around ${monthYear}`;
}

export type AmcVisitAllowanceSummary = {
  total: number;
  scheduledOrBooked: number;
  completed: number;
  pending: number;
  readyToBook: number;
  allUsed: boolean;
  headline: string;
  progressFilled: number;
};

export function summarizeAmcVisitAllowances(
  slots: SubscriptionVisitSlotRow[],
  options?: { canSchedule?: boolean },
): AmcVisitAllowanceSummary {
  const total = slots.length;
  const scheduledOrBooked = slots.filter(
    (s) => s.status === "scheduled" || s.status === "completed",
  ).length;
  const completed = slots.filter((s) => s.status === "completed").length;
  const pending = slots.filter((s) => s.status === "pending").length;
  const canSchedule = options?.canSchedule ?? true;
  const readyToBook = canSchedule ? pending : 0;
  const allUsed = total > 0 && completed === total;

  let headline: string;
  if (allUsed) {
    headline = `All ${total} included visits used`;
  } else if (!canSchedule && pending > 0) {
    headline = `${scheduledOrBooked} of ${total} visits scheduled · Waiting for your AMC partner`;
  } else if (readyToBook > 0) {
    headline = `${scheduledOrBooked} of ${total} visits scheduled · ${readyToBook} ready to book`;
  } else {
    headline = `${scheduledOrBooked} of ${total} visits scheduled`;
  }

  return {
    total,
    scheduledOrBooked,
    completed,
    pending,
    readyToBook,
    allUsed,
    headline,
    progressFilled: scheduledOrBooked,
  };
}

export function isAmcSuggestedVisitWindowApproaching(
  idealScheduledStart: string,
  options?: { now?: Date; lookaheadDays?: number },
): boolean {
  const now = options?.now ?? new Date();
  const lookaheadDays = options?.lookaheadDays ?? DEFAULT_NUDGE_LOOKAHEAD_DAYS;
  const ideal = new Date(idealScheduledStart);
  if (Number.isNaN(ideal.getTime())) return false;

  const lookaheadMs = lookaheadDays * 24 * 60 * 60 * 1000;
  return now.getTime() >= ideal.getTime() - lookaheadMs;
}

export type AmcVisitScheduleNudge = {
  slot: SubscriptionVisitSlotRow;
  message: string;
};

export function resolveAmcVisitScheduleNudge(
  slots: SubscriptionVisitSlotRow[],
  options?: { canSchedule?: boolean; now?: Date; totalVisits?: number },
): AmcVisitScheduleNudge | null {
  if (options?.canSchedule === false) return null;

  const total = options?.totalVisits ?? slots.length;
  const pending = [...slots]
    .filter((s) => s.status === "pending")
    .sort((a, b) => a.sequence - b.sequence);

  for (const slot of pending) {
    if (
      isAmcSuggestedVisitWindowApproaching(slot.ideal_scheduled_start, {
        now: options?.now,
      })
    ) {
      const title = formatAmcIncludedVisitTitle(slot.sequence, total);
      return {
        slot,
        message: `Good time to schedule ${title.toLowerCase()}`,
      };
    }
  }
  return null;
}

export function partitionAmcVisitSlotsForDisplay(slots: SubscriptionVisitSlotRow[]): {
  active: SubscriptionVisitSlotRow[];
  past: SubscriptionVisitSlotRow[];
} {
  const pastStatuses = new Set<SubscriptionVisitSlotRow["status"]>([
    "completed",
    "cancelled",
  ]);
  const past = slots
    .filter((s) => pastStatuses.has(s.status))
    .sort((a, b) => b.sequence - a.sequence);
  const active = slots
    .filter((s) => !pastStatuses.has(s.status))
    .sort((a, b) => a.sequence - b.sequence);
  return { active, past };
}

/** e.g. `1st visit`, `2nd visit`, `4th visit` */
export function formatAmcVisitLabel(sequence: number): string {
  const n = Math.max(1, Math.floor(sequence));
  const mod100 = n % 100;
  const suffix =
    mod100 >= 11 && mod100 <= 13
      ? "th"
      : n % 10 === 1
        ? "st"
        : n % 10 === 2
          ? "nd"
          : n % 10 === 3
            ? "rd"
            : "th";
  return `${n}${suffix} visit`;
}

export function readAmcVisitSequenceFromMetadata(
  metadata: Json | unknown,
): number | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata))
    return null;
  const seq = (metadata as Record<string, unknown>).sequence;
  if (typeof seq === "number" && Number.isFinite(seq) && seq >= 1)
    return Math.floor(seq);
  if (typeof seq === "string" && /^[0-9]+$/.test(seq.trim())) {
    const n = parseInt(seq.trim(), 10);
    return n >= 1 ? n : null;
  }
  return null;
}

/** True when the customer scheduled this AMC visit through the app (not legacy auto-generation). */
export function isCustomerScheduledAmcMetadata(
  metadata: Json | unknown,
): boolean {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata))
    return false;
  const o = metadata as Record<string, unknown>;
  if (o.customer_scheduled_amc === true) return true;
  const slot = o.schedule_slot;
  return slot != null && typeof slot === "object" && !Array.isArray(slot);
}

/** Legacy rows created on AMC subscribe before visit-slot scheduling existed. */
export function isLegacyAutoScheduledAmcBooking(booking: {
  subscription_id: string | null;
  metadata: Json;
  customer_notes?: string | null;
  status?: string;
}): boolean {
  if (!booking.subscription_id) return false;
  if (isCustomerScheduledAmcMetadata(booking.metadata)) return false;
  if (
    booking.status &&
    !["confirmed", "pending_payment"].includes(booking.status)
  ) {
    return false;
  }
  const notes = booking.customer_notes?.trim() ?? "";
  if (/auto-scheduled/i.test(notes)) return true;
  if (
    !booking.metadata ||
    typeof booking.metadata !== "object" ||
    Array.isArray(booking.metadata)
  ) {
    return false;
  }
  return (
    (booking.metadata as Record<string, unknown>).source === "subscription_amc"
  );
}

/** Slot is linked to a customer-created AMC booking (shows OM- reference, tappable). */
export function isAmcVisitSlotBookedByCustomer(slot: {
  booking_id: string | null;
  status: string;
}): boolean {
  return slot.booking_id != null && slot.status !== "pending";
}

/** AMC rows: `1st visit · OM-…` when customer-scheduled; ordinal only otherwise. */
export function customerBookingDisplayTitle(booking: {
  subscription_id: string | null;
  metadata: Json;
  reference_code: string;
}): string {
  if (booking.subscription_id) {
    const seq = readAmcVisitSequenceFromMetadata(booking.metadata);
    if (seq) {
      const label = formatAmcVisitLabel(seq);
      if (!isCustomerScheduledAmcMetadata(booking.metadata)) return label;
      const ref = booking.reference_code?.trim();
      return ref ? `${label} · ${ref}` : label;
    }
  }
  return booking.reference_code;
}

/** Modal subtitle for booking ref - omitted when {@link customerBookingDisplayTitle} already shows it. */
export function customerBookingRefModalSubtitle(booking: {
  reference_code: string;
  subscription_id: string | null;
  metadata: Json;
}): string | undefined {
  const ref = booking.reference_code?.trim();
  if (!ref) return undefined;
  const title = customerBookingDisplayTitle(booking);
  if (title === ref || title.includes(ref)) return undefined;
  return `Ref ${ref}`;
}

export function isAmcSubscriptionBooking(booking: {
  subscription_id: string | null;
}): boolean {
  return booking.subscription_id != null;
}

/** AMC visits: show job start only after partner acceptance and technician assignment. */
export function customerBookingVisitDateVisible(booking: {
  subscription_id: string | null;
  status: BookingStatus;
  technician_id: string | null;
}): boolean {
  if (!isAmcSubscriptionBooking(booking)) return true;
  if (!booking.technician_id) return false;
  return (
    booking.status === "accepted" ||
    booking.status === "in_progress" ||
    booking.status === "completed"
  );
}

/** Hide legacy auto-generated AMC rows from customer booking lists. */
export function shouldHideAmcBookingFromCustomerList(booking: {
  subscription_id: string | null;
  metadata: Json;
  customer_notes?: string | null;
  status?: string;
}): boolean {
  if (!booking.subscription_id) return false;
  if (isCustomerScheduledAmcMetadata(booking.metadata)) return false;
  return isLegacyAutoScheduledAmcBooking(booking);
}
