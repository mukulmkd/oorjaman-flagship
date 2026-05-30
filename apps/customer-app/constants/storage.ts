import AsyncStorage from "@react-native-async-storage/async-storage";

const PREFIX = "oorjaman_customer_";

export const STORAGE_KEY_ONBOARDING = `${PREFIX}onboarding_complete`;
/** Set after user sees the location primer (grant or skip). */
export const STORAGE_KEY_LOCATION_PROMPT_DONE = `${PREFIX}location_prompt_done`;

/**
 * Legacy AsyncStorage key for vendor prefs (migrated to `customers.metadata` per saved address).
 * @see migrateLegacyVendorPreferencesToServer
 */
export const STORAGE_KEY_VENDOR_PREFS = `${PREFIX}vendor_preferences`;

/** Partner registration intake (anonymous draft) - see `vendorIntakeApi` in `@oorjaman/api`. */
export const STORAGE_KEY_VENDOR_INTAKE_ID = `${PREFIX}vendor_intake_id`;
export const STORAGE_KEY_VENDOR_INTAKE_TOKEN = `${PREFIX}vendor_intake_token`;

/** @deprecated Read only for one-time migration - preferences live on the customer row. */
export type StoredVendorPreferences = {
  preferredVendorIds: string[];
  preferredVendorId: string | null;
  fallbackVendorId: string | null;
};

const DEFAULT_VENDOR_PREFS: StoredVendorPreferences = {
  preferredVendorIds: [],
  preferredVendorId: null,
  fallbackVendorId: null,
};

/** @deprecated For migration only. */
export async function loadStoredVendorPreferences(): Promise<StoredVendorPreferences> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_VENDOR_PREFS);
    if (!raw) return { ...DEFAULT_VENDOR_PREFS };
    const j = JSON.parse(raw) as Partial<StoredVendorPreferences> & {
      preferredVendorId?: unknown;
    };

    let ids: string[] = [];
    if (Array.isArray(j.preferredVendorIds)) {
      ids = j.preferredVendorIds.filter(
        (x): x is string => typeof x === "string" && x.trim().length > 0,
      );
    }
    ids = [...new Set(ids.map((x) => x.trim()).filter(Boolean))].slice(0, 32);

    const legacy =
      typeof j.preferredVendorId === "string" && j.preferredVendorId.trim()
        ? j.preferredVendorId.trim()
        : null;
    if (legacy && !ids.includes(legacy)) {
      ids = [legacy, ...ids];
    }

    const preferredVendorId = ids[0] ?? null;
    return {
      preferredVendorIds: ids,
      preferredVendorId,
      fallbackVendorId:
        typeof j.fallbackVendorId === "string" ? j.fallbackVendorId : null,
    };
  } catch {
    return { ...DEFAULT_VENDOR_PREFS };
  }
}

export async function clearStoredVendorPreferences(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY_VENDOR_PREFS);
  } catch {
    /* ignore */
  }
}
