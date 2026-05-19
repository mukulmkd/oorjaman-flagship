import type { CustomerRow, Json, VendorRow } from "../database.types";
import { parseVendorCoverageZones } from "./vendor-coverage";

/** Signals extracted from the customer's saved site (address + optional GPS for future use). */
export type CustomerLocationSignals = {
  pincode?: string;
  city?: string;
  state?: string;
  lat?: number;
  lng?: number;
};

function normalizeToken(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function safeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value.trim());
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function readObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function extractVendorLatLng(vendor: VendorRow): { lat: number; lng: number } | null {
  const reg = readObject(vendor.registered_address);
  const meta = readObject(vendor.metadata);
  const metaLoc = meta ? readObject(meta.location) : null;
  const metaService = meta ? readObject(meta.service_location) : null;

  const candidates: Array<{ lat: unknown; lng: unknown }> = [
    { lat: reg?.lat, lng: reg?.lng },
    { lat: reg?.latitude, lng: reg?.longitude },
    { lat: meta?.lat, lng: meta?.lng },
    { lat: meta?.latitude, lng: meta?.longitude },
    { lat: metaLoc?.lat, lng: metaLoc?.lng },
    { lat: metaLoc?.latitude, lng: metaLoc?.longitude },
    { lat: metaService?.lat, lng: metaService?.lng },
    { lat: metaService?.latitude, lng: metaService?.longitude },
  ];
  for (const c of candidates) {
    const lat = safeNumber(c.lat);
    const lng = safeNumber(c.lng);
    if (lat == null || lng == null) continue;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;
    return { lat, lng };
  }
  return null;
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const earthKm = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sa = Math.sin(dLat / 2) ** 2;
  const sb = Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(sa + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sb), Math.sqrt(1 - sa));
  return earthKm * c;
}

function extractVendorAreaTokens(vendor: VendorRow): string[] {
  const reg = readObject(vendor.registered_address);
  const meta = readObject(vendor.metadata);
  const regPinRaw = typeof reg?.pincode === "string" ? reg.pincode : "";
  const regPin = regPinRaw.replace(/\D/g, "");
  const regCity = typeof reg?.city === "string" ? reg.city : "";
  const regState = typeof reg?.state === "string" ? reg.state : "";
  const metaPinsRaw = Array.isArray(meta?.serviceable_pincodes)
    ? (meta?.serviceable_pincodes as unknown[])
    : [];
  const metaPins = metaPinsRaw
    .map((x) => (typeof x === "string" ? x.replace(/\D/g, "").slice(0, 6) : ""))
    .filter((x) => x.length === 6);
  const zoneTokens = parseVendorCoverageZones(vendor).flatMap((z) => [
    ...z.pincodes,
    z.city_name,
    z.state_name,
  ]);
  return [
    ...metaPins,
    ...zoneTokens,
    ...(vendor.service_areas ?? []),
    ...(vendor.operating_regions ?? []),
    regPin,
    regCity,
    regState,
  ]
    .map((s) => normalizeToken(String(s)))
    .filter(Boolean);
}

/** Pull searchable tokens from saved JSON address (matches onboarding `addrToJson` shape). */
export function customerLocationSignalsFromCustomer(customer: CustomerRow | null): CustomerLocationSignals {
  if (!customer) return {};
  const raw = customer.service_default_address;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};

  const o = raw as Record<string, unknown>;
  const city = typeof o.city === "string" ? o.city : "";
  const state = typeof o.state === "string" ? o.state : "";
  let pincode = typeof o.pincode === "string" ? o.pincode : "";

  const digits = pincode.replace(/\D/g, "");
  if (digits.length >= 6) pincode = digits.slice(-6);

  return {
    pincode: pincode || undefined,
    city: city.trim() || undefined,
    state: state.trim() || undefined,
    lat: customer.service_lat ?? undefined,
    lng: customer.service_lng ?? undefined,
  };
}

/** Location signals from a booking row's `service_site_address` (used for marketplace geo broadcast). */
export function customerLocationSignalsFromServiceSiteAddress(addr: Json | null | undefined): CustomerLocationSignals {
  if (!addr || typeof addr !== "object" || Array.isArray(addr)) return {};
  const o = addr as Record<string, unknown>;
  const city = typeof o.city === "string" ? o.city : "";
  const state = typeof o.state === "string" ? o.state : "";
  let pincode = typeof o.pincode === "string" ? o.pincode : "";
  const digits = pincode.replace(/\D/g, "");
  if (digits.length >= 6) pincode = digits.slice(-6);
  const lat = safeNumber(o.lat ?? o.latitude);
  const lng = safeNumber(o.lng ?? o.longitude);
  return {
    pincode: pincode || undefined,
    city: city.trim() || undefined,
    state: state.trim() || undefined,
    lat: lat ?? undefined,
    lng: lng ?? undefined,
  };
}

/** Case-insensitive substring match for Indian locations / pin codes in vendor-declared areas. */
export function vendorCoversCustomerSignals(vendor: VendorRow, signals: CustomerLocationSignals): boolean {
  const regions = extractVendorAreaTokens(vendor).map((s) => normalizeToken(String(s))).filter(Boolean);

  if (regions.length === 0) return true;

  const tokens: string[] = [];
  if (signals.pincode) tokens.push(normalizeToken(signals.pincode.replace(/\D/g, "")));
  if (signals.city) tokens.push(normalizeToken(signals.city));
  if (signals.state) tokens.push(normalizeToken(signals.state));

  const uniq = [...new Set(tokens.filter(Boolean))];
  if (uniq.length === 0) return true;

  return uniq.some((tok) => regions.some((r) => r.includes(tok) || tok.includes(r)));
}

export type VendorAreaSplit = {
  /** Vendors whose declared areas overlap the customer's location signals (or universal coverage). */
  inArea: VendorRow[];
  /** Approved vendors that do not match the customer's signals (when signals exist). */
  other: VendorRow[];
};

/**
 * Split approved vendors by whether they appear to cover the customer's service location.
 * When the customer has no location signals, every vendor is treated as `inArea`.
 */
export function splitVendorsByServiceArea(
  vendors: VendorRow[],
  signals: CustomerLocationSignals,
): VendorAreaSplit {
  const hasSignals =
    Boolean(signals.pincode?.trim()) ||
    Boolean(signals.city?.trim()) ||
    Boolean(signals.state?.trim());

  if (!hasSignals) {
    return { inArea: vendors, other: [] };
  }

  const inArea: VendorRow[] = [];
  const other: VendorRow[] = [];
  for (const v of vendors) {
    if (vendorCoversCustomerSignals(v, signals)) inArea.push(v);
    else other.push(v);
  }
  return { inArea, other };
}

/**
 * Rank vendors by nearest location to customer when coordinates exist.
 * Fallback scoring order:
 * 1) exact pincode token match
 * 2) city token match
 * 3) state token match
 * 4) business name alphabetical
 */
export function rankVendorsByNearest(vendors: VendorRow[], signals: CustomerLocationSignals): VendorRow[] {
  const customerPoint =
    Number.isFinite(signals.lat) && Number.isFinite(signals.lng) ? { lat: Number(signals.lat), lng: Number(signals.lng) } : null;
  const pinTok = signals.pincode?.replace(/\D/g, "").trim() || "";
  const cityTok = signals.city ? normalizeToken(signals.city) : "";
  const stateTok = signals.state ? normalizeToken(signals.state) : "";

  return [...vendors].sort((a, b) => {
    if (customerPoint) {
      const pa = extractVendorLatLng(a);
      const pb = extractVendorLatLng(b);
      if (pa && pb) {
        const da = haversineKm(customerPoint, pa);
        const db = haversineKm(customerPoint, pb);
        if (da !== db) return da - db;
      } else if (pa && !pb) {
        return -1;
      } else if (!pa && pb) {
        return 1;
      }
    }

    const ta = extractVendorAreaTokens(a);
    const tb = extractVendorAreaTokens(b);
    const score = (tokens: string[]) =>
      (pinTok && tokens.some((t) => t.includes(pinTok) || pinTok.includes(t)) ? 100 : 0) +
      (cityTok && tokens.some((t) => t.includes(cityTok) || cityTok.includes(t)) ? 10 : 0) +
      (stateTok && tokens.some((t) => t.includes(stateTok) || stateTok.includes(t)) ? 1 : 0);
    const sa = score(ta);
    const sb = score(tb);
    if (sa !== sb) return sb - sa;

    return a.business_name.localeCompare(b.business_name, undefined, { sensitivity: "base" });
  });
}
