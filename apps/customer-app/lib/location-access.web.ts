import Constants from "expo-constants";
import { Alert, Linking } from "react-native";

export type ForegroundLocationAccess =
  | { ok: true }
  | { ok: false; reason: "denied" | "unavailable" };

/** True when running inside the Expo Go host app (not your standalone OorjaMan build). */
export function isExpoGoHost(): boolean {
  return Constants.appOwnership === "expo";
}

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

/**
 * Web Geolocation permission probe. Can signal denied without silently succeeding.
 * En-route UI gating changes land in Phase 6; this adapter only expresses denial.
 */
export async function ensureForegroundLocationAccess(options?: {
  settingsTitle?: string;
  settingsMessage?: string;
}): Promise<ForegroundLocationAccess> {
  const settingsTitle = options?.settingsTitle ?? "Location required";
  const settingsMessage =
    options?.settingsMessage ??
    "Allow location access in your browser settings to use GPS for site photos and visits.";

  if (!geolocationAvailable()) {
    Alert.alert(settingsTitle, "This browser does not support location.");
    return { ok: false, reason: "unavailable" };
  }

  const state = await queryGeolocationPermissionState();
  if (state === "granted") {
    return { ok: true };
  }
  if (state === "denied") {
    await showOpenSettingsAlert(settingsTitle, settingsMessage);
    return { ok: false, reason: "denied" };
  }

  // prompt / unsupported — request via getCurrentPosition (triggers browser prompt).
  try {
    await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        timeout: 15_000,
        maximumAge: 60_000,
      });
    });
    return { ok: true };
  } catch (e: unknown) {
    const code =
      e && typeof e === "object" && "code" in e ? Number((e as { code?: unknown }).code) : NaN;
    // 1 = PERMISSION_DENIED
    if (code === 1) {
      await showOpenSettingsAlert(settingsTitle, settingsMessage);
      return { ok: false, reason: "denied" };
    }
    Alert.alert(settingsTitle, "Could not read your location. Try again.");
    return { ok: false, reason: "unavailable" };
  }
}

async function showOpenSettingsAlert(title: string, message: string): Promise<void> {
  await new Promise<void>((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: "Not now", style: "cancel", onPress: () => resolve() },
        {
          text: "Open Settings",
          onPress: () => {
            // Browsers rarely expose a settings deep-link; keep API parity with native.
            try {
              void Linking.openSettings();
            } catch {
              // ignore
            }
            resolve();
          },
        },
      ],
      { cancelable: true },
    );
  });
}
