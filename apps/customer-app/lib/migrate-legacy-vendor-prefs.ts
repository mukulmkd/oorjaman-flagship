import type { SupabaseClient } from "@supabase/supabase-js";
import type { CustomerRow } from "@oorjaman/api";
import { customerApi } from "@oorjaman/api";
import {
  buildAddressBookPatch,
  dedupePreferredVendorIds,
  readFallbackVendorIdFromCustomer,
  readPreferredVendorIdsForDefaultServiceLocation,
  readServiceAddressBook,
  setEntryPreferredVendorIds,
} from "./service-address-book";
import { clearStoredVendorPreferences, loadStoredVendorPreferences } from "../constants/storage";

/**
 * One-time: copies AsyncStorage vendor prefs onto the default saved service address + metadata.fallback_vendor_id,
 * then clears local storage so the server is the single source of truth.
 * @returns true when a customer row was updated (caller should refetch profile).
 */
export async function migrateLegacyVendorPreferencesToServer(
  supabase: SupabaseClient,
  customer: CustomerRow,
): Promise<boolean> {
  const legacy = await loadStoredVendorPreferences();
  const legacyHas =
    (legacy.preferredVendorIds?.length ?? 0) > 0 || Boolean(legacy.fallbackVendorId?.trim());
  if (!legacyHas) {
    await clearStoredVendorPreferences();
    return false;
  }

  const serverPreferred = readPreferredVendorIdsForDefaultServiceLocation(customer);
  const serverHasPreferred = serverPreferred.length > 0;
  const serverFallback = readFallbackVendorIdFromCustomer(customer);
  const serverHasFallback = Boolean(serverFallback?.trim());

  if (serverHasPreferred || serverHasFallback) {
    await clearStoredVendorPreferences();
    return false;
  }

  const { entries, defaultId } = readServiceAddressBook(customer);
  const targetId = defaultId ?? entries[0]?.id ?? null;
  if (!targetId || entries.length === 0) {
    await clearStoredVendorPreferences();
    return false;
  }

  const nextIds = dedupePreferredVendorIds(legacy.preferredVendorIds);
  const nextEntries = setEntryPreferredVendorIds(entries, targetId, nextIds);
  const patch = buildAddressBookPatch(customer, nextEntries, defaultId, {
    fallbackVendorId: legacy.fallbackVendorId?.trim() || null,
  });
  await customerApi.updateMyCustomer(supabase, patch);
  await clearStoredVendorPreferences();
  return true;
}
