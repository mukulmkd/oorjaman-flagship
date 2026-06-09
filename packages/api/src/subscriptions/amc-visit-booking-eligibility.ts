import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AmcWalletRow,
  BookingRow,
  Database,
  SubscriptionRow,
  SubscriptionVisitSlotRow,
} from "../database.types";
import { listVisibleBookings } from "../bookings/booking-api";
import { SupabaseApiError } from "../result";
import { getAmcWalletBySubscriptionId } from "../finance/amc-wallet-api";
import { listAmcVisitSlotsForSubscription } from "./amc-visit-slots";
import { listVisibleSubscriptions } from "./subscription-api";
import {
  getActiveSubscriptionForAddress,
  isSubscriptionActive,
  readBookingServiceAddressId,
  readSubscriptionServiceAddressId,
} from "./subscription-address";

export type AmcVisitBookingGate =
  | { kind: "none" }
  | { kind: "trialing"; subscription: SubscriptionRow }
  | {
      kind: "awaiting_setup";
      subscription: SubscriptionRow;
      reason: "payment";
    }
  | {
      kind: "awaiting_setup";
      subscription: SubscriptionRow;
      reason: "partner";
    }
  | {
      kind: "use_amc_slot";
      subscription: SubscriptionRow;
      nextSlot: SubscriptionVisitSlotRow;
      pendingSlotCount: number;
    }
  | {
      kind: "allowance_exhausted";
      subscription: SubscriptionRow;
      visitsIncluded: number;
    };

export type AmcAwaitingPartnerAssignmentGate = Extract<
  AmcVisitBookingGate,
  { kind: "awaiting_setup"; reason: "partner" }
>;

export function listPendingAmcVisitSlots(
  slots: SubscriptionVisitSlotRow[],
): SubscriptionVisitSlotRow[] {
  return [...slots]
    .filter((s) => s.status === "pending")
    .sort((a, b) => a.sequence - b.sequence);
}

function countScheduledOrCompletedAmcSlots(
  slots: SubscriptionVisitSlotRow[],
): number {
  return slots.filter((s) => s.status === "scheduled" || s.status === "completed").length;
}

/**
 * Paid one-time visits at the AMC address during the contract window that count
 * against the included visit allowance. Bookings before partner assignment are
 * excluded - ops delay should not burn prepaid AMC visits.
 */
export function countOneTimeVisitsAtAddressDuringAmc(
  bookings: BookingRow[],
  subscription: SubscriptionRow,
  serviceAddressId: string,
): number {
  const addrId = serviceAddressId.trim();
  if (!addrId) return 0;

  const partnerAssignedAt = subscription.assigned_vendor_at
    ? new Date(subscription.assigned_vendor_at).getTime()
    : null;
  if (partnerAssignedAt == null) return 0;

  const contractStart = new Date(subscription.starts_at).getTime();
  const contractEnd = new Date(subscription.ends_at).getTime();

  return bookings.filter((booking) => {
    if (booking.subscription_id != null) return false;
    if (booking.status === "cancelled") return false;

    const createdAt = new Date(booking.created_at).getTime();
    if (createdAt < partnerAssignedAt) return false;

    const scheduledAt = new Date(booking.scheduled_start).getTime();
    if (scheduledAt < contractStart || scheduledAt > contractEnd) return false;

    const bookingAddrId = readBookingServiceAddressId(booking.metadata);
    if (bookingAddrId) return bookingAddrId === addrId;

    const subAddrId = readSubscriptionServiceAddressId(subscription);
    return Boolean(subAddrId && subAddrId === addrId);
  }).length;
}

export function countAmcVisitsConsumedAtAddress(
  visitSlots: SubscriptionVisitSlotRow[],
  subscription: SubscriptionRow,
  bookings: BookingRow[],
  serviceAddressId: string,
): number {
  const slotsUsed = countScheduledOrCompletedAmcSlots(visitSlots);
  const oneTimeUsed = countOneTimeVisitsAtAddressDuringAmc(
    bookings,
    subscription,
    serviceAddressId,
  );
  return slotsUsed + oneTimeUsed;
}

export function readServiceAddressIdFromBookingMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const v = (metadata as Record<string, unknown>).service_address_id;
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export function resolveAmcVisitBookingGate(
  subscription: SubscriptionRow | null | undefined,
  visitSlots: SubscriptionVisitSlotRow[],
  options?: {
    wallet?: Pick<AmcWalletRow, "status"> | null;
    visitsConsumedAtAddress?: number;
  },
): AmcVisitBookingGate {
  if (!subscription || !isSubscriptionActive(subscription)) {
    return { kind: "none" };
  }

  if (subscription.status === "trialing") {
    return { kind: "trialing", subscription };
  }

  if (subscription.status !== "active") {
    return { kind: "none" };
  }

  const visitsIncluded = subscription.visits_included ?? 0;
  const visitsConsumed = options?.visitsConsumedAtAddress ?? countScheduledOrCompletedAmcSlots(visitSlots);
  if (visitsIncluded > 0 && visitsConsumed >= visitsIncluded) {
    return {
      kind: "allowance_exhausted",
      subscription,
      visitsIncluded,
    };
  }

  const pending = listPendingAmcVisitSlots(visitSlots);
  if (pending.length === 0) {
    return {
      kind: "allowance_exhausted",
      subscription,
      visitsIncluded,
    };
  }

  const walletFunded = options?.wallet?.status === "funded";
  if (!walletFunded) {
    return { kind: "awaiting_setup", subscription, reason: "payment" };
  }
  if (!subscription.assigned_vendor_id) {
    return { kind: "awaiting_setup", subscription, reason: "partner" };
  }

  return {
    kind: "use_amc_slot",
    subscription,
    nextSlot: pending[0]!,
    pendingSlotCount: pending.length,
  };
}

export async function resolveAmcVisitBookingGateForAddress(
  client: SupabaseClient<Database>,
  params: {
    subscriptions: SubscriptionRow[];
    serviceAddressId: string | null | undefined;
  },
): Promise<AmcVisitBookingGate> {
  const addrId = params.serviceAddressId?.trim();
  if (!addrId) return { kind: "none" };

  const subscription = getActiveSubscriptionForAddress(params.subscriptions, addrId);
  if (!subscription) return { kind: "none" };

  const [visitSlots, wallet, bookings] = await Promise.all([
    listAmcVisitSlotsForSubscription(client, subscription.id),
    getAmcWalletBySubscriptionId(client, subscription.id),
    listVisibleBookings(client, {
      from: subscription.starts_at,
      to: subscription.ends_at,
    }),
  ]);

  const visitsConsumedAtAddress = countAmcVisitsConsumedAtAddress(
    visitSlots,
    subscription,
    bookings,
    addrId,
  );

  return resolveAmcVisitBookingGate(subscription, visitSlots, {
    wallet,
    visitsConsumedAtAddress,
  });
}

/** Active AMC with included visits left - must schedule through AMC, not one-time checkout. */
export function customerMustUseAmcBookingFlow(gate: AmcVisitBookingGate): boolean {
  return gate.kind === "use_amc_slot";
}

/** Paid one-time checkout is allowed without AMC, after visits are used, or while AMC payment is pending. */
export function customerMayBookOneTimeVisit(gate: AmcVisitBookingGate): boolean {
  return (
    gate.kind === "none" ||
    gate.kind === "allowance_exhausted" ||
    gate.kind === "trialing" ||
    (gate.kind === "awaiting_setup" && gate.reason === "payment")
  );
}

/** Blocks paid one-time checkout when an AMC visit allowance should be used instead. */
export async function assertCustomerMayBookOneTimeVisit(
  client: SupabaseClient<Database>,
  params: {
    serviceAddressId: string | null | undefined;
  },
): Promise<void> {
  const addrId = params.serviceAddressId?.trim();
  if (!addrId) return;

  const subs = await listVisibleSubscriptions(client);

  const gate = await resolveAmcVisitBookingGateForAddress(client, {
    subscriptions: subs,
    serviceAddressId: addrId,
  });

  if (!customerMayBookOneTimeVisit(gate)) {
    const message = amcVisitBookingGateMessage(gate);
    throw new SupabaseApiError(
      message ?? "This address has an active AMC plan. Schedule from your AMC plan instead of a one-time booking.",
    );
  }
}

export function amcNoPlanPromptMessage(): string {
  return "You don't have an AMC plan for this address yet. Subscribe for included visits on a fixed schedule, or book a one-time visit at the standard rate.";
}

export function amcAllowanceExhaustedPromptMessage(
  gate: Extract<AmcVisitBookingGate, { kind: "allowance_exhausted" }>,
): string {
  const visits = gate.visitsIncluded;
  return `You've used all ${visits} included AMC visit${visits === 1 ? "" : "s"} for this address. Book a one-time visit at the standard rate, or renew your AMC for more included visits.`;
}

export function isAmcAwaitingPartnerAssignment(
  gate: AmcVisitBookingGate,
): gate is AmcAwaitingPartnerAssignmentGate {
  return gate.kind === "awaiting_setup" && gate.reason === "partner";
}

export function amcAwaitingPartnerAssignmentMessage(gate: AmcAwaitingPartnerAssignmentGate): string {
  const plan = gate.subscription.plan_name?.trim();
  const planLine = plan ? `Your ${plan} is confirmed and paid. ` : "Your AMC is confirmed and paid. ";
  return `${planLine}OorjaMan is assigning a dedicated service partner for your site. We'll notify you when you can schedule your included visits. Need cleaning sooner? Contact support and choose "Need urgent cleaning?" - it is billed separately at one-time rates and does not use your AMC visits.`;
}

/** Customer must pick AMC vs one-time before the booking wizard opens. */
export function bookVisitRequiresAmcChoiceGate(
  gate: AmcVisitBookingGate,
): boolean {
  if (isAmcAwaitingPartnerAssignment(gate)) return false;
  return (
    gate.kind === "none" ||
    gate.kind === "allowance_exhausted" ||
    gate.kind === "trialing" ||
    gate.kind === "awaiting_setup"
  );
}

export function amcVisitBookingGateMessage(gate: AmcVisitBookingGate): string | null {
  switch (gate.kind) {
    case "none":
      return null;
    case "allowance_exhausted":
      return amcAllowanceExhaustedPromptMessage(gate);
    case "trialing":
      return "Complete AMC payment to schedule your included visits.";
    case "awaiting_setup":
      return gate.reason === "payment"
        ? "Complete AMC payment to schedule your included visits."
        : "Your dedicated AMC partner is being assigned. We will notify you when you can schedule.";
    case "use_amc_slot":
      return `You have ${gate.pendingSlotCount} included AMC visit${gate.pendingSlotCount === 1 ? "" : "s"} left. Schedule from your plan - no separate payment for this visit.`;
    default:
      return null;
  }
}

export function subscriptionAddressIdForGate(
  subscription: SubscriptionRow,
): string | null {
  return readSubscriptionServiceAddressId(subscription);
}
