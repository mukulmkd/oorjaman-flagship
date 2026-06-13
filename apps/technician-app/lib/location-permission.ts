import { Alert, Linking } from "react-native";
import * as Location from "expo-location";

type LocationPrompt = {
  title: string;
  message: string;
};

/** Request foreground location; returns false when the user declines or has disabled access. */
export async function ensureForegroundLocationEnabled(prompt: LocationPrompt): Promise<boolean> {
  let perm = await Location.getForegroundPermissionsAsync();
  if (perm.status !== "granted") {
    perm = await Location.requestForegroundPermissionsAsync();
  }
  if (perm.status === "granted") return true;

  Alert.alert(prompt.title, prompt.message, [
    { text: "Not now", style: "cancel" },
    { text: "Open Settings", onPress: () => void Linking.openSettings() },
  ]);
  return false;
}
