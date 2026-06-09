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
} from "../database.types";
import { SupabaseApiError, takeRows, takeSingleRow } from "../result";
import { getAmcWalletBySubscriptionId } from "../finance/amc-wallet-api";
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

  if (subscription.status !== "active") {
    throw new SupabaseApiError("This AMC plan is not active yet. Complete payment and partner assignment first.");
  }

  if (!subscription.assigned_vendor_id) {
    throw new SupabaseApiError(
      "Your dedicated AMC partner has not been assigned yet. We will notify you when you can schedule visits.",
    );
  }

  const wallet = await getAmcWalletBySubscriptionId(client, subscription.id);
  if (!wallet || wallet.status !== "funded") {
    throw new SupabaseApiError("AMC payment is required before scheduling visits.");
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

  const nowIso = new Date().toISOString();
  const serviceAddressId =
    input.serviceAddressId?.trim() ||
    subscription.service_address_id?.trim() ||
    null;

  const assignedVendorId = subscription.assigned_vendor_id!;
  const vendorId = assignedVendorId;
  const vendorRouting: VendorRoutingMeta = {
    requested_vendor_id: assignedVendorId,
    resolved_vendor_id: assignedVendorId,
    used_fallback: false,
    reason: "amc_assigned_partner",
  };
  const extraMetadata: Record<string, Json> = {
    source: "subscription_amc",
    customer_scheduled_amc: true,
    amc_assigned_vendor_id: assignedVendorId,
    sequence: slot.sequence,
    subscription_plan: subscription.plan_code,
    schedule_slot: input.scheduleSlotMeta,
    vendor_response: { anchor_at: nowIso } as Json,
    ...(input.bookingRecipient
      ? { booking_recipient: input.bookingRecipient }
      : {}),
    ...(serviceAddressId ? { service_address_id: serviceAddressId } : {}),
  };

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
