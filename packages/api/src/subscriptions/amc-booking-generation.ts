import type { SupabaseClient } from "@supabase/supabase-js";
import { createBookingAsCustomer } from "../bookings/booking-api";
import {
  buildCustomerBookingCreateInput,
  formattedSiteAddressFromJson,
} from "../bookings/customer-booking-payload";
import { resolveBookingVendor } from "../bookings/vendor-fallback";
import type { BookingRow, CustomerRow, Database, Json, SubscriptionRow, VendorRow } from "../database.types";
import { getBookingRoutingDefaults } from "../platform/platform-settings-api";
import { SupabaseApiError } from "../result";
import * as vendorApi from "../vendors/vendor-api";
import { customerLocationSignalsFromCustomer } from "../vendors/vendor-service-area";
import { readServiceSiteAddressFromSubscription } from "./subscription-address";

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

/**
 * Evenly spaces AMC visits across the subscription contract window (from `starts_at`).
 * Does not modify existing one-time bookings — those stay separate (forward-only AMC policy).
 */
export function computeAmcVisitSlots(
  sub: SubscriptionRow,
): Array<{ scheduled_start: string; scheduled_end: string }> {
  const visits = sub.visits_included ?? 0;
  if (visits <= 0) return [];

  const startsAt = new Date(sub.starts_at);
  const endsAt = new Date(sub.ends_at);
  const out: Array<{ scheduled_start: string; scheduled_end: string }> = [];

  const totalMs = endsAt.getTime() - startsAt.getTime();
  const stepMs = Math.max(totalMs / Math.max(visits, 1), 24 * 60 * 60 * 1000);

  for (let i = 0; i < visits; i++) {
    const vStart = new Date(startsAt.getTime() + stepMs * i);
    if (vStart >= endsAt) break;

    let vEnd = new Date(vStart.getTime() + TWO_HOURS_MS);
    if (vEnd > endsAt) vEnd = endsAt;
    if (vEnd <= vStart) break;

    out.push({
      scheduled_start: vStart.toISOString(),
      scheduled_end: vEnd.toISOString(),
    });
  }

  return out;
}

function readPreferredVendorIdFromMetadata(metadata: Json): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const v = (metadata as Record<string, unknown>).preferred_vendor_id;
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(t)) {
    return null;
  }
  return t;
}

function sortVendorsByName(vendors: VendorRow[]): VendorRow[] {
  return [...vendors].sort((a, b) => a.business_name.localeCompare(b.business_name));
}

function pickAmcRequestedVendorDisplayId(params: {
  metadataPreferred: string | null;
  platformDefaultVendorId: string | null;
  approvedSorted: VendorRow[];
}): string | null {
  if (params.metadataPreferred) return params.metadataPreferred;
  if (params.platformDefaultVendorId) {
    const byId = new Map(params.approvedSorted.map((v) => [v.id, v]));
    if (byId.has(params.platformDefaultVendorId)) return params.platformDefaultVendorId;
  }
  return params.approvedSorted[0]?.id ?? null;
}

function pickRequestedVendorIdForAmc(params: {
  metadataPreferred: string | null;
  platformDefaultVendorId: string | null;
  approvedSorted: VendorRow[];
}): string {
  const display = pickAmcRequestedVendorDisplayId(params);
  if (display) return display;
  const first = params.approvedSorted[0];
  if (!first) {
    throw new SupabaseApiError("No approved partners available for AMC scheduling.");
  }
  return first.id;
}

/**
 * @deprecated Removed — AMC bookings are created only via {@link scheduleAmcVisitSlot}.
 */
export async function syncAmcBookingsForSubscription(
  _client: SupabaseClient<Database>,
  _subscription: SubscriptionRow,
): Promise<BookingRow[]> {
  throw new SupabaseApiError(
    "Auto-generating AMC bookings is disabled. Customers schedule each visit from their AMC plan.",
  );
}

/** @internal Legacy implementation retained for reference only. */
async function _syncAmcBookingsForSubscriptionLegacy(
  client: SupabaseClient<Database>,
  subscription: SubscriptionRow,
): Promise<BookingRow[]> {
  const { data: existing, error: existingErr } = await client
    .from("bookings")
    .select("id")
    .eq("subscription_id", subscription.id)
    .limit(1);

  if (existingErr) throw new SupabaseApiError(existingErr.message, existingErr);
  if (existing && existing.length > 0) return [];

  const { data: customerRow, error: custErr } = await client
    .from("customers")
    .select("*")
    .eq("id", subscription.customer_id)
    .maybeSingle();

  if (custErr) throw new SupabaseApiError(custErr.message, custErr);
  const customer = customerRow as CustomerRow | null;

  const addrJson = readServiceSiteAddressFromSubscription(customer, subscription);
  if (addrJson == null) {
    throw new SupabaseApiError(
      "AMC subscription has no service address - cannot schedule visits.",
    );
  }

  const slots = computeAmcVisitSlots(subscription);
  if (slots.length === 0) return [];

  const [defaults, approved] = await Promise.all([
    getBookingRoutingDefaults(client),
    vendorApi.listApprovedVendors(client),
  ]);

  const approvedSorted = sortVendorsByName(approved);
  const preferredFromMeta = readPreferredVendorIdFromMetadata(subscription.metadata);
  const requestedVendorId = pickRequestedVendorIdForAmc({
    metadataPreferred: preferredFromMeta,
    platformDefaultVendorId: defaults.defaultVendorId,
    approvedSorted,
  });

  const signals = customerLocationSignalsFromCustomer(customer);
  const routing =
    slots.length > 1
      ? resolveBookingVendor({
          requestedVendorId,
          customerFallbackVendorId: null,
          platformDefaultVendorId: defaults.defaultVendorId,
          signals,
          approvedVendors: approvedSorted,
        })
      : null;

  const siteText = formattedSiteAddressFromJson(addrJson);
  if (!siteText.trim()) {
    throw new SupabaseApiError("AMC service_site_address could not be formatted for booking.");
  }

  const created: BookingRow[] = [];
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i]!;
    if (i === 0) {
      const requestedDisplay = pickAmcRequestedVendorDisplayId({
        metadataPreferred: preferredFromMeta,
        platformDefaultVendorId: defaults.defaultVendorId,
        approvedSorted,
      });
      const payload = buildCustomerBookingCreateInput({
        customerId: subscription.customer_id,
        vendorId: null,
        scheduledStart: slot.scheduled_start,
        scheduledEnd: slot.scheduled_end,
        customer,
        siteAddressText: siteText,
        customerNotes: "Auto-scheduled AMC cleaning visit",
        vendorRouting: {
          requested_vendor_id: requestedDisplay,
          resolved_vendor_id: null,
          used_fallback: false,
          reason: "amc_awaiting_admin_marketplace",
        },
        subscriptionId: subscription.id,
        initialStatus: "confirmed",
        extraMetadata: {
          source: "subscription_amc",
          sequence: 1,
          subscription_plan: subscription.plan_code,
          marketplace: {
            mode: "default_vendor",
            floated: false,
            awaiting_admin_float: true,
          },
          ...(subscription.service_address_id
            ? { service_address_id: subscription.service_address_id }
            : {}),
        },
      });
      created.push(await createBookingAsCustomer(client, payload));
      continue;
    }

    const r = routing!;
    const payload = buildCustomerBookingCreateInput({
      customerId: subscription.customer_id,
      vendorId: r.resolvedVendorId,
      scheduledStart: slot.scheduled_start,
      scheduledEnd: slot.scheduled_end,
      customer,
      siteAddressText: siteText,
      customerNotes: "Auto-scheduled AMC cleaning visit",
      vendorRouting: {
        requested_vendor_id: r.requestedVendorId,
        resolved_vendor_id: r.resolvedVendorId,
        used_fallback: r.usedFallback,
        reason: r.reason,
      },
      subscriptionId: subscription.id,
      initialStatus: "confirmed",
      extraMetadata: {
        source: "subscription_amc",
        sequence: i + 1,
        subscription_plan: subscription.plan_code,
        ...(subscription.service_address_id
          ? { service_address_id: subscription.service_address_id }
          : {}),
      },
    });

    created.push(await createBookingAsCustomer(client, payload));
  }

  return created;
}
