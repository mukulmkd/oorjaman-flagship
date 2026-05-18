import {
  getActiveSubscriptionForAddress,
  getRenewalDueSubscriptionForAddress,
  type CustomerRow,
  type SubscriptionRow,
} from "@oorjaman/api";
import { formatDisplayDate } from "@oorjaman/utils";
import { readServiceAddressBook } from "./service-address-book";

/**
 * Same “current service site” as the home header: default saved address, else first entry.
 */
export function activeSubscriptionForCurrentServiceSite(
  customer: CustomerRow | null | undefined,
  subscriptions: SubscriptionRow[] | null | undefined,
): SubscriptionRow | null {
  const subs = subscriptions ?? [];
  if (subs.length === 0) return null;
  const book = readServiceAddressBook(customer ?? null);
  const addressId = book.defaultId ?? book.entries[0]?.id ?? null;
  if (!addressId) return null;
  return getActiveSubscriptionForAddress(subs, addressId);
}

export function renewalDueSubscriptionForCurrentServiceSite(
  customer: CustomerRow | null | undefined,
  subscriptions: SubscriptionRow[] | null | undefined,
): SubscriptionRow | null {
  const subs = subscriptions ?? [];
  if (subs.length === 0) return null;
  const book = readServiceAddressBook(customer ?? null);
  const addressId = book.defaultId ?? book.entries[0]?.id ?? null;
  if (!addressId) return null;
  return getRenewalDueSubscriptionForAddress(subs, addressId);
}

export function formatSubscriptionValidThrough(iso: string): string {
  return formatDisplayDate(iso);
}
