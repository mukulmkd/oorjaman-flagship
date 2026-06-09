import { router } from "expo-router";
import {
  amcVisitBookingGateMessage,
  bookVisitRequiresAmcChoiceGate,
  customerMustUseAmcBookingFlow,
  getActiveSubscriptionForAddress,
  resolveAmcVisitBookingGateForAddress,
  subscriptionAddressIdForGate,
  subscriptionApi,
  type AmcVisitBookingGate,
  type CustomerRow,
  type SubscriptionRow,
} from "@oorjaman/api";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readServiceAddressBook } from "./service-address-book";

function serviceAddressIdForCustomer(customer: CustomerRow | null | undefined): string | null {
  const book = readServiceAddressBook(customer ?? null);
  return book.defaultId ?? book.entries[0]?.id ?? null;
}

export async function resolveBookVisitGateForCustomer(
  supabase: SupabaseClient,
  customer: CustomerRow | null | undefined,
  subscriptions: SubscriptionRow[] | null | undefined,
  serviceAddressId?: string | null,
): Promise<AmcVisitBookingGate> {
  const addrId = serviceAddressId?.trim() || serviceAddressIdForCustomer(customer);
  if (!addrId) return { kind: "none" };
  return resolveAmcVisitBookingGateForAddress(supabase, {
    subscriptions: subscriptions ?? [],
    serviceAddressId: addrId,
  });
}

type BookVisitNavOptions = {
  serviceAddressId?: string | null;
};

export function bookVisitPaidHref(): string {
  return "/book?paidVisit=1";
}

export function amcPlanHref(serviceAddressId?: string | null): string {
  const q = new URLSearchParams();
  if (serviceAddressId?.trim()) q.set("addressId", serviceAddressId.trim());
  const query = q.toString();
  return query ? `/(main)/subscription?${query}` : "/(main)/subscription";
}

type AmcSubscriptionRouteParams = {
  addressId?: string;
  focus?: "upgrade";
};

function amcSubscriptionRoute(
  serviceAddressId?: string | null,
  options?: { focus?: "upgrade" },
): { pathname: "/(main)/subscription"; params?: AmcSubscriptionRouteParams } {
  const params: AmcSubscriptionRouteParams = {};
  if (serviceAddressId?.trim()) params.addressId = serviceAddressId.trim();
  if (options?.focus) params.focus = options.focus;
  return {
    pathname: "/(main)/subscription",
    params: Object.keys(params).length > 0 ? params : undefined,
  };
}

/** Leave the book modal and open AMC tab (push would nest tabs inside the modal). */
export function navigateToAmcPlan(serviceAddressId?: string | null): void {
  router.replace(amcSubscriptionRoute(serviceAddressId));
}

export function navigateToAmcRenewal(serviceAddressId?: string | null): void {
  router.replace(amcSubscriptionRoute(serviceAddressId, { focus: "upgrade" }));
}

export function bookVisitHref(gate: AmcVisitBookingGate): string {
  if (gate.kind === "use_amc_slot") {
    return `/book?amcSlotId=${encodeURIComponent(gate.nextSlot.id)}`;
  }
  if (gate.kind === "allowance_exhausted") {
    return bookVisitPaidHref();
  }
  return "/book";
}

/** Route Book a visit CTA: AMC slot booking or the AMC vs one-time choice screen. */
export function routeFromBookVisitGate(gate: AmcVisitBookingGate): void {
  if (gate.kind === "use_amc_slot") {
    router.push(bookVisitHref(gate) as `/book?amcSlotId=${string}`);
    return;
  }

  if (bookVisitRequiresAmcChoiceGate(gate)) {
    router.push("/book");
    return;
  }

  router.push("/book");
}

/** Home / bookings CTA: route to AMC slot, subscription setup, or standard paid booking. */
export async function navigateToBookVisit(
  supabase: SupabaseClient,
  customer: CustomerRow | null | undefined,
  subscriptions?: SubscriptionRow[] | null,
  options?: BookVisitNavOptions,
): Promise<void> {
  const subs =
    subscriptions ??
    (await subscriptionApi.listVisibleSubscriptions(supabase));
  const gate = await resolveBookVisitGateForCustomer(
    supabase,
    customer,
    subs,
    options?.serviceAddressId,
  );

  routeFromBookVisitGate(gate);
}

export function activeAmcBlocksOneTimeBooking(gate: AmcVisitBookingGate): boolean {
  return customerMustUseAmcBookingFlow(gate);
}

export {
  amcVisitBookingGateMessage,
  getActiveSubscriptionForAddress,
  subscriptionAddressIdForGate,
};
