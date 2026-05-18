import type { CustomerRow, Json, SubscriptionRow } from "../database.types";
import { formattedSiteAddressFromJson } from "../bookings/customer-booking-payload";
import {
  buildServiceSiteAddressFromEntry,
  getServiceAddressEntry,
  serviceAddressFormatted,
  type ServiceAddressEntry,
} from "../customers/service-address-book";

export function readSubscriptionServiceAddressId(sub: SubscriptionRow): string | null {
  if (sub.service_address_id?.trim()) return sub.service_address_id.trim();
  if (!sub.metadata || typeof sub.metadata !== "object" || Array.isArray(sub.metadata)) return null;
  const v = (sub.metadata as Record<string, unknown>).service_address_id;
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export function isSubscriptionActive(sub: SubscriptionRow, nowMs = Date.now()): boolean {
  if (sub.status !== "active" && sub.status !== "trialing") return false;
  return new Date(sub.ends_at).getTime() >= nowMs;
}

export function getActiveSubscriptionForAddress(
  subscriptions: SubscriptionRow[],
  serviceAddressId: string,
  nowMs = Date.now(),
): SubscriptionRow | null {
  const id = serviceAddressId.trim();
  if (!id) return null;
  return (
    subscriptions.find((s) => {
      if (!isSubscriptionActive(s, nowMs)) return false;
      return readSubscriptionServiceAddressId(s) === id;
    }) ?? null
  );
}

/** Contract end date is before now (independent of `status` until back-office updates it). */
export function isSubscriptionContractEnded(sub: SubscriptionRow, nowMs = Date.now()): boolean {
  return new Date(sub.ends_at).getTime() < nowMs;
}

/**
 * Most recent lapsed AMC for an address when there is no active plan — used for renewal prompts.
 */
export function getRenewalDueSubscriptionForAddress(
  subscriptions: SubscriptionRow[],
  serviceAddressId: string,
  nowMs = Date.now(),
): SubscriptionRow | null {
  const id = serviceAddressId.trim();
  if (!id) return null;
  if (getActiveSubscriptionForAddress(subscriptions, id, nowMs)) return null;

  const ended = subscriptions
    .filter(
      (s) =>
        readSubscriptionServiceAddressId(s) === id && isSubscriptionContractEnded(s, nowMs),
    )
    .sort((a, b) => new Date(b.ends_at).getTime() - new Date(a.ends_at).getTime());

  return ended[0] ?? null;
}

export function resolveSubscriptionAddressEntry(
  customer: CustomerRow | null,
  sub: SubscriptionRow,
): ServiceAddressEntry | null {
  const addrId = readSubscriptionServiceAddressId(sub);
  if (!addrId) return null;
  return getServiceAddressEntry(customer, addrId);
}

export function readServiceSiteAddressFromSubscription(
  customer: CustomerRow | null,
  sub: SubscriptionRow,
): Json | null {
  const entry = resolveSubscriptionAddressEntry(customer, sub);
  if (entry) {
    try {
      return buildServiceSiteAddressFromEntry(entry);
    } catch {
      /* fall through to metadata snapshot */
    }
  }
  if (!sub.metadata || typeof sub.metadata !== "object" || Array.isArray(sub.metadata)) return null;
  const raw = (sub.metadata as Record<string, unknown>).service_site_address;
  return raw == null ? null : (raw as Json);
}

/** Normalize for loose address comparison (bookings vs subscription). */
export function normalizeAddressComparisonKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s,]/g, "")
    .trim();
}

export function readBookingServiceAddressId(metadata: Json): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const v = (metadata as Record<string, unknown>).service_address_id;
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export function bookingMatchesSubscriptionAddress(
  bookingSiteAddress: Json,
  bookingMetadata: Json,
  subscription: SubscriptionRow,
  customer: CustomerRow | null,
): boolean {
  const subAddrId = readSubscriptionServiceAddressId(subscription);
  if (!subAddrId) return true;

  const bookingAddrId = readBookingServiceAddressId(bookingMetadata);
  if (bookingAddrId) return bookingAddrId === subAddrId;

  const subSite = readServiceSiteAddressFromSubscription(customer, subscription);
  const subText = normalizeAddressComparisonKey(formattedSiteAddressFromJson(subSite));
  const bookText = normalizeAddressComparisonKey(formattedSiteAddressFromJson(bookingSiteAddress));
  if (!subText || !bookText) return false;
  return subText === bookText || subText.includes(bookText) || bookText.includes(subText);
}

export function subscriptionAddressLabel(
  customer: CustomerRow | null,
  sub: SubscriptionRow,
): string {
  const entry = resolveSubscriptionAddressEntry(customer, sub);
  if (entry?.label?.trim()) return entry.label.trim();
  const site = readServiceSiteAddressFromSubscription(customer, sub);
  const formatted = serviceAddressFormatted(site);
  if (formatted) {
    const head = formatted.split(",")[0]?.trim() ?? formatted;
    return head.length > 40 ? `${head.slice(0, 37)}…` : head;
  }
  return "Service site";
}
