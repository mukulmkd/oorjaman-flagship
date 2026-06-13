import type { SupabaseClient } from "@supabase/supabase-js";
import type { BookingRow, Database, SubscriptionRow } from "../database.types";
import { SupabaseApiError } from "../result";

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

/**
 * Evenly spaces AMC visits across the subscription contract window (from `starts_at`).
 * Does not modify existing one-time bookings - those stay separate (forward-only AMC policy).
 */
export function computeAmcVisitSlots(
  sub: SubscriptionRow,
): Array<{ scheduled_start: string; scheduled_end: string }> {
  const visits = sub.visits_included ?? 0;
  if (visits <= 0) return [];

  const startsAt = new Date(sub.starts_at);
  const endsAt = new Date(sub.ends_at);
  const out: Array<{ scheduled_start: string; scheduled_end: string }> = [];

  const totalMs = endsAt.getTime() - startsAt.getTime();
  const stepMs = Math.max(totalMs / Math.max(visits, 1), 24 * 60 * 60 * 1000);

  for (let i = 0; i < visits; i++) {
    const vStart = new Date(startsAt.getTime() + stepMs * i);
    if (vStart >= endsAt) break;

    let vEnd = new Date(vStart.getTime() + TWO_HOURS_MS);
    if (vEnd > endsAt) vEnd = endsAt;
    if (vEnd <= vStart) break;

    out.push({
      scheduled_start: vStart.toISOString(),
      scheduled_end: vEnd.toISOString(),
    });
  }

  return out;
}

/**
 * @deprecated Removed - AMC bookings are created only via {@link scheduleAmcVisitSlot}.
 */
export async function syncAmcBookingsForSubscription(
  _client: SupabaseClient<Database>,
  _subscription: SubscriptionRow,
): Promise<BookingRow[]> {
  throw new SupabaseApiError(
    "Auto-generating AMC bookings is disabled. Customers schedule each visit from their AMC plan.",
  );
}
