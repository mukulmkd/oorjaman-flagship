import type { CustomerRow, Json, SitePhotoRecord } from "@oorjaman/api";
import { parseSitePhotoRecords } from "@oorjaman/api";

export type { SitePhotoRecord };

export type ServiceAddressSaveExtras = {
  service_lat?: number | null;
  service_lng?: number | null;
  location_accuracy_m?: number | null;
};

export type ServiceAddressEntry = {
  id: string;
  label: string;
  address: Json;
  created_at: string;
  preferred_vendor_ids?: string[];
  service_lat?: number | null;
  service_lng?: number | null;
  location_accuracy_m?: number | null;
  location_recorded_at?: string | null;
  site_photos?: SitePhotoRecord[];
};

/** Max preferred partners per saved service address (customer metadata). */
export const MAX_PREFERRED_VENDORS_PER_ADDRESS = 8;

export function dedupePreferredVendorIds(ids: string[]): string[] {
  const out: string[] = [];
  for (const id of ids) {
    const t = id.trim();
    if (!t || out.includes(t)) continue;
    out.push(t);
    if (out.length >= MAX_PREFERRED_VENDORS_PER_ADDRESS) break;
  }
  return out;
}

export function readPreferredVendorIdsForDefaultServiceLocation(customer: CustomerRow | null): string[] {
  const { entries, defaultId } = readServiceAddressBook(customer);
  const e = defaultId ? entries.find((x) => x.id === defaultId) : entries[0];
  return dedupePreferredVendorIds(e?.preferred_vendor_ids ?? []);
}

export function readFallbackVendorIdFromCustomer(customer: CustomerRow | null): string | null {
  if (!customer?.metadata || typeof customer.metadata !== "object" || Array.isArray(customer.metadata)) return null;
  const v = (customer.metadata as Record<string, unknown>).fallback_vendor_id;
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export function setEntryPreferredVendorIds(
  entries: ServiceAddressEntry[],
  entryId: string,
  preferredVendorIds: string[],
): ServiceAddressEntry[] {
  return entries.map((e) =>
    e.id === entryId ? { ...e, preferred_vendor_ids: dedupePreferredVendorIds(preferredVendorIds) } : e,
  );
}

export function preferredIdsAfterAppend(current: string[], vendorId: string): string[] {
  const id = vendorId.trim();
  if (!id) return dedupePreferredVendorIds(current);
  if (dedupePreferredVendorIds(current).includes(id)) return dedupePreferredVendorIds(current);
  return dedupePreferredVendorIds([...dedupePreferredVendorIds(current), id]);
}

/** Label for legacy rows backed only by `service_default_address` (no address-book metadata). */
export function labelFromSavedServiceAddress(address: Json | null | undefined): string {
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

export function serviceAddressFormatted(address: Json | null | undefined): string {
  if (!address || typeof address !== "object" || Array.isArray(address)) return "";
  const o = address as Record<string, unknown>;
  const formatted = typeof o.formatted === "string" ? o.formatted.trim() : "";
  if (formatted) return formatted;
  const line1 = typeof o.line1 === "string" ? o.line1.trim() : "";
  const line2 = typeof o.line2 === "string" ? o.line2.trim() : "";
  const city = typeof o.city === "string" ? o.city.trim() : "";
  const state = typeof o.state === "string" ? o.state.trim() : "";
  const pincode = typeof o.pincode === "string" ? o.pincode.trim() : "";
  return [line1, line2, [city, state].filter(Boolean).join(", "), pincode].filter(Boolean).join(", ");
}

/** True when the customer has a non-empty saved service location (book or legacy default). */
export function customerHasUsableServiceAddress(customer: CustomerRow | null | undefined): boolean {
  if (!customer) return false;
  const { entries, defaultId } = readServiceAddressBook(customer);
  if (entries.length === 0) return false;
  const selected = defaultId ? entries.find((e) => e.id === defaultId) ?? null : entries[0] ?? null;
  if (!selected?.address) return false;
  return serviceAddressFormatted(selected.address).trim().length > 0;
}

/**
 * Profile edits update `customers.service_default_address` only; the address book lives in
 * `metadata.service_addresses`. Overlay the canonical label from `service_default_address` onto the
 * default book entry so pickers and headers stay in sync until the book is saved again.
 */
function syncDefaultEntryLabelFromServiceDefaultAddress(
  customer: CustomerRow,
  entries: ServiceAddressEntry[],
  defaultId: string | null,
): ServiceAddressEntry[] {
  if (!defaultId || entries.length === 0) return entries;
  const sdp = customer.service_default_address;
  if (!sdp || typeof sdp !== "object" || Array.isArray(sdp)) return entries;
  const raw = (sdp as Record<string, unknown>).label;
  if (typeof raw !== "string" || !raw.trim()) return entries;
  const siteLabel = raw.trim();
  return entries.map((e) => {
    if (e.id !== defaultId) return e;
    if (e.address && typeof e.address === "object" && !Array.isArray(e.address)) {
      return {
        ...e,
        label: siteLabel,
        address: { ...(e.address as Record<string, unknown>), label: siteLabel } as Json,
      };
    }
    return { ...e, label: siteLabel };
  });
}

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
      const id = typeof o.id === "string" ? o.id : "";
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
          ? dedupePreferredVendorIds(prefRaw.filter((x): x is string => typeof x === "string"))
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
  const defaultId = defaultIdRaw && entries.some((e) => e.id === defaultIdRaw) ? defaultIdRaw : entries[0]?.id ?? null;
  const synced = syncDefaultEntryLabelFromServiceDefaultAddress(customer, entries, defaultId);
  return { entries: synced, defaultId };
}

export function mergeServiceGpsIntoCustomerPatch<
  T extends { metadata: Json; service_default_address: Json | null },
>(base: T, extras?: ServiceAddressSaveExtras): T | (T & { service_lat: number; service_lng: number; location_accuracy_m: number | null }) {
  if (
    extras?.service_lat != null &&
    extras.service_lng != null &&
    Number.isFinite(extras.service_lat) &&
    Number.isFinite(extras.service_lng)
  ) {
    return {
      ...base,
      service_lat: extras.service_lat,
      service_lng: extras.service_lng,
      location_accuracy_m: extras.location_accuracy_m ?? null,
    };
  }
  return base;
}

export function buildAddressBookPatch(
  customer: CustomerRow,
  entries: ServiceAddressEntry[],
  defaultId: string | null,
  opts?: { fallbackVendorId?: string | null },
): {
  metadata: Json;
  service_default_address: Json | null;
} {
  const existingMeta =
    customer.metadata && typeof customer.metadata === "object" && !Array.isArray(customer.metadata)
      ? (customer.metadata as Record<string, Json>)
      : {};
  const safeDefaultId = defaultId && entries.some((e) => e.id === defaultId) ? defaultId : entries[0]?.id ?? null;
  const defaultEntry = safeDefaultId ? entries.find((e) => e.id === safeDefaultId) ?? null : null;
  let service_default_address: Json | null = null;
  if (defaultEntry?.address && typeof defaultEntry.address === "object" && !Array.isArray(defaultEntry.address)) {
    service_default_address = {
      ...(defaultEntry.address as Record<string, unknown>),
      label: defaultEntry.label,
    } as Json;
  } else if (defaultEntry?.address) {
    service_default_address = defaultEntry.address;
  }
  const meta: Record<string, Json> = {
    ...existingMeta,
    service_addresses: entries as unknown as Json,
    default_service_address_id: safeDefaultId as unknown as Json,
  };
  if (opts && "fallbackVendorId" in opts) {
    const fb = opts.fallbackVendorId?.trim() || null;
    if (fb) meta.fallback_vendor_id = fb as unknown as Json;
    else delete meta.fallback_vendor_id;
  }
  return {
    metadata: meta as Json,
    service_default_address,
  };
}
