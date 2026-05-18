import type { CustomerRow } from "@oorjaman/api";

export const INSTALL_CATEGORIES: { value: "residential" | "commercial"; label: string }[] = [
  { value: "residential", label: "Residential" },
  { value: "commercial", label: "Commercial" },
];

export const ROOF_MATERIALS: { value: "tin_metal" | "rcc" | "mixed" | "other"; label: string }[] = [
  { value: "tin_metal", label: "Tin / metal sheet" },
  { value: "rcc", label: "RCC / concrete" },
  { value: "mixed", label: "Mixed" },
  { value: "other", label: "Other" },
];

export const ROOF_TYPES: { value: string; label: string }[] = [
  { value: "flat", label: "Flat / terrace" },
  { value: "inclined", label: "Inclined / pitched roof" },
  { value: "mixed", label: "Mixed sections" },
  { value: "ground", label: "Ground mount" },
  { value: "other", label: "Other" },
];

export const WATER_OPTS: { value: string; label: string }[] = [
  { value: "yes", label: "Yes - tap on site" },
  { value: "limited", label: "Limited / hose only" },
  { value: "no", label: "No on-site water" },
];

export const ACCESS_OPTS: { value: string; label: string }[] = [
  { value: "ladder_ok", label: "Ladder access OK" },
  { value: "stairs", label: "Stairs / internal access" },
  { value: "narrow", label: "Limited / narrow access" },
  { value: "crane_lift", label: "Crane or lift needed" },
];

export type Addr = {
  /** Short name for this site (shown in headers and address pickers). */
  label: string;
  line1: string;
  line2: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
};

export function parseAddr(j: unknown): Addr {
  if (j && typeof j === "object" && !Array.isArray(j)) {
    const o = j as Record<string, unknown>;
    const labelRaw = typeof o.label === "string" ? o.label.trim() : "";
    return {
      label: labelRaw,
      line1: String(o.line1 ?? o.line_1 ?? ""),
      line2: String(o.line2 ?? ""),
      city: String(o.city ?? ""),
      district: String(o.district ?? ""),
      state: String(o.state ?? ""),
      pincode: String(o.pincode ?? o.postal_code ?? ""),
    };
  }
  return { label: "", line1: "", line2: "", city: "", district: "", state: "", pincode: "" };
}

export function addrToJson(a: Addr) {
  const label = a.label.trim();
  const line1 = a.line1.trim();
  const line2 = a.line2.trim() || null;
  const city = a.city.trim();
  const district = a.district.trim() || null;
  const state = a.state.trim();
  const pincode = a.pincode.trim();
  const formatted = [line1, line2, [city, state].filter(Boolean).join(", "), pincode].filter(Boolean).join(", ");
  return {
    label,
    line1,
    line2,
    city,
    district,
    state,
    pincode,
    country: "India",
    ...(formatted ? { formatted } : {}),
  };
}

function dateToFormDate(isoOrDate: string | null): string {
  if (!isoOrDate?.trim()) return "";
  const s = isoOrDate.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);
  try {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

export function readInstallationEnrichment(meta: CustomerRow["metadata"]): {
  panel_brand: string;
  inverter_brand: string;
  epc_vendor_name: string;
} {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
    return { panel_brand: "", inverter_brand: "", epc_vendor_name: "" };
  }
  const raw = (meta as Record<string, unknown>).installation_enrichment;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { panel_brand: "", inverter_brand: "", epc_vendor_name: "" };
  }
  const e = raw as Record<string, unknown>;
  return {
    panel_brand: typeof e.panel_brand === "string" ? e.panel_brand : "",
    inverter_brand: typeof e.inverter_brand === "string" ? e.inverter_brand : "",
    epc_vendor_name: typeof e.epc_vendor_name === "string" ? e.epc_vendor_name : "",
  };
}

/** Maps `customers` row to editable profile form state (onboarding + profile tab). */
export function customerRowToProfileForm(c: CustomerRow) {
  const a = parseAddr(c.service_default_address);
  const enr = readInstallationEnrichment(c.metadata);
  return {
    display_name: c.display_name ?? "",
    contact_email: c.contact_email ?? "",
    alternate_phone: c.alternate_phone ?? "",
    addr: a,
    capacity: c.solar_capacity_kw != null ? String(c.solar_capacity_kw) : "",
    panels: c.solar_panel_count != null ? String(c.solar_panel_count) : "",
    installationCategory: (c.installation_category as "residential" | "commercial" | "") ?? "",
    roofMaterial: (c.solar_roof_material as (typeof ROOF_MATERIALS)[number]["value"] | "") ?? "",
    roofType: c.solar_roof_type ?? "",
    roofAccess: c.safety_roof_access ?? "",
    water: c.safety_water_availability ?? "",
    hazards: c.safety_hazards ?? "",
    lastCleaning: dateToFormDate(c.last_cleaning_at),
    specialInstructions: c.notes ?? "",
    panelBrand: enr.panel_brand,
    inverterBrand: enr.inverter_brand,
    epcVendorName: enr.epc_vendor_name,
    lat: c.service_lat,
    lng: c.service_lng,
    accuracyM: c.location_accuracy_m,
  };
}
