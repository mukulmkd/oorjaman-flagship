import type { BookingStatus, Json } from "../database.types";

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

export function readAmcVisitSequenceFromMetadata(metadata: Json | unknown): number | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const seq = (metadata as Record<string, unknown>).sequence;
  if (typeof seq === "number" && Number.isFinite(seq) && seq >= 1) return Math.floor(seq);
  if (typeof seq === "string" && /^[0-9]+$/.test(seq.trim())) {
    const n = parseInt(seq.trim(), 10);
    return n >= 1 ? n : null;
  }
  return null;
}

/** True when the customer scheduled this AMC visit through the app (not legacy auto-generation). */
export function isCustomerScheduledAmcMetadata(metadata: Json | unknown): boolean {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return false;
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
  if (booking.status && !["confirmed", "pending_payment"].includes(booking.status)) {
    return false;
  }
  const notes = booking.customer_notes?.trim() ?? "";
  if (/auto-scheduled/i.test(notes)) return true;
  if (!booking.metadata || typeof booking.metadata !== "object" || Array.isArray(booking.metadata)) {
    return false;
  }
  return (booking.metadata as Record<string, unknown>).source === "subscription_amc";
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

export function isAmcSubscriptionBooking(booking: { subscription_id: string | null }): boolean {
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
