import Constants from "expo-constants";
import * as Location from "expo-location";
import { Alert, Linking } from "react-native";

export type ForegroundLocationAccess =
  | { ok: true }
  | { ok: false; reason: "denied" | "unavailable" };

/** True when running inside the Expo Go host app (not your standalone OorjaMan build). */
export function isExpoGoHost(): boolean {
  return Constants.appOwnership === "expo";
}

/**
 * Ensures foreground location permission without redundant system prompts.
 * - Already granted → no dialogs
 * - Denied → in-app explanation + optional Settings (does not re-trigger Expo/iOS sheets)
 * - Undetermined → one system permission request
 */
export async function ensureForegroundLocationAccess(options?: {
  /** Shown only when the user must open Settings (permanently denied). */
  settingsTitle?: string;
  settingsMessage?: string;
}): Promise<ForegroundLocationAccess> {
  const settingsTitle = options?.settingsTitle ?? "Location required";
  const settingsMessage =
    options?.settingsMessage ??
    "Turn on location for OorjaMan in your device Settings to use GPS for site photos and visits.";

  let perm = await Location.getForegroundPermissionsAsync();
  if (perm.status === "granted") {
    return { ok: true };
  }

  if (perm.status === "denied" && perm.canAskAgain === false) {
    await showOpenSettingsAlert(settingsTitle, settingsMessage);
    return { ok: false, reason: "denied" };
  }

  if (perm.status === "denied") {
    await new Promise<void>((resolve) => {
      Alert.alert(
        settingsTitle,
        settingsMessage,
        [
          { text: "Not now", style: "cancel", onPress: () => resolve() },
          {
            text: "Open Settings",
            onPress: () => {
              void Linking.openSettings();
              resolve();
            },
          },
        ],
        { cancelable: true },
      );
    });
    return { ok: false, reason: "denied" };
  }

  perm = await Location.requestForegroundPermissionsAsync();
  if (perm.status === "granted") {
    return { ok: true };
  }

  if (perm.canAskAgain === false) {
    await showOpenSettingsAlert(settingsTitle, settingsMessage);
  }
  return { ok: false, reason: "denied" };
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
            void Linking.openSettings();
            resolve();
          },
        },
      ],
      { cancelable: true },
    );
  });
}
