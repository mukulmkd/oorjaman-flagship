import type { CreateBookingInput } from "./booking-api";
import type { BookingStatus, CustomerRow, Json } from "../database.types";
import type { VendorRoutingReason } from "./vendor-fallback";
import { normalizePhoneE164 } from "../auth/auth-api";
import { normalizeCityKey } from "../pricing/pricing-engine";

/**
 * One-off checkout: booking exists before payment and stays here until payment succeeds.
 * Subscription-generated visits use {@link buildCustomerBookingCreateInput} with `initialStatus: "confirmed"`.
 */
export const CUSTOMER_BOOKING_PENDING_STATUS = "pending_payment" as const;

function parseAddressFields(addr: Json | null): {
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
} {
  if (!addr || typeof addr !== "object" || Array.isArray(addr)) {
    return { line1: "", line2: "", city: "", state: "", pincode: "" };
  }
  const o = addr as Record<string, unknown>;
  return {
    line1: typeof o.line1 === "string" ? o.line1 : "",
    line2: typeof o.line2 === "string" ? o.line2 : "",
    city: typeof o.city === "string" ? o.city : "",
    state: typeof o.state === "string" ? o.state : "",
    pincode: typeof o.pincode === "string" ? o.pincode : "",
  };
}

/**
 * Human-readable site line for booking payloads from stored `service_site_address` JSON
 * (subscription AMC metadata or booking rows).
 */
export function formattedSiteAddressFromJson(addr: Json | null): string {
  if (!addr || typeof addr !== "object" || Array.isArray(addr)) return "";
  const o = addr as Record<string, unknown>;
  if (typeof o.formatted === "string" && o.formatted.trim())
    return o.formatted.trim();
  const p = parseAddressFields(addr);
  const parts = [
    p.line1,
    p.line2,
    [p.city, p.state].filter(Boolean).join(", "),
    p.pincode,
  ].filter((s) => s.trim().length > 0);
  return parts.join("\n");
}

/** Multi-line string for form prefill from saved profile JSON. */
export function formatCustomerAddressMultiline(
  serviceDefaultAddress: Json | null,
): string {
  const p = parseAddressFields(serviceDefaultAddress);
  let siteLabel = "";
  if (
    serviceDefaultAddress &&
    typeof serviceDefaultAddress === "object" &&
    !Array.isArray(serviceDefaultAddress)
  ) {
    const raw = (serviceDefaultAddress as Record<string, unknown>).label;
    if (typeof raw === "string" && raw.trim()) siteLabel = raw.trim();
  }
  const parts = [
    ...(siteLabel ? [siteLabel] : []),
    p.line1,
    p.line2,
    [p.city, p.state].filter(Boolean).join(", "),
    p.pincode,
  ].filter((s) => s.trim().length > 0);
  return parts.join("\n");
}

/**
 * Persisted `service_site_address`: customer-confirmed text plus structured profile copy and GPS when available.
 */
export function buildServiceSiteAddressJson(params: {
  customer: CustomerRow | null;
  /** Required - what the customer entered on the booking flow (may match profile). */
  formattedSiteAddress: string;
}): Json {
  const trimmed = params.formattedSiteAddress.trim();
  const parsed = parseAddressFields(
    params.customer?.service_default_address ?? null,
  );
  const c = params.customer;

  return {
    formatted: trimmed,
    line1: parsed.line1.trim() || null,
    line2: parsed.line2.trim() || null,
    city: parsed.city.trim() || null,
    state: parsed.state.trim() || null,
    pincode: parsed.pincode.trim() || null,
    country: "India",
    lat: c?.service_lat ?? null,
    lng: c?.service_lng ?? null,
    location_accuracy_m: c?.location_accuracy_m ?? null,
    location_recorded_at: c?.location_recorded_at ?? null,
  };
}

export type VendorRoutingMeta = {
  requested_vendor_id: string | null;
  resolved_vendor_id: string | null;
  used_fallback: boolean;
  reason: VendorRoutingReason | "default_vendor_marketplace";
};

export type BookingRecipientMeta = {
  is_self: boolean;
  recipient_name: string | null;
  recipient_phone: string | null;
  recipient_alt_phone: string | null;
  relationship: string | null;
  notify_recipient: boolean;
};

export type BookingOpsMeta = {
  issue_count: number;
  last_issue_type: string | null;
  last_issue_note: string | null;
  last_issue_at: string | null;
  last_issue_by: string | null;
};

export function buildBookingRecipientMeta(input: {
  isSelf: boolean;
  recipientName?: string | null;
  recipientPhone?: string | null;
  recipientAltPhone?: string | null;
  relationship?: string | null;
  notifyRecipient?: boolean;
}): BookingRecipientMeta {
  const recipientPhoneRaw = input.recipientPhone?.trim() || "";
  const recipientAltPhoneRaw = input.recipientAltPhone?.trim() || "";
  const recipientPhone = recipientPhoneRaw
    ? normalizePhoneE164(recipientPhoneRaw)
    : null;
  const recipientAltPhone = recipientAltPhoneRaw
    ? normalizePhoneE164(recipientAltPhoneRaw)
    : null;
  return {
    is_self: input.isSelf,
    recipient_name: input.recipientName?.trim() || null,
    recipient_phone: recipientPhone,
    recipient_alt_phone: recipientAltPhone,
    relationship: input.relationship?.trim() || null,
    notify_recipient: input.notifyRecipient ?? false,
  };
}

export function readBookingRecipientMeta(
  metadata: Json | null | undefined,
): BookingRecipientMeta | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata))
    return null;
  const raw = (metadata as Record<string, unknown>).booking_recipient;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  return {
    is_self: o.is_self === true,
    recipient_name:
      typeof o.recipient_name === "string" ? o.recipient_name : null,
    recipient_phone:
      typeof o.recipient_phone === "string" ? o.recipient_phone : null,
    recipient_alt_phone:
      typeof o.recipient_alt_phone === "string" ? o.recipient_alt_phone : null,
    relationship: typeof o.relationship === "string" ? o.relationship : null,
    notify_recipient: o.notify_recipient === true,
  };
}

/**
 * First AMC visit row: paid/confirmed but `vendor_id` is null until ops floats to partners or assigns a vendor.
 */
export type BookingVendorRoutingMeta = {
  requestedVendorId: string | null;
  resolvedVendorId: string | null;
  usedFallback: boolean;
  reason: VendorRoutingReason | "default_vendor_marketplace" | null;
};

export function readBookingVendorRoutingMeta(
  metadata: Json | null | undefined,
): BookingVendorRoutingMeta | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata))
    return null;
  const raw = (metadata as Record<string, unknown>).vendor_routing;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const reasonRaw = o.reason;
  const reason =
    typeof reasonRaw === "string" &&
    (reasonRaw === "default_vendor_marketplace" ||
      reasonRaw === "preferred_ok" ||
      reasonRaw === "preferred_ineligible_customer_fallback" ||
      reasonRaw === "preferred_ineligible_platform_default" ||
      reasonRaw === "preferred_missing_customer_fallback" ||
      reasonRaw === "preferred_missing_platform_default" ||
      reasonRaw === "amc_awaiting_admin_marketplace")
      ? reasonRaw
      : null;
  return {
    requestedVendorId:
      typeof o.requested_vendor_id === "string" ? o.requested_vendor_id : null,
    resolvedVendorId:
      typeof o.resolved_vendor_id === "string" ? o.resolved_vendor_id : null,
    usedFallback: o.used_fallback === true,
    reason,
  };
}

/** Visit floated for OorjaMan ops / partner assignment (not a customer-picked partner at checkout). */
export function isDefaultVendorMarketplaceBooking(
  metadata: Json | null | undefined,
): boolean {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata))
    return false;
  const routing = readBookingVendorRoutingMeta(metadata);
  if (routing?.reason === "default_vendor_marketplace") return true;
  const mp = (metadata as Record<string, unknown>).marketplace;
  if (!mp || typeof mp !== "object" || Array.isArray(mp)) return false;
  return (mp as Record<string, unknown>).mode === "default_vendor";
}

export function isSubscriptionAmcAwaitingAdminFloat(
  metadata: Json | null | undefined,
): boolean {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata))
    return false;
  const m = metadata as Record<string, unknown>;
  if (m.source !== "subscription_amc") return false;
  const mp = m.marketplace;
  if (!mp || typeof mp !== "object" || Array.isArray(mp)) return false;
  const o = mp as Record<string, unknown>;
  return (
    o.mode === "default_vendor" &&
    o.awaiting_admin_float === true &&
    o.floated !== true
  );
}

export function readBookingOpsMeta(
  metadata: Json | null | undefined,
): BookingOpsMeta | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata))
    return null;
  const raw = (metadata as Record<string, unknown>).ops;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const issueCountRaw = o.issue_count;
  const issue_count =
    typeof issueCountRaw === "number" &&
    Number.isFinite(issueCountRaw) &&
    issueCountRaw >= 0
      ? Math.floor(issueCountRaw)
      : 0;
  return {
    issue_count,
    last_issue_type:
      typeof o.last_issue_type === "string" ? o.last_issue_type : null,
    last_issue_note:
      typeof o.last_issue_note === "string" ? o.last_issue_note : null,
    last_issue_at: typeof o.last_issue_at === "string" ? o.last_issue_at : null,
    last_issue_by: typeof o.last_issue_by === "string" ? o.last_issue_by : null,
  };
}

export function mergeBookingMetadata(
  base: Json,
  extra: Record<string, Json>,
): Json {
  const o =
    base && typeof base === "object" && !Array.isArray(base)
      ? { ...(base as Record<string, Json>) }
      : {};
  return { ...o, ...extra };
}

export function buildBookingMetadataFromCustomer(
  customer: CustomerRow | null,
): Json {
  const base: Record<string, Json> = {
    source: "customer_app",
    request_kind: "visit",
  };

  if (!customer) return base;

  base.solar_installation = {
    capacity_kw: customer.solar_capacity_kw,
    panel_count: customer.solar_panel_count,
    roof_type: customer.solar_roof_type,
  };

  base.site_safety = {
    roof_access: customer.safety_roof_access,
    water_availability: customer.safety_water_availability,
    hazards: customer.safety_hazards,
  };

  return base;
}

export function buildCustomerBookingCreateInput(params: {
  customerId: string;
  vendorId: string | null;
  scheduledStart: string;
  scheduledEnd: string;
  customer: CustomerRow | null;
  siteAddressText: string;
  customerNotes: string | null;
  vendorRouting?: VendorRoutingMeta | null;
  subscriptionId?: string | null;
  /** INR paise; stored in `bookings.estimated_price_cents` (legacy column name). */
  estimatedPricePaise?: number | null;
  /** Merged after routing metadata (e.g. AMC sequence / source override). */
  extraMetadata?: Record<string, Json> | null;
  /** Saved address book entry id for this visit (ties booking to an AMC address). */
  serviceAddressId?: string | null;
  /** Default `pending_payment`; AMC prepaid visits use `confirmed`. */
  initialStatus?: BookingStatus;
}): CreateBookingInput {
  const baseMeta = buildBookingMetadataFromCustomer(params.customer);
  const routingJson: Json | null =
    params.vendorRouting != null
      ? {
          requested_vendor_id: params.vendorRouting.requested_vendor_id,
          resolved_vendor_id: params.vendorRouting.resolved_vendor_id,
          used_fallback: params.vendorRouting.used_fallback,
          reason: params.vendorRouting.reason,
        }
      : null;
  let metadata =
    routingJson != null
      ? mergeBookingMetadata(baseMeta, { vendor_routing: routingJson })
      : baseMeta;
  if (params.extraMetadata && Object.keys(params.extraMetadata).length > 0) {
    metadata = mergeBookingMetadata(metadata, params.extraMetadata);
  }
  if (params.serviceAddressId?.trim()) {
    metadata = mergeBookingMetadata(metadata, {
      service_address_id: params.serviceAddressId.trim(),
    });
  }

  return {
    customer_id: params.customerId,
    vendor_id: params.vendorId,
    subscription_id: params.subscriptionId ?? null,
    scheduled_start: params.scheduledStart,
    scheduled_end: params.scheduledEnd,
    service_site_address: buildServiceSiteAddressJson({
      customer: params.customer,
      formattedSiteAddress: params.siteAddressText,
    }),
    service_type: "panel_cleaning",
    customer_notes: params.customerNotes,
    metadata,
    status: params.initialStatus ?? CUSTOMER_BOOKING_PENDING_STATUS,
    estimated_price_cents:
      params.estimatedPricePaise != null && params.estimatedPricePaise >= 0
        ? Math.round(params.estimatedPricePaise)
        : 0,
  };
}

/** City key aligned with Admin `pricing_city_tiers.city_key` (/ {@link normalizeCityKey}). */
export function serviceAddressCityKeyFromJson(
  addr: Json | null | undefined,
): string | null {
  const p = parseAddressFields(addr ?? null);
  return normalizeCityKey(p.city.trim() || undefined);
}
