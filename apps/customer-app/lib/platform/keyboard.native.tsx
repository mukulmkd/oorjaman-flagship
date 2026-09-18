import type { ReactNode } from "react";
import { KeyboardProvider as NativeKeyboardProvider } from "react-native-keyboard-controller";

/** Native: real keyboard-controller provider. */
export function AppKeyboardProvider({ children }: { children: ReactNode }) {
  return <NativeKeyboardProvider>{children}</NativeKeyboardProvider>;
}
