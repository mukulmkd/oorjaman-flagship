import type { CustomerRow } from "../database.types";
import {
  ALLOWED_CAPACITY_KW,
  capacityKwFromTierCode,
  snapCapacityKwToAllowed,
  tierCodeFromCapacityKw,
  type AllowedCapacityKw,
} from "../pricing/capacity-pricing";

export { ALLOWED_CAPACITY_KW };

/** Same minimum as Profile save: installed kW and panel count must be saved on the customer row. */
export function customerHasSavedSolarSiteDetails(customer: CustomerRow | null | undefined): boolean {
  if (!customer) return false;
  const kw = customer.solar_capacity_kw;
  const panels = customer.solar_panel_count;
  return kw != null && Number.isFinite(Number(kw)) && Number(kw) > 0 && panels != null && Number(panels) > 0;
}

export type CustomerSolarSizingReady = {
  ready: true;
  capacityKw: number;
  panelCount: number;
  tierCode: string;
  snappedKw: AllowedCapacityKw;
  tierLabel: string;
};

export type CustomerSolarSizingBlocked =
  | { ready: false; reason: "missing_details" }
  | { ready: false; reason: "unsupported_kw"; capacityKw: number };

export type CustomerSolarSizing = CustomerSolarSizingReady | CustomerSolarSizingBlocked;

export function formatAllowedCapacityKwList(): string {
  return ALLOWED_CAPACITY_KW.map((k) => `${k} kW`).join(", ");
}

/**
 * Resolve AMC / one-time pricing tier from the same fields shown in Profile (solar_capacity_kw, solar_panel_count).
 */
export function getCustomerSolarSizing(customer: CustomerRow | null | undefined): CustomerSolarSizing {
  if (!customerHasSavedSolarSiteDetails(customer)) {
    return { ready: false, reason: "missing_details" };
  }
  const capacityKw = Number(customer!.solar_capacity_kw);
  const panelCount = Math.max(1, Math.round(Number(customer!.solar_panel_count)));
  const tierCode = tierCodeFromCapacityKw(capacityKw);
  if (!tierCode) {
    return { ready: false, reason: "unsupported_kw", capacityKw };
  }
  const snappedKw = capacityKwFromTierCode(tierCode)!;
  return {
    ready: true,
    capacityKw,
    panelCount,
    tierCode,
    snappedKw,
    tierLabel: `${snappedKw} kW`,
  };
}

/** Parse profile capacity field text; returns null if empty/invalid. */
export function parseProfileCapacityKwInput(raw: string): number | null {
  const t = raw.trim().replace(/,/g, "");
  if (!t) return null;
  const n = Number.parseFloat(t);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/** After parsing, snap to an allowed band for save (Profile should persist exact band values). */
export function snapProfileCapacityInputToAllowedKw(raw: string): AllowedCapacityKw | null {
  const n = parseProfileCapacityKwInput(raw);
  if (n == null) return null;
  return snapCapacityKwToAllowed(n);
}
