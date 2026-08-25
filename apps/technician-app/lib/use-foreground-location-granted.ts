import { useCallback, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { isPartnerLocationReady } from "./location-permission";

/** Re-checks when the screen is focused and when the app returns from Settings. */
export function useForegroundLocationGranted(): boolean | null {
  const [granted, setGranted] = useState<boolean | null>(null);

  const refresh = useCallback(() => {
    void isPartnerLocationReady().then(setGranted);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
      const sub = AppState.addEventListener("change", (state) => {
        if (state === "active") refresh();
      });
      return () => sub.remove();
    }, [refresh]),
  );

  return granted;
}
