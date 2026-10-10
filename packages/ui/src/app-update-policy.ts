/**
 * Store builds whose runtime is below `minimumStoreVersion` see a blocking
 * screen that opens the store. Runtime follows the store version (`appVersion`).
 * Leave it unset so current binaries keep working. Raise it in a later update
 * only after that store version is live.
 */
export type AppUpdateAudience = "customer" | "partner";

export type AppUpdatePolicy = {
  minimumStoreVersion: string | null;
  androidPackage: string;
  /** Set once the App Store listing exists. Until then the button searches by name. */
  iosAppStoreUrl: string | null;
  storeSearch: string;
  storeMessage: string;
  storeButton: string;
  refreshMessage: string;
  refreshButton: string;
};

export const APP_UPDATE_POLICY: Record<AppUpdateAudience, AppUpdatePolicy> = {
  customer: {
    minimumStoreVersion: null,
    androidPackage: "com.oorjaman.customer",
    iosAppStoreUrl: null,
    storeSearch: "OorjaMan",
    storeMessage:
      "A newer OorjaMan is ready. Update to keep your bookings and receipts working smoothly.",
    storeButton: "Update OorjaMan",
    refreshMessage: "OorjaMan has a small improvement ready. The app will refresh to use it.",
    refreshButton: "Refresh",
  },
  partner: {
    minimumStoreVersion: null,
    androidPackage: "com.oorjaman.technician",
    iosAppStoreUrl: null,
    storeSearch: "OorjaMan Partner",
    storeMessage: "Update OorjaMan Partner so new jobs stay in sync.",
    storeButton: "Update OorjaMan Partner",
    refreshMessage:
      "OorjaMan Partner has a small improvement ready. The app will refresh to use it.",
    refreshButton: "Refresh",
  },
};

export function isStoreVersionBelowMinimum(
  installedVersion: string | null,
  minimumStoreVersion: string | null,
): boolean {
  if (!installedVersion || !minimumStoreVersion) return false;
  return compareVersions(installedVersion, minimumStoreVersion) < 0;
}

function compareVersions(left: string, right: string): number {
  const leftParts = left.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const rightParts = right.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}
