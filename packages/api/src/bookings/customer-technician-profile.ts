import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";
import { createTechnicianDocumentSignedUrl } from "../technicians/technician-documents";
import { SupabaseApiError } from "../result";

export type CustomerBookingTechnicianProfile = {
  technicianId: string;
  displayName: string;
  phoneE164: string | null;
  partnerName: string | null;
  avatarStoragePath: string | null;
  avatarSignedUrl: string | null;
  enRouteAt: string | null;
  isEnRoute: boolean;
  isOnSite: boolean;
};

function parseProfileRow(raw: unknown): CustomerBookingTechnicianProfile | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const technicianId = typeof o.technician_id === "string" ? o.technician_id : null;
  const displayName = typeof o.display_name === "string" ? o.display_name.trim() : "";
  if (!technicianId || !displayName) return null;

  return {
    technicianId,
    displayName,
    phoneE164:
      typeof o.phone_e164 === "string" && o.phone_e164.trim() ? o.phone_e164.trim() : null,
    partnerName:
      typeof o.partner_name === "string" && o.partner_name.trim() ? o.partner_name.trim() : null,
    avatarStoragePath:
      typeof o.avatar_storage_path === "string" && o.avatar_storage_path.trim()
        ? o.avatar_storage_path.trim()
        : null,
    avatarSignedUrl: null,
    enRouteAt: typeof o.en_route_at === "string" ? o.en_route_at : null,
    isEnRoute: Boolean(o.is_en_route),
    isOnSite: Boolean(o.is_on_site),
  };
}

/** Customer-safe technician summary for an assigned booking (RLS-checked in Postgres). */
export async function getCustomerBookingTechnicianProfile(
  client: SupabaseClient<Database>,
  bookingId: string,
): Promise<CustomerBookingTechnicianProfile | null> {
  const { data, error } = await client.rpc("get_customer_booking_technician_profile", {
    p_booking_id: bookingId,
  });
  if (error) throw new SupabaseApiError(error.message, error);

  const profile = parseProfileRow(data);
  if (!profile?.avatarStoragePath) return profile;

  try {
    const avatarSignedUrl = await createTechnicianDocumentSignedUrl(
      client,
      profile.avatarStoragePath,
      3600,
    );
    return { ...profile, avatarSignedUrl };
  } catch {
    return profile;
  }
}

export function isBookingGpsTrackable(
  booking: Pick<
    import("../database.types").BookingRow,
    "technician_id" | "status" | "technician_en_route_at"
  >,
): boolean {
  if (!booking.technician_id) return false;
  return booking.status === "accepted" && Boolean(booking.technician_en_route_at);
}
