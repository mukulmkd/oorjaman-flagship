import { isRunningInExpoGo } from "expo";
import { Platform } from "react-native";

type ExpoNotificationsModule = typeof import("expo-notifications");

let cached: ExpoNotificationsModule | null | undefined;
let loggedExpoGoSkip = false;

/**
 * Android Expo Go throws when `expo-notifications` is imported (SDK 53+ remote push removal).
 * Development builds and iOS Expo Go can still use local notification APIs.
 */
export function isNativeNotificationsSupported(): boolean {
  if (Platform.OS === "web") return false;
  if (Platform.OS === "android" && isRunningInExpoGo()) return false;
  return true;
}

/** Lazy-load expo-notifications only when supported (never import on Android Expo Go). */
export function getExpoNotifications(): ExpoNotificationsModule | null {
  if (!isNativeNotificationsSupported()) {
    if (__DEV__ && !loggedExpoGoSkip) {
      loggedExpoGoSkip = true;
      console.info(
        "[notifications] Skipping expo-notifications on Android Expo Go. Use a dev build: npm run android:rebuild",
      );
    }
    return null;
  }

  if (cached === undefined) {
    try {
      cached = require("expo-notifications") as ExpoNotificationsModule;
    } catch (error) {
      if (__DEV__) {
        console.warn("[notifications] expo-notifications unavailable", error);
      }
      cached = null;
    }
  }

  return cached;
}
