import type { CustomerRow, Json } from "../database.types";
import { formattedSiteAddressFromJson } from "../bookings/customer-booking-payload";
export const MAX_SITE_PHOTOS_PER_ADDRESS = 5;

export type SitePhotoRecord = {
  id: string;
  storage_path: string;
  lat: number;
  lng: number;
  accuracy_m?: number | null;
  captured_at: string;
  source: "camera" | "library";
};

/** Count entries in raw JSON before normalization (for UI mismatch hints). */
export function countRawSitePhotoArray(raw: unknown): number {
  return Array.isArray(raw) ? raw.length : 0;
}

export function parseSitePhotoRecords(raw: unknown): SitePhotoRecord[] {
  if (!Array.isArray(raw)) return [];
  const out: SitePhotoRecord[] = [];
  const seenPaths = new Set<string>();
  const seenIds = new Set<string>();

  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const o = item as Record<string, unknown>;
    const storage_path = typeof o.storage_path === "string" ? o.storage_path.trim() : "";
    if (!storage_path || seenPaths.has(storage_path)) continue;

    const lat = Number(o.lat);
    const lng = Number(o.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    let id = typeof o.id === "string" ? o.id.trim() : "";
    if (!id) {
      const leaf = storage_path.split("/").pop() ?? storage_path;
      id = leaf.replace(/\.[a-z0-9]+$/i, "") || `photo-${out.length}`;
    }
    while (seenIds.has(id)) {
      id = `${id}-${out.length}`;
    }
    seenIds.add(id);
    seenPaths.add(storage_path);

    const captured_at =
      typeof o.captured_at === "string" && o.captured_at.trim()
        ? o.captured_at.trim()
        : new Date().toISOString();
    const source: SitePhotoRecord["source"] = o.source === "camera" ? "camera" : "library";

    const accuracyRaw = o.accuracy_m;
    const accuracy_m =
      accuracyRaw == null
        ? null
        : Number.isFinite(Number(accuracyRaw))
          ? Number(accuracyRaw)
          : null;

    out.push({ id, storage_path, lat, lng, accuracy_m, captured_at, source });
    if (out.length >= MAX_SITE_PHOTOS_PER_ADDRESS) break;
  }
  return out;
}

export type ServiceAddressEntry = {
  id: string;
  label: string;
  address: Json;
  created_at: string;
  preferred_vendor_ids?: string[];
  /** Per-address GPS (preferred over customer-level service_lat/lng). */
  service_lat?: number | null;
  service_lng?: number | null;
  location_accuracy_m?: number | null;
  location_recorded_at?: string | null;
  /** Up to 5 geo-tagged site photos; files in Storage bucket `customer-site-photos`. */
  site_photos?: SitePhotoRecord[];
};

export function serviceAddressFormatted(address: Json | null | undefined): string {
  return formattedSiteAddressFromJson(address ?? null);
}

function labelFromSavedServiceAddress(address: Json | null | undefined): string {
  if (!address || typeof address !== "object" || Array.isArray(address)) return "Saved address";
  const o = address as Record<string, unknown>;
  const explicit = typeof o.label === "string" ? o.label.trim() : "";
  if (explicit) return explicit;
  const line1 = typeof o.line1 === "string" ? o.line1.trim() : "";
  if (line1) return line1.length > 48 ? `${line1.slice(0, 45)}…` : line1;
  const formatted = typeof o.formatted === "string" ? o.formatted.trim() : "";
  if (formatted) {
    const head = formatted.split(",")[0]?.trim() ?? formatted;
    return head.length > 48 ? `${head.slice(0, 45)}…` : head;
  }
  return "Saved address";
}

/** Read saved service addresses from customer metadata (same shape as customer app). */
export function readServiceAddressBook(customer: CustomerRow | null): {
  entries: ServiceAddressEntry[];
  defaultId: string | null;
} {
  if (!customer) return { entries: [], defaultId: null };
  const m =
    customer.metadata && typeof customer.metadata === "object" && !Array.isArray(customer.metadata)
      ? (customer.metadata as Record<string, unknown>)
      : {};
  const raw = Array.isArray(m.service_addresses) ? m.service_addresses : [];
  const entries = raw
    .map((r): ServiceAddressEntry | null => {
      if (!r || typeof r !== "object" || Array.isArray(r)) return null;
      const o = r as Record<string, unknown>;
      const id = typeof o.id === "string" ? o.id.trim() : "";
      if (!id) return null;
      const address = (o.address ?? null) as Json;
      let label =
        typeof o.label === "string" && o.label.trim() ? o.label.trim() : "Saved address";
      if (
        (label === "Saved address" || !label) &&
        address &&
        typeof address === "object" &&
        !Array.isArray(address)
      ) {
        const inner = (address as Record<string, unknown>).label;
        if (typeof inner === "string" && inner.trim()) label = inner.trim();
      }
      const created_at = typeof o.created_at === "string" ? o.created_at : new Date().toISOString();
      const prefRaw = o.preferred_vendor_ids;
      const preferred_vendor_ids =
        Array.isArray(prefRaw) && prefRaw.length > 0
          ? prefRaw.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
          : undefined;
      const entry: ServiceAddressEntry = { id, label, address, created_at };
      if (preferred_vendor_ids?.length) entry.preferred_vendor_ids = preferred_vendor_ids;
      const latRaw = o.service_lat;
      const lngRaw = o.service_lng;
      if (latRaw != null && lngRaw != null) {
        const service_lat = Number(latRaw);
        const service_lng = Number(lngRaw);
        if (Number.isFinite(service_lat) && Number.isFinite(service_lng)) {
          entry.service_lat = service_lat;
          entry.service_lng = service_lng;
          const acc = o.location_accuracy_m;
          entry.location_accuracy_m =
            acc == null ? null : Number.isFinite(Number(acc)) ? Number(acc) : null;
          if (typeof o.location_recorded_at === "string" && o.location_recorded_at.trim()) {
            entry.location_recorded_at = o.location_recorded_at.trim();
          }
        }
      }
      const site_photos = parseSitePhotoRecords(o.site_photos);
      if (site_photos.length) entry.site_photos = site_photos;
      return entry;
    })
    .filter((r): r is ServiceAddressEntry => r != null);

  if (entries.length === 0 && customer.service_default_address) {
    const fallbackId = "default";
    return {
      entries: [
        {
          id: fallbackId,
          label: labelFromSavedServiceAddress(customer.service_default_address),
          address: customer.service_default_address,
          created_at: new Date().toISOString(),
        },
      ],
      defaultId: fallbackId,
    };
  }

  const defaultIdRaw = typeof m.default_service_address_id === "string" ? m.default_service_address_id : null;
  const defaultId =
    defaultIdRaw && entries.some((e) => e.id === defaultIdRaw) ? defaultIdRaw : entries[0]?.id ?? null;
  return { entries, defaultId };
}

export function getServiceAddressEntry(
  customer: CustomerRow | null,
  addressId: string,
): ServiceAddressEntry | null {
  const id = addressId.trim();
  if (!id) return null;
  const { entries } = readServiceAddressBook(customer);
  return entries.find((e) => e.id === id) ?? null;
}

export function buildServiceSiteAddressFromEntry(entry: ServiceAddressEntry): Json {
  const formatted = serviceAddressFormatted(entry.address);
  if (!formatted.trim()) {
    throw new Error("Saved address is empty.");
  }
  if (entry.address && typeof entry.address === "object" && !Array.isArray(entry.address)) {
    return {
      ...(entry.address as Record<string, unknown>),
      formatted,
      label: entry.label,
    } as Json;
  }
  return { formatted, label: entry.label } as Json;
}
