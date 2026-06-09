import type { SupabaseClient } from "@supabase/supabase-js";
import type { BookingRow, Database, Json, VendorDeferredPenaltyRow } from "../database.types";
import { SupabaseApiError, takeRows, takeSingleRow } from "../result";

export async function queueVendorDeferredPenalty(
  client: SupabaseClient<Database>,
  input: {
    vendor_id: string;
    source_booking_id: string;
    penalty_paise: number;
    metadata?: Json;
  },
): Promise<VendorDeferredPenaltyRow> {
  const penaltyPaise = Math.max(0, Math.round(input.penalty_paise));
  if (penaltyPaise <= 0) {
    throw new SupabaseApiError("Penalty amount must be positive.");
  }

  const { data, error } = await client.rpc("queue_vendor_deferred_penalty", {
    p_vendor_id: input.vendor_id,
    p_source_booking_id: input.source_booking_id,
    p_penalty_paise: penaltyPaise,
    p_metadata: input.metadata ?? {},
  });
  if (error) throw new SupabaseApiError(error.message, error);
  return data as VendorDeferredPenaltyRow;
}

export async function listPendingVendorDeferredPenalties(
  client: SupabaseClient<Database>,
  vendorId: string,
): Promise<VendorDeferredPenaltyRow[]> {
  const { data, error } = await client
    .from("vendor_deferred_penalties")
    .select("*")
    .eq("vendor_id", vendorId)
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  return takeRows(data, error);
}

/**
 * When a vendor accepts their next booking, apply the oldest pending deferred penalty
 * as a cancellation_penalty settlement on that booking.
 */
export async function applyNextVendorDeferredPenaltyOnBooking(
  client: SupabaseClient<Database>,
  booking: Pick<BookingRow, "id" | "vendor_id" | "reference_code" | "currency" | "metadata">,
): Promise<VendorDeferredPenaltyRow | null> {
  if (!booking.vendor_id) return null;

  const pending = await listPendingVendorDeferredPenalties(client, booking.vendor_id);
  const next = pending[0];
  if (!next) return null;

  const { ensureCancellationPenaltySettlement } = await import("./vendor-settlement-api");
  const settlement = await ensureCancellationPenaltySettlement(
    client,
    {
      ...booking,
      metadata: {
        ...(booking.metadata &&
        typeof booking.metadata === "object" &&
        !Array.isArray(booking.metadata)
          ? (booking.metadata as Record<string, unknown>)
          : {}),
        vendor_cancellation_penalty: {
          tier: "deferred",
          penalty_paise: next.penalty_paise,
          reason: "deferred_from_prior_last_hour_cancel",
          assessed_at: new Date().toISOString(),
          deferred_source_booking_id: next.source_booking_id,
        },
      } as Json,
    },
    booking.vendor_id,
  );

  const nowIso = new Date().toISOString();
  const { data: updated, error } = await client
    .from("vendor_deferred_penalties")
    .update({
      status: "applied",
      applied_booking_id: booking.id,
      vendor_settlement_id: settlement?.id ?? null,
      applied_at: nowIso,
      metadata: {
        ...(next.metadata &&
        typeof next.metadata === "object" &&
        !Array.isArray(next.metadata)
          ? (next.metadata as Record<string, unknown>)
          : {}),
        applied_reference_code: booking.reference_code,
      },
    })
    .eq("id", next.id)
    .eq("status", "pending")
    .select("*")
    .single();
  if (error) throw new SupabaseApiError(error.message, error);
  return takeSingleRow(updated, error);
}
