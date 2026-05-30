import type { SupabaseClient } from "@supabase/supabase-js";
import type { BookingRow, Database, Json } from "../database.types";
import { mergeBookingMetadata, readBookingVendorRoutingMeta } from "./customer-booking-payload";
import { SupabaseApiError, takeSingleRow } from "../result";

const VENDOR_RESPONSE_MS = 60 * 60 * 1000;
import {
  adminBookingCreatedCopy,
  adminMarketplaceFloatedCopy,
  adminVendorResponseOverdueCopy,
  emitAdminBookingNotification,
  emitVendorBookingNotification,
  vendorCustomerPreferredBookingCopy,
  vendorBookingAssignedCopy,
} from "../notifications/booking-notifications";
import { emitMarketplaceNotificationEvents } from "../notifications/marketplace-notifications";

function resolveVendorResponseAnchorIso(booking: Pick<BookingRow, "created_at" | "metadata">): string | null {
  const m =
    booking.metadata && typeof booking.metadata === "object" && !Array.isArray(booking.metadata)
      ? (booking.metadata as Record<string, unknown>)
      : null;
  if (!m) return null;
  const vr = m.vendor_response;
  if (vr && typeof vr === "object" && !Array.isArray(vr)) {
    const anchor = (vr as Record<string, unknown>).anchor_at;
    if (typeof anchor === "string" && anchor.trim()) return anchor.trim();
  }
  const marketplace = m.marketplace;
  if (marketplace && typeof marketplace === "object" && !Array.isArray(marketplace)) {
    const mp = marketplace as Record<string, unknown>;
    if (mp.mode === "default_vendor" && mp.floated === true && typeof mp.open_at === "string" && mp.open_at.trim()) {
      return mp.open_at.trim();
    }
  }
  return null;
}

function isWithinVendorResponseWindow(
  booking: Pick<BookingRow, "created_at" | "metadata">,
  at: Date = new Date(),
): boolean {
  const anchorIso = resolveVendorResponseAnchorIso(booking);
  const anchorMs = anchorIso
    ? new Date(anchorIso).getTime()
    : new Date(booking.created_at).getTime();
  if (!Number.isFinite(anchorMs)) return false;
  return at.getTime() <= anchorMs + VENDOR_RESPONSE_MS;
}

async function persistBookingRow(
  client: SupabaseClient<Database>,
  bookingId: string,
  patch: { metadata: Json },
): Promise<BookingRow> {
  const { data, error } = await client.from("bookings").update(patch).eq("id", bookingId).select().single();
  return takeSingleRow(data, error);
}

function readMarketplaceMeta(metadata: Json | null | undefined): Record<string, unknown> | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const marketplace = (metadata as Record<string, unknown>).marketplace;
  if (!marketplace || typeof marketplace !== "object" || Array.isArray(marketplace)) return null;
  return marketplace as Record<string, unknown>;
}

export function isBookingAwaitingAdminFloat(metadata: Json | null | undefined): boolean {
  const mp = readMarketplaceMeta(metadata);
  return mp?.mode === "default_vendor" && mp?.awaiting_admin_float === true && mp?.floated !== true;
}

export function isMarketplaceFloated(metadata: Json | null | undefined): boolean {
  const mp = readMarketplaceMeta(metadata);
  return mp?.mode === "default_vendor" && mp?.floated === true;
}

/** Start the 1-hour partner response window when a booking is confirmed with a direct partner assignment. */
export async function ensureVendorResponseAnchorAt(
  client: SupabaseClient<Database>,
  booking: BookingRow,
): Promise<BookingRow> {
  if (booking.status !== "confirmed" || !booking.vendor_id) return booking;
  if (resolveVendorResponseAnchorIso(booking)) return booking;

  const nowIso = new Date().toISOString();
  const m =
    booking.metadata && typeof booking.metadata === "object" && !Array.isArray(booking.metadata)
      ? (booking.metadata as Record<string, Json>)
      : {};
  const existingVr =
    m.vendor_response && typeof m.vendor_response === "object" && !Array.isArray(m.vendor_response)
      ? (m.vendor_response as Record<string, Json>)
      : {};

  return persistBookingRow(client, booking.id, {
    metadata: mergeBookingMetadata(booking.metadata, {
      vendor_response: {
        ...existingVr,
        anchor_at: nowIso,
      } as Json,
    }),
  });
}

async function resolveVendorDisplayName(
  client: SupabaseClient<Database>,
  vendorId: string | null,
): Promise<string | null> {
  if (!vendorId) return null;
  const { data, error } = await client.from("vendors").select("business_name").eq("id", vendorId).maybeSingle();
  if (error) throw new SupabaseApiError(error.message, error);
  return data?.business_name?.trim() ?? null;
}

/**
 * After a booking becomes `confirmed`, notify admin (always) and vendors/marketplace as appropriate.
 * One-time checkout calls this from payment success; AMC calls it on insert when already confirmed.
 */
export async function postBookingConfirmedNotifications(
  client: SupabaseClient<Database>,
  bookingInput: BookingRow,
): Promise<BookingRow> {
  let booking = bookingInput;
  if (booking.status !== "confirmed") return booking;

  if (booking.vendor_id) {
    booking = await ensureVendorResponseAnchorAt(client, booking);
  }

  const routing = readBookingVendorRoutingMeta(booking.metadata);
  const vendorName = booking.vendor_id ? await resolveVendorDisplayName(client, booking.vendor_id) : null;
  const createdCopy = adminBookingCreatedCopy(booking, {
    routingReason: routing?.reason ?? null,
    vendorName,
    awaitingAdminFloat: isBookingAwaitingAdminFloat(booking.metadata),
  });

  await emitAdminBookingNotification(client, {
    booking,
    eventType: "admin_booking_created",
    ...createdCopy,
    note: "Booking confirmed and visible in admin Bookings.",
  });

  if (booking.vendor_id) {
    const isCustomerPreferred = routing?.reason === "preferred_ok";
    const assignedCopy = isCustomerPreferred
      ? vendorCustomerPreferredBookingCopy(booking)
      : vendorBookingAssignedCopy(booking);
    await emitVendorBookingNotification(client, {
      booking,
      eventType: "vendor_booking_assigned",
      recipientVendorId: booking.vendor_id,
      ...assignedCopy,
      vendorName: vendorName ?? undefined,
      note: isCustomerPreferred ? "Customer selected this partner." : "Direct partner assignment.",
    });
    return booking;
  }

  if (isBookingAwaitingAdminFloat(booking.metadata)) {
    return booking;
  }

  if (isMarketplaceFloated(booking.metadata)) {
    const vendorCount = await emitMarketplaceNotificationEvents(client, {
      booking,
      eventType: "marketplace_broadcast",
      channels: ["in_app", "email", "sms", "whatsapp"],
      note: "Marketplace request broadcasted.",
    });
    const copy = adminMarketplaceFloatedCopy(booking, vendorCount);
    await emitAdminBookingNotification(client, {
      booking,
      eventType: "admin_marketplace_floated",
      ...copy,
      note: "Marketplace opened after confirmation.",
    });
  }

  return booking;
}

function readOpsNotifyMeta(metadata: Json | null | undefined): { vendorResponseOverdueAt: string | null } {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return { vendorResponseOverdueAt: null };
  }
  const ops = (metadata as Record<string, unknown>).ops;
  if (!ops || typeof ops !== "object" || Array.isArray(ops)) return { vendorResponseOverdueAt: null };
  const at = (ops as Record<string, unknown>).vendor_response_overdue_at;
  return { vendorResponseOverdueAt: typeof at === "string" ? at : null };
}

/**
 * Notify admin once when a direct-assigned partner misses the 1-hour accept/assign window.
 */
export async function adminNotifyOverdueVendorResponses(
  client: SupabaseClient<Database>,
  options?: { limit?: number },
): Promise<{ scanned: number; notified: number }> {
  const limit = Math.min(Math.max(options?.limit ?? 120, 1), 500);
  const { data, error } = await client
    .from("bookings")
    .select("*")
    .eq("status", "confirmed")
    .not("vendor_id", "is", null)
    .is("technician_id", null)
    .order("scheduled_start", { ascending: true })
    .limit(limit);

  if (error) throw new SupabaseApiError(error.message, error);

  let notified = 0;
  for (const row of data ?? []) {
    if (isWithinVendorResponseWindow(row)) continue;
    if (readOpsNotifyMeta(row.metadata).vendorResponseOverdueAt) continue;
    if (isBookingAwaitingAdminFloat(row.metadata) || isMarketplaceFloated(row.metadata)) continue;

    const vendorName = await resolveVendorDisplayName(client, row.vendor_id);
    const copy = adminVendorResponseOverdueCopy(row, vendorName);
    await emitAdminBookingNotification(client, {
      booking: row,
      eventType: "admin_booking_vendor_response_overdue",
      ...copy,
      vendorName: vendorName ?? undefined,
      note: "Partner response window expired.",
    });

    const nowIso = new Date().toISOString();
    await persistBookingRow(client, row.id, {
      metadata: mergeBookingMetadata(row.metadata, {
        ops: {
          vendor_response_overdue_at: nowIso,
        } as Json,
      }),
    });
    notified += 1;
  }

  return { scanned: data?.length ?? 0, notified };
}
