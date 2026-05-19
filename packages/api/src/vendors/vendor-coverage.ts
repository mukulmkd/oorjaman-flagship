import type { Json, VendorRow } from "../database.types";

/** One geographic coverage block: country → state → city → PIN list. */
export type VendorServiceCoverageZone = {
  id: string;
  country_code: string;
  country_name: string;
  state_code: string;
  state_name: string;
  city_name: string;
  pincodes: string[];
};

export const VENDOR_COVERAGE_ZONES_METADATA_KEY = "service_coverage_zones";
export const DEFAULT_VENDOR_COVERAGE_COUNTRY_CODE = "IN";

function readMetadataObject(metadata: Json | null | undefined): Record<string, unknown> | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  return metadata as Record<string, unknown>;
}

function normalizePin(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 6);
}

function parsePinLines(text: string): string[] {
  return [...new Set(text.split(/\r?\n/).map(normalizePin).filter((p) => p.length === 6))];
}

function parseZone(raw: unknown): VendorServiceCoverageZone | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const z = raw as Record<string, unknown>;
  const id = typeof z.id === "string" && z.id.trim() ? z.id.trim() : crypto.randomUUID();
  const country_code =
    typeof z.country_code === "string" && z.country_code.trim()
      ? z.country_code.trim().toUpperCase()
      : DEFAULT_VENDOR_COVERAGE_COUNTRY_CODE;
  const country_name =
    typeof z.country_name === "string" && z.country_name.trim() ? z.country_name.trim() : "India";
  const state_code = typeof z.state_code === "string" ? z.state_code.trim() : "";
  const state_name = typeof z.state_name === "string" ? z.state_name.trim() : "";
  const city_name = typeof z.city_name === "string" ? z.city_name.trim() : "";
  const pincodes = Array.isArray(z.pincodes)
    ? [...new Set(z.pincodes.map((p) => (typeof p === "string" || typeof p === "number" ? normalizePin(String(p)) : "")).filter((p) => p.length === 6))]
    : [];
  if (!state_name && !city_name && pincodes.length === 0) return null;
  return {
    id,
    country_code,
    country_name,
    state_code,
    state_name,
    city_name,
    pincodes,
  };
}

/** Read structured zones from vendor metadata, with a fallback from legacy flat fields. */
export function parseVendorCoverageZones(
  vendor: Pick<VendorRow, "metadata" | "service_areas" | "operating_regions">,
): VendorServiceCoverageZone[] {
  const meta = readMetadataObject(vendor.metadata);
  const rawZones = meta?.[VENDOR_COVERAGE_ZONES_METADATA_KEY];
  if (Array.isArray(rawZones) && rawZones.length > 0) {
    const parsed = rawZones.map(parseZone).filter((z): z is VendorServiceCoverageZone => z !== null);
    if (parsed.length > 0) return parsed;
  }

  const legacyPins = Array.isArray(meta?.serviceable_pincodes)
    ? (meta.serviceable_pincodes as unknown[])
        .map((p) => (typeof p === "string" || typeof p === "number" ? normalizePin(String(p)) : ""))
        .filter((p) => p.length === 6)
    : [];
  const cities = (vendor.service_areas ?? []).map((s) => s.trim()).filter(Boolean);
  const states = (vendor.operating_regions ?? []).map((s) => s.trim()).filter(Boolean);

  if (legacyPins.length === 0 && cities.length === 0 && states.length === 0) {
    return [];
  }

  if (states.length > 0) {
    return states.map((stateName, index) => ({
      id: `legacy-${index}`,
      country_code: DEFAULT_VENDOR_COVERAGE_COUNTRY_CODE,
      country_name: "India",
      state_code: "",
      state_name: stateName,
      city_name: cities[index] ?? cities[0] ?? "",
      pincodes: legacyPins,
    }));
  }

  return [
    {
      id: "legacy-0",
      country_code: DEFAULT_VENDOR_COVERAGE_COUNTRY_CODE,
      country_name: "India",
      state_code: "",
      state_name: "",
      city_name: cities[0] ?? "",
      pincodes: legacyPins,
    },
  ];
}

export function createEmptyCoverageZone(
  countryCode = DEFAULT_VENDOR_COVERAGE_COUNTRY_CODE,
  countryName = "India",
): VendorServiceCoverageZone {
  return {
    id: crypto.randomUUID(),
    country_code: countryCode,
    country_name: countryName,
    state_code: "",
    state_name: "",
    city_name: "",
    pincodes: [],
  };
}

export function flattenCoverageZones(zones: VendorServiceCoverageZone[]): {
  service_areas: string[];
  operating_regions: string[];
  serviceable_pincodes: string[];
} {
  const service_areas = new Set<string>();
  const operating_regions = new Set<string>();
  const serviceable_pincodes = new Set<string>();

  for (const z of zones) {
    if (z.city_name.trim()) service_areas.add(z.city_name.trim());
    if (z.state_name.trim()) operating_regions.add(z.state_name.trim());
    for (const p of z.pincodes) serviceable_pincodes.add(p);
  }

  return {
    service_areas: [...service_areas],
    operating_regions: [...operating_regions],
    serviceable_pincodes: [...serviceable_pincodes],
  };
}

export function mergeCoverageIntoVendorMetadata(
  existing: Json | null | undefined,
  zones: VendorServiceCoverageZone[],
): Json {
  const base = readMetadataObject(existing) ?? {};
  const flat = flattenCoverageZones(zones);
  return {
    ...base,
    [VENDOR_COVERAGE_ZONES_METADATA_KEY]: zones,
    serviceable_pincodes: flat.serviceable_pincodes,
  } as Json;
}

export function validateVendorCoverageZones(zones: VendorServiceCoverageZone[]): string | null {
  if (zones.length === 0) {
    return "Add at least one service area where your team can take visits.";
  }
  for (let i = 0; i < zones.length; i += 1) {
    const z = zones[i];
    const label = z.city_name || z.state_name || `Area ${i + 1}`;
    if (!z.state_code.trim() || !z.state_name.trim()) {
      return `Select a state for “${label}”.`;
    }
    if (!z.city_name.trim()) {
      return `Select a city for ${z.state_name}.`;
    }
    if (z.pincodes.length === 0) {
      return `Add at least one 6-digit PIN code for ${z.city_name}, ${z.state_name}.`;
    }
  }
  return null;
}

/** Serialize PIN lines from a textarea into the zone. */
export function coverageZonePinsFromText(text: string): string[] {
  return parsePinLines(text);
}

export function coverageZonePinsToText(pincodes: string[]): string {
  return pincodes.join("\n");
}

export function allCoverageTokensFromVendor(
  vendor: Pick<VendorRow, "metadata" | "service_areas" | "operating_regions">,
): string[] {
  const zones = parseVendorCoverageZones(vendor);
  const tokens: string[] = [];
  for (const z of zones) {
    tokens.push(...z.pincodes, z.city_name, z.state_name);
  }
  const flat = flattenCoverageZones(zones);
  tokens.push(...flat.service_areas, ...flat.operating_regions, ...flat.serviceable_pincodes);
  return tokens.map((t) => t.trim().toLowerCase()).filter(Boolean);
}
