import { Alert, Linking, Platform } from "react-native";
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

function showLocationSettingsAlert(title: string, message: string): void {
  Alert.alert(
    title,
    message,
    [
      {
        text: "Open Settings",
        onPress: () => void Linking.openSettings(),
      },
    ],
    { cancelable: false },
  );
}

/** Permission + system location services (Android “Location” master toggle). */
export async function getPartnerLocationStatus(): Promise<PartnerLocationStatus> {
  if (Platform.OS === "web") {
    return { permissionGranted: true, servicesEnabled: true };
  }
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
 */
export async function ensureEnRouteLocationFix(): Promise<EnRouteLocationFix | null> {
  const status = await getPartnerLocationStatus();
  if (!status.permissionGranted) {
    let perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== "granted") {
      showLocationSettingsAlert(
        "Location permission required",
        "Allow location access for OorjaMan Partner in Settings before marking en route.",
      );
      return null;
    }
  }

  const servicesOn = await Location.hasServicesEnabledAsync();
  if (!servicesOn) {
    showLocationSettingsAlert(
      "Turn on location",
      "Enable your phone's Location/GPS setting so customers can track your trip.",
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
        : "Could not read your location. Enable location services and try again near a window or outdoors.",
      [{ text: "OK" }],
      { cancelable: false },
    );
    return null;
  }
}
