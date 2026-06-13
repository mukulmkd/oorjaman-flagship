import type { SupabaseClient } from "@supabase/supabase-js";
import type { CustomerRow, Database, Json } from "../database.types";
import { requireSessionUserId, SupabaseApiError, takeSingleRow } from "../result";
import { syncUserDisplayNameFromCustomer } from "../users/user-display-name";
import { getCustomerSolarSizing } from "./customer-solar-sizing";
import {
  realignActiveAmcSubscriptionsForCustomerCapacity,
  type AmcTierRealignmentSummary,
} from "../subscriptions/amc-tier-realignment";

/** Current user's customer profile (if role customer). */
export async function getMyCustomer(
  client: SupabaseClient<Database>,
): Promise<CustomerRow | null> {
  const { data: userData, error: userErr } = await client.auth.getUser();
  if (userErr) throw new SupabaseApiError(userErr.message, userErr);
  const uid = userData.user?.id;
  if (!uid) return null;

  const { data, error } = await client
    .from("customers")
    .select("*")
    .eq("user_id", uid)
    .maybeSingle();

  if (error) throw new SupabaseApiError(error.message, error);
  return data;
}

export async function ensureCustomerProfile(
  client: SupabaseClient<Database>,
  _input?: Pick<Database["public"]["Tables"]["customers"]["Insert"], "display_name" | "service_default_address" | "billing_address" | "notes">,
): Promise<CustomerRow> {
  const existing = await getMyCustomer(client);
  if (existing) {
    if (!existing.onboarding_completed_at) {
      throw new Error("Complete your customer profile before booking a visit.");
    }
    return existing;
  }

  throw new Error("Complete your customer profile before booking a visit.");
}

export async function updateMyCustomer(
  client: SupabaseClient<Database>,
  patch: Database["public"]["Tables"]["customers"]["Update"],
): Promise<CustomerRow> {
  const existing = await getMyCustomer(client);
  if (!existing) {
    throw new Error("No customer profile for current user");
  }

  const { data, error } = await client
    .from("customers")
    .update(patch)
    .eq("id", existing.id)
    .select()
    .single();

  const customer = takeSingleRow(data, error);
  if (patch.display_name !== undefined) {
    await syncUserDisplayNameFromCustomer(client, customer);
  }
  return customer;
}

/** Full registration payload saved to `customers` (service site + solar + safety). */
export type CustomerOnboardingPayload = {
  display_name: string;
  contact_email?: string | null;
  alternate_phone?: string | null;
  billing_address?: Json | null;
  service_default_address: Json;
  service_lat?: number | null;
  service_lng?: number | null;
  location_accuracy_m?: number | null;
  solar_capacity_kw?: number | null;
  solar_panel_count?: number | null;
  installation_category?: "residential" | "commercial" | null;
  solar_roof_type?: string | null;
  solar_roof_material?: "tin_metal" | "rcc" | "mixed" | "other" | null;
  last_cleaning_at?: string | null;
  safety_roof_access?: string | null;
  safety_water_availability?: string | null;
  safety_hazards?: string | null;
  /** Site access / height / electrical notes (stored in `notes`). */
  special_instructions?: string | null;
  /** Registration consents; merged into `metadata.registration`. */
  registration_consents?: {
    information_accurate: boolean;
    terms_safety_privacy: boolean;
    contact_for_scheduling: boolean;
  };
  /** Stored under `metadata.installation_enrichment` (panel / inverter / EPC). */
  panel_brand?: string | null;
  inverter_brand?: string | null;
  epc_vendor_name?: string | null;
};

/**
 * Insert or update the customer row and set `onboarding_completed_at` (end of progressive signup).
 */
function mergeCustomerMetadata(
  existing: Json | null | undefined,
  registration: CustomerOnboardingPayload["registration_consents"],
  completedAt: string,
): Json {
  const base =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...(existing as Record<string, Json>) }
      : {};
  const prevReg =
    base.registration && typeof base.registration === "object" && !Array.isArray(base.registration)
      ? { ...(base.registration as Record<string, Json>) }
      : {};
  if (
    !registration ||
    !registration.information_accurate ||
    !registration.terms_safety_privacy ||
    !registration.contact_for_scheduling
  ) {
    return { ...base, registration: prevReg } as Json;
  }
  return {
    ...base,
    registration: {
      ...prevReg,
      consents: {
        information_accurate: registration.information_accurate,
        terms_safety_privacy: registration.terms_safety_privacy,
        contact_for_scheduling: registration.contact_for_scheduling,
        recorded_at: completedAt,
      },
    },
  } as Json;
}

function mergeInstallationEnrichment(
  baseMetadata: Json,
  input: Pick<CustomerOnboardingPayload, "panel_brand" | "inverter_brand" | "epc_vendor_name">,
): Json {
  const o =
    baseMetadata && typeof baseMetadata === "object" && !Array.isArray(baseMetadata)
      ? { ...(baseMetadata as Record<string, Json>) }
      : {};
  const ie: Record<string, string> = {};
  if (input.panel_brand?.trim()) ie.panel_brand = input.panel_brand.trim();
  if (input.inverter_brand?.trim()) ie.inverter_brand = input.inverter_brand.trim();
  if (input.epc_vendor_name?.trim()) ie.epc_vendor_name = input.epc_vendor_name.trim();
  if (Object.keys(ie).length === 0) {
    return baseMetadata;
  }
  return { ...o, installation_enrichment: ie as unknown as Json } as Json;
}

/**
 * When the customer edits `service_default_address` from Profile, keep `metadata.service_addresses`
 * default entry label (and nested `address.label`) aligned so address pickers read one source.
 */
function mergeServiceDefaultLabelIntoAddressBookMetadata(
  metadata: Json,
  serviceDefaultAddress: Json | null | undefined,
): Json {
  const sd = serviceDefaultAddress;
  let siteLabel: string | null = null;
  if (sd && typeof sd === "object" && !Array.isArray(sd)) {
    const l = (sd as Record<string, unknown>).label;
    if (typeof l === "string" && l.trim()) siteLabel = l.trim();
  }
  if (!siteLabel) return metadata;

  const m =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? { ...(metadata as Record<string, Json>) }
      : {};
  const defaultIdRaw = m.default_service_address_id;
  const defaultId = typeof defaultIdRaw === "string" ? defaultIdRaw : null;
  const raw = m.service_addresses;
  if (!defaultId || !Array.isArray(raw) || raw.length === 0) return metadata;

  const nextAddresses = raw.map((r) => {
    if (!r || typeof r !== "object" || Array.isArray(r)) return r;
    const o = r as Record<string, unknown>;
    if (typeof o.id !== "string" || o.id !== defaultId) return r;
    const prevAddr = o.address;
    const nextAddr =
      prevAddr && typeof prevAddr === "object" && !Array.isArray(prevAddr)
        ? ({ ...(prevAddr as Record<string, unknown>), label: siteLabel } as Json)
        : prevAddr;
    return { ...o, label: siteLabel, address: nextAddr } as Json;
  });
  return { ...m, service_addresses: nextAddresses as unknown as Json } as Json;
}

/** Profile edits: replace `installation_enrichment` (clears subtree when all brands empty). */
function replaceInstallationEnrichment(
  existingMeta: Json | null | undefined,
  brands: Pick<CustomerOnboardingPayload, "panel_brand" | "inverter_brand" | "epc_vendor_name">,
): Json {
  const base =
    existingMeta && typeof existingMeta === "object" && !Array.isArray(existingMeta)
      ? { ...(existingMeta as Record<string, Json>) }
      : {};
  const ie: Record<string, string> = {};
  if (brands.panel_brand?.trim()) ie.panel_brand = brands.panel_brand.trim();
  if (brands.inverter_brand?.trim()) ie.inverter_brand = brands.inverter_brand.trim();
  if (brands.epc_vendor_name?.trim()) ie.epc_vendor_name = brands.epc_vendor_name.trim();
  const next = { ...base } as Record<string, Json>;
  if (Object.keys(ie).length === 0) {
    delete next.installation_enrichment;
  } else {
    next.installation_enrichment = ie as unknown as Json;
  }
  return next as Json;
}

/** Same fields as onboarding without consents - for edits after `onboarding_completed_at` is set. */
export type CustomerProfileUpdatePayload = Omit<CustomerOnboardingPayload, "registration_consents">;

/**
 * Update saved site profile (after onboarding). Does not change registration consent metadata.
 */
export type CustomerProfileUpdateResult = {
  customer: CustomerRow;
  amc_realignments: AmcTierRealignmentSummary[];
};

export async function updateCustomerProfileAfterOnboarding(
  client: SupabaseClient<Database>,
  input: CustomerProfileUpdatePayload,
): Promise<CustomerProfileUpdateResult> {
  const existing = await getMyCustomer(client);
  if (!existing) {
    throw new SupabaseApiError("No customer profile for current user.");
  }
  if (!existing.onboarding_completed_at) {
    throw new SupabaseApiError("Complete onboarding before editing your profile.");
  }

  const now = new Date().toISOString();
  const hasPin = input.service_lat != null && input.service_lng != null;
  let metadata = replaceInstallationEnrichment(existing.metadata, {
    panel_brand: input.panel_brand,
    inverter_brand: input.inverter_brand,
    epc_vendor_name: input.epc_vendor_name,
  });
  metadata = mergeServiceDefaultLabelIntoAddressBookMetadata(metadata, input.service_default_address);

  const { data, error } = await client
    .from("customers")
    .update({
      display_name: input.display_name.trim(),
      contact_email: input.contact_email?.trim() ?? null,
      alternate_phone: input.alternate_phone?.trim() || null,
      billing_address: input.billing_address ?? null,
      service_default_address: input.service_default_address,
      service_lat: input.service_lat ?? null,
      service_lng: input.service_lng ?? null,
      location_accuracy_m: hasPin ? input.location_accuracy_m ?? null : null,
      location_recorded_at: hasPin ? now : null,
      solar_capacity_kw: input.solar_capacity_kw ?? null,
      solar_panel_count: input.solar_panel_count ?? null,
      installation_category: input.installation_category ?? null,
      solar_roof_type: input.solar_roof_type ?? null,
      solar_roof_material: input.solar_roof_material ?? null,
      last_cleaning_at: input.last_cleaning_at?.trim() || null,
      safety_roof_access: input.safety_roof_access ?? null,
      safety_water_availability: input.safety_water_availability ?? null,
      safety_hazards: input.safety_hazards?.trim() ?? null,
      notes: input.special_instructions?.trim() || null,
      metadata,
    })
    .eq("id", existing.id)
    .select()
    .single();

  const customer = takeSingleRow(data, error);
  await syncUserDisplayNameFromCustomer(client, customer);
  const prevSizing = getCustomerSolarSizing(existing);
  const nextSizing = getCustomerSolarSizing(customer);
  let amc_realignments: AmcTierRealignmentSummary[] = [];
  if (
    prevSizing.ready &&
    nextSizing.ready &&
    prevSizing.tierCode !== nextSizing.tierCode &&
    input.solar_capacity_kw != null
  ) {
    amc_realignments = await realignActiveAmcSubscriptionsForCustomerCapacity(client, customer);
  }
  return { customer, amc_realignments };
}

export async function completeCustomerOnboarding(
  client: SupabaseClient<Database>,
  input: CustomerOnboardingPayload,
): Promise<CustomerRow> {
  const { data: userData, error: userErr } = await client.auth.getUser();
  if (userErr) throw new SupabaseApiError(userErr.message, userErr);
  const userId = requireSessionUserId(userData.user?.id);

  const now = new Date().toISOString();
  const hasPin = input.service_lat != null && input.service_lng != null;

  const existing = await getMyCustomer(client);
  let metadata = mergeCustomerMetadata(existing?.metadata, input.registration_consents, now);
  metadata = mergeInstallationEnrichment(metadata, input);

  const row: Omit<Database["public"]["Tables"]["customers"]["Insert"], "id"> = {
    user_id: userId,
    display_name: input.display_name.trim(),
    contact_email: input.contact_email?.trim() ?? null,
    alternate_phone: input.alternate_phone?.trim() || null,
    billing_address: input.billing_address ?? null,
    service_default_address: input.service_default_address,
    service_lat: input.service_lat ?? null,
    service_lng: input.service_lng ?? null,
    location_accuracy_m: input.location_accuracy_m ?? null,
    location_recorded_at: hasPin ? now : null,
    solar_capacity_kw: input.solar_capacity_kw ?? null,
    solar_panel_count: input.solar_panel_count ?? null,
    installation_category: input.installation_category ?? null,
    solar_roof_type: input.solar_roof_type ?? null,
    solar_roof_material: input.solar_roof_material ?? null,
    last_cleaning_at: input.last_cleaning_at?.trim() || null,
    safety_roof_access: input.safety_roof_access ?? null,
    safety_water_availability: input.safety_water_availability ?? null,
    safety_hazards: input.safety_hazards?.trim() ?? null,
    onboarding_completed_at: now,
    notes: input.special_instructions?.trim() || null,
    metadata,
  };

  if (!existing) {
    const { data, error } = await client.from("customers").insert(row).select().single();
    const customer = takeSingleRow(data, error);
    await syncUserDisplayNameFromCustomer(client, customer);
    return customer;
  }

  const { data, error } = await client
    .from("customers")
    .update({
      display_name: row.display_name,
      contact_email: row.contact_email,
      alternate_phone: row.alternate_phone,
      billing_address: row.billing_address,
      service_default_address: row.service_default_address,
      service_lat: row.service_lat,
      service_lng: row.service_lng,
      location_accuracy_m: row.location_accuracy_m,
      location_recorded_at: row.location_recorded_at,
      solar_capacity_kw: row.solar_capacity_kw,
      solar_panel_count: row.solar_panel_count,
      installation_category: row.installation_category,
      solar_roof_type: row.solar_roof_type,
      solar_roof_material: row.solar_roof_material,
      last_cleaning_at: row.last_cleaning_at,
      safety_roof_access: row.safety_roof_access,
      safety_water_availability: row.safety_water_availability,
      safety_hazards: row.safety_hazards,
      onboarding_completed_at: row.onboarding_completed_at,
      notes: row.notes,
      metadata: row.metadata,
    })
    .eq("id", existing.id)
    .select()
    .single();

  const customer = takeSingleRow(data, error);
  await syncUserDisplayNameFromCustomer(client, customer);
  return customer;
}

/** Narrow customer fields for vendor views (RLS: booking must link vendor to customer). */
export async function getCustomerSummaryById(
  client: SupabaseClient<Database>,
  customerId: string,
): Promise<Pick<CustomerRow, "display_name" | "contact_email"> | null> {
  const { data, error } = await client
    .from("customers")
    .select("display_name, contact_email")
    .eq("id", customerId)
    .maybeSingle();

  if (error) throw new SupabaseApiError(error.message, error);
  return data;
}
