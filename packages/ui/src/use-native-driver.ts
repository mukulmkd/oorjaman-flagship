import { Platform } from "react-native";

/** RN Web has no native animated driver — always fall back to JS. */
export const USE_NATIVE_DRIVER = Platform.OS !== "web";
