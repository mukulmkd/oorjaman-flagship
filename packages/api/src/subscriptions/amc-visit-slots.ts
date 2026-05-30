import type { SupabaseClient } from "@supabase/supabase-js";
import { createBookingAsCustomer } from "../bookings/booking-api";
import {
  buildCustomerBookingCreateInput,
  formattedSiteAddressFromJson,
  type VendorRoutingMeta,
} from "../bookings/customer-booking-payload";
import type { VendorRoutingReason } from "../bookings/vendor-fallback";
import type {
  BookingRow,
  CustomerRow,
  Database,
  Json,
  SubscriptionRow,
  SubscriptionVisitSlotRow,
  SubscriptionVisitSlotStatus,
  VendorRow,
} from "../database.types";
import { getBookingRoutingDefaults } from "../platform/platform-settings-api";
import { SupabaseApiError, takeRows, takeSingleRow } from "../result";
import * as vendorApi from "../vendors/vendor-api";
import { customerLocationSignalsFromCustomer } from "../vendors/vendor-service-area";
import { computeAmcVisitSlots } from "./amc-booking-generation";
import { readServiceSiteAddressFromSubscription } from "./subscription-address";

export type ScheduleAmcVisitSlotInput = {
  slotId: string;
  scheduledStart: string;
  scheduledEnd: string;
  scheduleSlotMeta: Json;
  siteAddressText: string;
  serviceAddressId?: string | null;
  customerNotes?: string | null;
  bookingRecipient?: Json;
  vendorPick:
    | { mode: "any" }
    | {
        mode: "preferred";
        requestedVendorId: string;
        resolvedVendorId: string | null;
        usedFallback: boolean;
        reason: VendorRoutingReason | "default_vendor_marketplace";
        preferredUnavailable: boolean;
        marketplaceFilterPincode: string | null;
        marketplaceFilterCity: string | null;
      };
};

function readPreferredVendorIdFromMetadata(metadata: Json): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata))
    return null;
  const v = (metadata as Record<string, unknown>).preferred_vendor_id;
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      t,
    )
  ) {
    return null;
  }
  return t;
}

function sortVendorsByName(vendors: VendorRow[]): VendorRow[] {
  return [...vendors].sort((a, b) =>
    a.business_name.localeCompare(b.business_name),
  );
}

function pickAmcRequestedVendorDisplayId(params: {
  metadataPreferred: string | null;
  platformDefaultVendorId: string | null;
  approvedSorted: VendorRow[];
}): string | null {
  if (params.metadataPreferred) return params.metadataPreferred;
  if (params.platformDefaultVendorId) {
    const byId = new Map(params.approvedSorted.map((v) => [v.id, v]));
    if (byId.has(params.platformDefaultVendorId))
      return params.platformDefaultVendorId;
  }
  return params.approvedSorted[0]?.id ?? null;
}

/**
 * Creates ideal-date visit placeholders when a customer subscribes. No booking rows or reference codes yet.
 */
export async function syncAmcVisitSlotsForSubscription(
  client: SupabaseClient<Database>,
  subscription: SubscriptionRow,
): Promise<SubscriptionVisitSlotRow[]> {
  const { data: existing, error: existingErr } = await client
    .from("subscription_visit_slots")
    .select("id")
    .eq("subscription_id", subscription.id)
    .limit(1);

  if (existingErr) throw new SupabaseApiError(existingErr.message, existingErr);
  if (existing && existing.length > 0)
    return listAmcVisitSlotsForSubscription(client, subscription.id);

  const slots = computeAmcVisitSlots(subscription);
  if (slots.length === 0) return [];

  const rows = slots.map((slot, index) => ({
    subscription_id: subscription.id,
    sequence: index + 1,
    ideal_scheduled_start: slot.scheduled_start,
    ideal_scheduled_end: slot.scheduled_end,
    status: "pending" as SubscriptionVisitSlotStatus,
  }));

  const { data, error } = await client
    .from("subscription_visit_slots")
    .insert(rows)
    .select();
  return takeRows(data, error);
}

export async function listAmcVisitSlotsForSubscription(
  client: SupabaseClient<Database>,
  subscriptionId: string,
): Promise<SubscriptionVisitSlotRow[]> {
  const { data, error } = await client
    .from("subscription_visit_slots")
    .select("*")
    .eq("subscription_id", subscriptionId)
    .order("sequence", { ascending: true });

  return takeRows(data, error);
}

export async function getAmcVisitSlotById(
  client: SupabaseClient<Database>,
  slotId: string,
): Promise<SubscriptionVisitSlotRow> {
  const { data, error } = await client
    .from("subscription_visit_slots")
    .select("*")
    .eq("id", slotId)
    .single();

  return takeSingleRow(data, error);
}

async function subscriptionHasCustomerScheduledAmcVisit(
  client: SupabaseClient<Database>,
  subscriptionId: string,
): Promise<boolean> {
  const { count, error } = await client
    .from("subscription_visit_slots")
    .select("id", { count: "exact", head: true })
    .eq("subscription_id", subscriptionId)
    .not("booking_id", "is", null)
    .neq("status", "pending");

  if (error) throw new SupabaseApiError(error.message, error);
  return (count ?? 0) > 0;
}

/**
 * Customer picks a time for a pending AMC slot → creates booking (with reference code) and links the slot.
 */
export async function scheduleAmcVisitSlot(
  client: SupabaseClient<Database>,
  input: ScheduleAmcVisitSlotInput,
): Promise<{ booking: BookingRow; slot: SubscriptionVisitSlotRow }> {
  const slot = await getAmcVisitSlotById(client, input.slotId);
  if (slot.status !== "pending") {
    throw new SupabaseApiError(
      "This AMC visit is already scheduled or completed.",
    );
  }

  const { data: subRow, error: subErr } = await client
    .from("subscriptions")
    .select("*")
    .eq("id", slot.subscription_id)
    .single();
  if (subErr) throw new SupabaseApiError(subErr.message, subErr);
  const subscription = subRow as SubscriptionRow;

  if (!["active", "trialing"].includes(subscription.status)) {
    throw new SupabaseApiError("This AMC plan is no longer active.");
  }

  const { data: customerRow, error: custErr } = await client
    .from("customers")
    .select("*")
    .eq("id", subscription.customer_id)
    .maybeSingle();
  if (custErr) throw new SupabaseApiError(custErr.message, custErr);
  const customer = customerRow as CustomerRow | null;

  const addrJson = readServiceSiteAddressFromSubscription(
    customer,
    subscription,
  );
  if (addrJson == null) {
    throw new SupabaseApiError(
      "AMC subscription has no service address - update Profile and try again.",
    );
  }

  const siteText =
    input.siteAddressText.trim() || formattedSiteAddressFromJson(addrJson);
  if (!siteText.trim()) {
    throw new SupabaseApiError("Enter the service site address.");
  }

  const isFirstAmcBooking = !(await subscriptionHasCustomerScheduledAmcVisit(
    client,
    subscription.id,
  ));
  const nowIso = new Date().toISOString();
  const serviceAddressId =
    input.serviceAddressId?.trim() ||
    subscription.service_address_id?.trim() ||
    null;

  let vendorId: string | null = null;
  let vendorRouting: VendorRoutingMeta;
  const extraMetadata: Record<string, Json> = {
    source: "subscription_amc",
    customer_scheduled_amc: true,
    sequence: slot.sequence,
    subscription_plan: subscription.plan_code,
    schedule_slot: input.scheduleSlotMeta,
    ...(input.bookingRecipient
      ? { booking_recipient: input.bookingRecipient }
      : {}),
    ...(serviceAddressId ? { service_address_id: serviceAddressId } : {}),
  };

  if (input.vendorPick.mode === "any") {
    const [defaults, approved] = await Promise.all([
      getBookingRoutingDefaults(client),
      vendorApi.listApprovedVendors(client),
    ]);
    const requestedDisplay = pickAmcRequestedVendorDisplayId({
      metadataPreferred: readPreferredVendorIdFromMetadata(
        subscription.metadata,
      ),
      platformDefaultVendorId: defaults.defaultVendorId,
      approvedSorted: sortVendorsByName(approved),
    });
    vendorId = null;
    vendorRouting = {
      requested_vendor_id: requestedDisplay,
      resolved_vendor_id: null,
      used_fallback: true,
      reason: isFirstAmcBooking
        ? "amc_awaiting_admin_marketplace"
        : "default_vendor_marketplace",
    };
    if (isFirstAmcBooking) {
      extraMetadata.marketplace = {
        mode: "default_vendor",
        floated: false,
        awaiting_admin_float: true,
      };
    } else {
      extraMetadata.marketplace = {
        mode: "default_vendor",
        floated: false,
        awaiting_admin_float: true,
        accept_window_hours: 1,
        post_7pm_admin_queue: true,
      };
    }
  } else {
    const pick = input.vendorPick;
    const useDefaultMarketplace = pick.preferredUnavailable;
    vendorId = useDefaultMarketplace ? null : pick.resolvedVendorId;
    vendorRouting = {
      requested_vendor_id: pick.requestedVendorId,
      resolved_vendor_id: useDefaultMarketplace ? null : pick.resolvedVendorId,
      used_fallback: useDefaultMarketplace,
      reason: useDefaultMarketplace
        ? "default_vendor_marketplace"
        : pick.reason,
    };
    if (useDefaultMarketplace) {
      extraMetadata.marketplace = {
        mode: "default_vendor",
        floated: false,
        awaiting_admin_float: true,
        accept_window_hours: 1,
        post_7pm_admin_queue: true,
        auto_routed_from_preferred_unavailable: true,
        broadcast_filter: "customer_pin",
        filter_pincode: pick.marketplaceFilterPincode,
        filter_city: pick.marketplaceFilterCity,
      };
    } else {
      extraMetadata.vendor_response = {
        anchor_at: nowIso,
      } as Json;
    }
  }

  const payload = buildCustomerBookingCreateInput({
    customerId: subscription.customer_id,
    vendorId,
    scheduledStart: input.scheduledStart,
    scheduledEnd: input.scheduledEnd,
    customer,
    siteAddressText: siteText,
    customerNotes: input.customerNotes ?? null,
    vendorRouting,
    subscriptionId: subscription.id,
    initialStatus: "confirmed",
    serviceAddressId,
    extraMetadata,
  });

  const booking = await createBookingAsCustomer(client, payload);

  const { data: updatedSlot, error: slotErr } = await client
    .from("subscription_visit_slots")
    .update({
      booking_id: booking.id,
      status: "scheduled",
    })
    .eq("id", slot.id)
    .eq("status", "pending")
    .select()
    .single();

  if (slotErr) throw new SupabaseApiError(slotErr.message, slotErr);

  const cap = subscription.visits_included;
  const nextUsed = subscription.visits_used + 1;
  if (cap == null || nextUsed <= cap) {
    await client
      .from("subscriptions")
      .update({ visits_used: nextUsed })
      .eq("id", subscription.id);
  }

  return { booking, slot: takeSingleRow(updatedSlot, slotErr) };
}
