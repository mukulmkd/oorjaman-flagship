import { Alert, Linking } from "react-native";

export type EnRouteLocationFix = {
  lat: number;
  lng: number;
  recordedAt: string;
};

export type PartnerLocationStatus = {
  /** Browser geolocation permission granted. */
  permissionGranted: boolean;
  /** Geolocation API available (treated as services enabled on web). */
  servicesEnabled: boolean;
};

/** Survives Permissions API "prompt"/unsupported after a successful fix in this tab. */
let webGeoGrantedCache: boolean | null = null;

function geolocationAvailable(): boolean {
  return typeof navigator !== "undefined" && Boolean(navigator.geolocation);
}

async function queryGeolocationPermissionState(): Promise<PermissionState | "unsupported"> {
  try {
    if (typeof navigator === "undefined" || !navigator.permissions?.query) {
      return "unsupported";
    }
    const result = await navigator.permissions.query({ name: "geolocation" });
    return result.state;
  } catch {
    return "unsupported";
  }
}

/** Soft alert: dismiss always available; Settings optional (5.1.1(iv)). */
function showLocationNeededAlert(title: string, message: string): void {
  Alert.alert(
    title,
    message,
    [
      { text: "Not Now", style: "cancel" },
      {
        text: "Open Settings",
        onPress: () => {
          try {
            void Linking.openSettings();
          } catch {
            // ignore
          }
        },
      },
    ],
    { cancelable: true },
  );
}

/**
 * Web status via Permissions / Geolocation API.
 * Must be able to report PERMISSION_DENIED (no silent grant).
 */
export async function getPartnerLocationStatus(): Promise<PartnerLocationStatus> {
  if (!geolocationAvailable()) {
    webGeoGrantedCache = false;
    return { permissionGranted: false, servicesEnabled: false };
  }

  const state = await queryGeolocationPermissionState();
  if (state === "granted") {
    webGeoGrantedCache = true;
    return { permissionGranted: true, servicesEnabled: true };
  }
  if (state === "denied") {
    webGeoGrantedCache = false;
    return { permissionGranted: false, servicesEnabled: true };
  }

  if (webGeoGrantedCache === true) {
    return { permissionGranted: true, servicesEnabled: true };
  }

  return { permissionGranted: false, servicesEnabled: true };
}

export async function isPartnerLocationReady(): Promise<boolean> {
  const status = await getPartnerLocationStatus();
  return status.permissionGranted && status.servicesEnabled;
}

export async function isForegroundLocationGranted(): Promise<boolean> {
  return isPartnerLocationReady();
}

/**
 * En route requires a live browser geolocation fix.
 * Denial returns null — callers must NOT continue as en route.
 */
export async function ensureEnRouteLocationFix(): Promise<EnRouteLocationFix | null> {
  if (!geolocationAvailable()) {
    showLocationNeededAlert(
      "Location unavailable",
      "This browser does not support location. You can still use other Partner features, or open the native Partner app for live tracking.",
    );
    return null;
  }

  try {
    const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 20_000,
        maximumAge: 5_000,
      });
    });
    webGeoGrantedCache = true;
    return {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      recordedAt: new Date(pos.timestamp).toISOString(),
    };
  } catch (e: unknown) {
    const code =
      e && typeof e === "object" && "code" in e ? Number((e as { code?: unknown }).code) : NaN;
    if (code === 1) {
      webGeoGrantedCache = false;
      showLocationNeededAlert(
        "Location needed for en route",
        "Marking en route shares your trip with the customer. Other Partner features still work. Enable location in the browser when you are ready to go en route.",
      );
      return null;
    }
    Alert.alert(
      "GPS unavailable",
      e instanceof Error
        ? e.message
        : "Could not read your location. Try again when you are ready to mark en route.",
      [{ text: "OK" }],
      { cancelable: true },
    );
    return null;
  }
}
