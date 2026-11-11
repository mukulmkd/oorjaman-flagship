import { Alert, Linking } from "react-native";
import * as Location from "expo-location";

export type EnRouteLocationFix = {
  lat: number;
  lng: number;
  recordedAt: string;
};

export type PartnerLocationStatus = {
  /** App foreground location permission granted. */
  permissionGranted: boolean;
  /** Device-level location services enabled (system GPS toggle). */
  servicesEnabled: boolean;
};

/**
 * Informational alert when a location-gated feature cannot run.
 * Always includes a dismiss action so we respect a prior "Don't Allow"
 * (App Store Guideline 5.1.1(iv)). Open Settings is optional, never the only button.
 */
function showLocationNeededAlert(title: string, message: string): void {
  Alert.alert(
    title,
    message,
    [
      { text: "Not Now", style: "cancel" },
      {
        text: "Open Settings",
        onPress: () => void Linking.openSettings(),
      },
    ],
    { cancelable: true },
  );
}

/** Permission + system location services (Android “Location” master toggle). */
export async function getPartnerLocationStatus(): Promise<PartnerLocationStatus> {
  const perm = await Location.getForegroundPermissionsAsync();
  const permissionGranted = perm.status === "granted";
  const servicesEnabled = await Location.hasServicesEnabledAsync();
  return { permissionGranted, servicesEnabled };
}

export async function isPartnerLocationReady(): Promise<boolean> {
  const status = await getPartnerLocationStatus();
  return status.permissionGranted && status.servicesEnabled;
}

export async function isForegroundLocationGranted(): Promise<boolean> {
  return isPartnerLocationReady();
}

/**
 * En route requires permission, system location on, and a live GPS fix.
 * Denial returns null — the rest of the Partner app stays usable.
 */
export async function ensureEnRouteLocationFix(): Promise<EnRouteLocationFix | null> {
  const status = await getPartnerLocationStatus();
  if (!status.permissionGranted) {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== "granted") {
      showLocationNeededAlert(
        "Location needed for en route",
        "Marking en route shares your trip with the customer. You can continue using other Partner features without location. To enable tracking later, turn on Location for OorjaMan Partner in Settings.",
      );
      return null;
    }
  }

  const servicesOn = await Location.hasServicesEnabledAsync();
  if (!servicesOn) {
    showLocationNeededAlert(
      "Turn on Location",
      "Your phone's Location/GPS is off, so live tracking cannot start. You can enable it in Settings when you are ready to mark en route.",
    );
    return null;
  }

  try {
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
      mayShowUserSettingsDialog: true,
    });
    return {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      recordedAt: new Date(pos.timestamp).toISOString(),
    };
  } catch (e: unknown) {
    Alert.alert(
      "GPS unavailable",
      e instanceof Error
        ? e.message
        : "Could not read your location. Try again near a window or outdoors when you are ready to mark en route.",
      [{ text: "OK" }],
      { cancelable: true },
    );
    return null;
  }
}
