import type { ReactNode } from "react";

/**
 * Web: no-op provider. Avoids relying on react-native-keyboard-controller
 * native wiring for Expo Router web boot.
 */
export function AppKeyboardProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
