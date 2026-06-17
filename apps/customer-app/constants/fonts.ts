import { typography } from "@oorjaman/config";

/** Expo-loaded face names (must match `_layout` font loading). */
export const fontFamily = {
  regular: "PlusJakartaSans_400Regular",
  medium: "PlusJakartaSans_500Medium",
  semiBold: "PlusJakartaSans_600SemiBold",
  bold: "PlusJakartaSans_700Bold",
} as const;

export const fontSize = typography.size;
