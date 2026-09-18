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

function showLocationSettingsAlert(title: string, message: string): void {
  Alert.alert(
    title,
    message,
    [
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
    { cancelable: false },
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

  // prompt / unsupported — honor in-tab success cache after En Route / gate prompt.
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
    showLocationSettingsAlert(
      "Location unavailable",
      "This browser does not support location. Use a mobile browser or the Partner app.",
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
      showLocationSettingsAlert(
        "Location permission required",
        "Allow location access in your browser before marking en route.",
      );
      return null;
    }
    Alert.alert(
      "GPS unavailable",
      e instanceof Error
        ? e.message
        : "Could not read your location. Enable location and try again.",
      [{ text: "OK" }],
      { cancelable: false },
    );
    return null;
  }
}
