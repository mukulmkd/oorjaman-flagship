import type { ReactNode } from "react";

/** Web: no-op keyboard provider for Expo Router web boot. */
export function AppKeyboardProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
