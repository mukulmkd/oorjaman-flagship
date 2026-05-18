import type { SupabaseClient } from "@supabase/supabase-js";
import type { BookingRow, CustomerRow, Database } from "../database.types";
import { SupabaseApiError } from "../result";
import { readBookingServiceAddressId } from "../subscriptions/subscription-address";
import {
  getServiceAddressEntry,
  MAX_SITE_PHOTOS_PER_ADDRESS,
  parseSitePhotoRecords,
  readServiceAddressBook,
  type ServiceAddressEntry,
  type SitePhotoRecord,
} from "./service-address-book";

export type { SitePhotoRecord };

export { MAX_SITE_PHOTOS_PER_ADDRESS };

export const CUSTOMER_SITE_PHOTOS_BUCKET = "customer-site-photos" as const;

export const SITE_PHOTO_SIGNED_URL_TTL_SEC = 60 * 60;

export type SitePhotoWithSignedUrl = SitePhotoRecord & {
  signed_url: string | null;
  /** True when metadata exists but Storage object is missing (failed upload or deleted). */
  storage_missing?: boolean;
};

export type SitePhotoCaptureGeo = {
  lat: number;
  lng: number;
  accuracy_m?: number | null;
};

function randomPhotoId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function buildCustomerSitePhotoStoragePath(
  customerUserId: string,
  serviceAddressId: string,
  photoId: string,
  ext: string,
): string {
  const uid = customerUserId.trim();
  const addrId = serviceAddressId.trim();
  const id = photoId.trim();
  const safeExt = ext.replace(/[^a-z0-9]/gi, "") || "jpg";
  return `${uid}/${addrId}/${id}.${safeExt}`;
}

export function readSitePhotosFromAddressEntry(entry: ServiceAddressEntry | null): SitePhotoRecord[] {
  if (!entry?.site_photos?.length) return [];
  return parseSitePhotoRecords(entry.site_photos);
}

export function readSitePhotosForCustomerAddress(
  customer: CustomerRow | null,
  serviceAddressId: string,
): SitePhotoRecord[] {
  const entry = getServiceAddressEntry(customer, serviceAddressId);
  return readSitePhotosFromAddressEntry(entry);
}

export async function createCustomerSitePhotoSignedUrl(
  client: SupabaseClient<Database>,
  storagePath: string,
  expiresInSec = SITE_PHOTO_SIGNED_URL_TTL_SEC,
): Promise<string> {
  const { data, error } = await client.storage
    .from(CUSTOMER_SITE_PHOTOS_BUCKET)
    .createSignedUrl(storagePath, expiresInSec);
  if (error) throw new SupabaseApiError(error.message, error);
  if (!data?.signedUrl) throw new SupabaseApiError("Could not sign site photo URL.");
  return data.signedUrl;
}

export async function signSitePhotoRecords(
  client: SupabaseClient<Database>,
  photos: SitePhotoRecord[],
): Promise<SitePhotoWithSignedUrl[]> {
  const out: SitePhotoWithSignedUrl[] = [];
  for (const p of photos) {
    try {
      const signed_url = await createCustomerSitePhotoSignedUrl(client, p.storage_path);
      out.push({ ...p, signed_url, storage_missing: false });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      const missing = /not found|object not found|does not exist/i.test(msg);
      out.push({ ...p, signed_url: null, storage_missing: missing });
    }
  }
  return out;
}

export async function uploadCustomerSitePhotoBytes(
  client: SupabaseClient<Database>,
  input: {
    customerUserId: string;
    serviceAddressId: string;
    bytes: ArrayBuffer | Uint8Array;
    contentType?: string;
    geo: SitePhotoCaptureGeo;
    source: SitePhotoRecord["source"];
  },
): Promise<SitePhotoRecord> {
  const photoId = randomPhotoId();
  const mime = (input.contentType ?? "image/jpeg").split(";")[0]!.trim();
  const ext =
    mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : mime.includes("jpeg") ? "jpg" : "jpg";
  const storage_path = buildCustomerSitePhotoStoragePath(
    input.customerUserId,
    input.serviceAddressId,
    photoId,
    ext,
  );
  const body = input.bytes instanceof Uint8Array ? input.bytes : new Uint8Array(input.bytes);
  const { error } = await client.storage.from(CUSTOMER_SITE_PHOTOS_BUCKET).upload(storage_path, body, {
    contentType: mime,
    upsert: false,
  });
  if (error) throw new SupabaseApiError(error.message, error);
  return {
    id: photoId,
    storage_path,
    lat: input.geo.lat,
    lng: input.geo.lng,
    accuracy_m: input.geo.accuracy_m ?? null,
    captured_at: new Date().toISOString(),
    source: input.source,
  };
}

export async function deleteCustomerSitePhotoObject(
  client: SupabaseClient<Database>,
  storagePath: string,
): Promise<void> {
  const { error } = await client.storage.from(CUSTOMER_SITE_PHOTOS_BUCKET).remove([storagePath]);
  if (error) throw new SupabaseApiError(error.message, error);
}

export function bookingShowsSitePhotos(booking: Pick<BookingRow, "status" | "technician_id">): boolean {
  if (!booking.technician_id) return false;
  return booking.status === "accepted" || booking.status === "in_progress" || booking.status === "completed";
}

/** Site photos for a booking (vendor / technician / admin / customer). Returns [] when not yet shareable. */
export async function getSitePhotosForBooking(
  client: SupabaseClient<Database>,
  booking: Pick<BookingRow, "id" | "customer_id" | "metadata" | "status" | "technician_id">,
): Promise<SitePhotoWithSignedUrl[]> {
  if (!bookingShowsSitePhotos(booking)) return [];
  const addressId = readBookingServiceAddressId(booking.metadata);
  if (!addressId) return [];

  const { data, error } = await client
    .from("customers")
    .select("id, metadata")
    .eq("id", booking.customer_id)
    .maybeSingle();
  if (error) throw new SupabaseApiError(error.message, error);
  if (!data) return [];

  const customer = data as Pick<CustomerRow, "id" | "metadata">;
  const photos = readSitePhotosForCustomerAddress(customer as CustomerRow, addressId);
  if (photos.length === 0) return [];
  return signSitePhotoRecords(client, photos);
}

export function patchAddressEntrySitePhotos(
  entries: ServiceAddressEntry[],
  addressId: string,
  site_photos: SitePhotoRecord[],
): ServiceAddressEntry[] {
  const id = addressId.trim();
  const capped = site_photos.slice(0, MAX_SITE_PHOTOS_PER_ADDRESS);
  return entries.map((e) => (e.id === id ? { ...e, site_photos: capped } : e));
}

export function patchAddressEntryGps(
  entries: ServiceAddressEntry[],
  addressId: string,
  geo: SitePhotoCaptureGeo & { recorded_at?: string },
): ServiceAddressEntry[] {
  const id = addressId.trim();
  return entries.map((e) =>
    e.id === id
      ? {
          ...e,
          service_lat: geo.lat,
          service_lng: geo.lng,
          location_accuracy_m: geo.accuracy_m ?? null,
          location_recorded_at: geo.recorded_at ?? new Date().toISOString(),
        }
      : e,
  );
}

export function readAddressEntryGps(entry: ServiceAddressEntry | null): SitePhotoCaptureGeo | null {
  if (!entry) return null;
  const lat = entry.service_lat;
  const lng = entry.service_lng;
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, accuracy_m: entry.location_accuracy_m ?? null };
}

/** Resolve default address id + photos for profile display. */
export function readDefaultAddressSiteContext(customer: CustomerRow | null): {
  addressId: string | null;
  entry: ServiceAddressEntry | null;
  photos: SitePhotoRecord[];
  gps: SitePhotoCaptureGeo | null;
} {
  const { entries, defaultId } = readServiceAddressBook(customer);
  const entry = defaultId ? entries.find((e) => e.id === defaultId) ?? null : entries[0] ?? null;
  return {
    addressId: entry?.id ?? null,
    entry,
    photos: readSitePhotosFromAddressEntry(entry),
    gps: readAddressEntryGps(entry),
  };
}
