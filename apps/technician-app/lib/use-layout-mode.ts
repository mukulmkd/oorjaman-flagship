import { useWindowDimensions, Platform } from "react-native";
import { WEB_SHELL_MIN_WIDTH } from "@oorjaman/ui";

export type LayoutMode = "phone" | "desktop";

/** @deprecated Prefer WEB_SHELL_MIN_WIDTH from @oorjaman/ui */
export const DESKTOP_SHELL_MIN_WIDTH = WEB_SHELL_MIN_WIDTH;

/**
 * Native phone/tablet always use the existing tab bar.
 * Web at ≥1024 uses the desktop sidebar shell.
 */
export function useLayoutMode(): LayoutMode {
  const { width } = useWindowDimensions();
  if (Platform.OS !== "web") return "phone";
  return width >= WEB_SHELL_MIN_WIDTH ? "desktop" : "phone";
}
