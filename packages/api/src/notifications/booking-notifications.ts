import type { SupabaseClient } from "@supabase/supabase-js";
import type { BookingRow, Database, Json } from "../database.types";
import { SupabaseApiError } from "../result";

export type NotificationAudience = "admin" | "vendor";

export type AdminBookingNotificationEventType =
  | "admin_marketplace_floated"
  | "admin_booking_vendor_claimed"
  | "admin_booking_vendor_accepted"
  | "admin_booking_vendor_rejected"
  | "admin_booking_needs_reassignment"
  | "admin_booking_technician_reassigned"
  | "admin_booking_visit_started"
  | "admin_booking_visit_completed"
  | "admin_booking_cancelled";

export type VendorBookingNotificationEventType =
  | "vendor_booking_assigned"
  | "vendor_booking_visit_started"
  | "vendor_booking_visit_completed";

export type InAppNotificationPayload = {
  reference_code: string | null;
  booking_id: string;
  title: string;
  body: string;
  href?: string | null;
  vendor_id?: string | null;
  vendor_name?: string | null;
  technician_id?: string | null;
  technician_name?: string | null;
  status?: string | null;
  emitted_at: string;
  note?: string | null;
};

type EmitInAppInput = {
  booking: Pick<BookingRow, "id" | "reference_code" | "status" | "vendor_id" | "technician_id">;
  eventType: string;
  audience: NotificationAudience;
  recipientVendorId?: string | null;
  title: string;
  body: string;
  href?: string | null;
  vendorName?: string | null;
  technicianName?: string | null;
  note?: string | null;
  extraChannels?: ("email" | "sms" | "whatsapp")[];
};

export {
  adminBookingCancelledCopy,
  adminMarketplaceFloatedCopy,
  adminReassignmentNeededCopy,
  adminTechnicianReassignedCopy,
  adminVendorAcceptedCopy,
  adminVendorClaimedCopy,
  adminVendorDeclinedCopy,
  adminVisitCompletedCopy,
  adminVisitStartedCopy,
  vendorBookingAssignedCopy,
  vendorVisitCompletedCopy,
  vendorVisitStartedCopy,
} from "./notification-copy";

function adminBookingsHref(bookingId: string): string {
  return `/dashboard/bookings?highlight=${bookingId}`;
}

function vendorOperationsHref(): string {
  return "/dashboard/operations";
}

export async function emitInAppNotification(
  client: SupabaseClient<Database>,
  input: EmitInAppInput,
): Promise<void> {
  const nowIso = new Date().toISOString();
  const channels: string[] = ["in_app", ...(input.extraChannels ?? [])];

  const payload: InAppNotificationPayload = {
    reference_code: input.booking.reference_code,
    booking_id: input.booking.id,
    title: input.title,
    body: input.body,
    href: input.href ?? null,
    vendor_id: input.booking.vendor_id,
    vendor_name: input.vendorName ?? null,
    technician_id: input.booking.technician_id,
    technician_name: input.technicianName ?? null,
    status: input.booking.status,
    emitted_at: nowIso,
    note: input.note ?? null,
  };

  const row: Database["public"]["Tables"]["notification_events"]["Insert"] = {
    booking_id: input.booking.id,
    recipient_audience: input.audience,
    recipient_vendor_id:
      input.audience === "vendor" ? (input.recipientVendorId ?? input.booking.vendor_id) : null,
    event_type: input.eventType,
    channels: channels as unknown as Json,
    status: channels.length === 1 && channels[0] === "in_app" ? "sent" : "queued",
    processed_at: channels.length === 1 && channels[0] === "in_app" ? nowIso : null,
    payload: payload as unknown as Json,
  };

  const { error } = await client.from("notification_events").insert(row);
  if (error) throw new SupabaseApiError(error.message, error);
}

export async function emitAdminBookingNotification(
  client: SupabaseClient<Database>,
  input: Omit<EmitInAppInput, "audience" | "recipientVendorId" | "href"> & {
    eventType: AdminBookingNotificationEventType;
  },
): Promise<void> {
  await emitInAppNotification(client, {
    ...input,
    audience: "admin",
    href: adminBookingsHref(input.booking.id),
  });
}

export async function emitVendorBookingNotification(
  client: SupabaseClient<Database>,
  input: Omit<EmitInAppInput, "audience" | "href"> & {
    eventType: VendorBookingNotificationEventType;
    recipientVendorId: string;
  },
): Promise<void> {
  await emitInAppNotification(client, {
    ...input,
    audience: "vendor",
    href: vendorOperationsHref(),
  });
}

