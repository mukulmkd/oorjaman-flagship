import type { SupabaseClient } from "@supabase/supabase-js";
import type { BookingRow, Database, Json, VendorRow } from "../database.types";
import { SupabaseApiError } from "../result";
import * as vendorApi from "../vendors/vendor-api";
import {
  customerLocationSignalsFromServiceSiteAddress,
  splitVendorsByServiceArea,
} from "../vendors/vendor-service-area";

export type MarketplaceNotificationChannel = "in_app" | "email" | "sms" | "whatsapp";
export type MarketplaceNotificationEventType = "marketplace_broadcast" | "marketplace_claim_won";

type EmitMarketplaceNotificationInput = {
  booking: BookingRow;
  eventType: MarketplaceNotificationEventType;
  channels: MarketplaceNotificationChannel[];
  recipientVendorId?: string | null;
  note?: string | null;
};

function readBookingSlot(metadata: Json): { dayKey: string; slotId: string } | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const slot = (metadata as Record<string, unknown>).schedule_slot;
  if (!slot || typeof slot !== "object" || Array.isArray(slot)) return null;
  const slotObj = slot as Record<string, unknown>;
  const dayKey = typeof slotObj.day_key === "string" ? slotObj.day_key.trim() : "";
  const slotId = typeof slotObj.slot_id === "string" ? slotObj.slot_id.trim() : "";
  return dayKey && slotId ? { dayKey, slotId } : null;
}

export function readMarketplaceBroadcastFilter(booking: Pick<BookingRow, "metadata">): "customer_pin" | "all" {
  const m =
    booking.metadata && typeof booking.metadata === "object" && !Array.isArray(booking.metadata)
      ? (booking.metadata as Record<string, unknown>)
      : null;
  const marketplace =
    m?.marketplace && typeof m.marketplace === "object" && !Array.isArray(m.marketplace)
      ? (m.marketplace as Record<string, unknown>)
      : null;
  const raw = marketplace?.broadcast_filter;
  return raw === "all" ? "all" : "customer_pin";
}

async function listBroadcastTargets(
  client: SupabaseClient<Database>,
  booking: BookingRow,
): Promise<VendorRow[]> {
  const approved = await vendorApi.listApprovedVendors(client);
  const slot = readBookingSlot(booking.metadata);
  let candidates: VendorRow[];
  if (!slot) {
    candidates = approved;
  } else {
    const checks = await Promise.all(
      approved.map(async (v) => ({
        vendor: v,
        ok: await vendorApi.isVendorAvailableForSlot(client, {
          vendorId: v.id,
          dayKey: slot.dayKey,
          slotId: slot.slotId,
          excludeBookingId: booking.id,
        }),
      })),
    );
    candidates = checks.filter((r) => r.ok).map((r) => r.vendor);
  }

  const filter = readMarketplaceBroadcastFilter(booking);
  if (filter !== "customer_pin") return candidates;

  const signals = customerLocationSignalsFromServiceSiteAddress(booking.service_site_address);
  const hasSignals =
    Boolean(signals.pincode?.trim()) || Boolean(signals.city?.trim()) || Boolean(signals.state?.trim());
  if (!hasSignals) return candidates;

  const { inArea } = splitVendorsByServiceArea(candidates, signals);
  return inArea.length > 0 ? inArea : candidates;
}

export async function emitMarketplaceNotificationEvents(
  client: SupabaseClient<Database>,
  input: EmitMarketplaceNotificationInput,
): Promise<number> {
  const nowIso = new Date().toISOString();
  const recipients =
    input.eventType === "marketplace_broadcast"
      ? await listBroadcastTargets(client, input.booking)
      : input.recipientVendorId
        ? [{ id: input.recipientVendorId } as VendorRow]
        : [];
  if (recipients.length === 0) return 0;

  const rows: Database["public"]["Tables"]["notification_events"]["Insert"][] = recipients.map((vendor) => ({
    booking_id: input.booking.id,
    recipient_audience: "vendor",
    recipient_vendor_id: vendor.id,
    event_type: input.eventType,
    channels: input.channels as unknown as Json,
    status: "queued",
    payload: {
      reference_code: input.booking.reference_code,
      booking_id: input.booking.id,
      note: input.note ?? null,
      emitted_at: nowIso,
    } as Json,
  }));

  const { error } = await client.from("notification_events").insert(rows);
  if (error) {
    throw new SupabaseApiError(error.message, error);
  }
  return recipients.length;
}
