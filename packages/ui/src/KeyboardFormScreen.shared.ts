import { Platform } from "react-native";
import type { ReactNode } from "react";
import type { StyleProp, TextInput, ViewStyle } from "react-native";
import type { WebContentVariant } from "./web-layout";

/** Compatibility behavior for screens that still use React Native KeyboardAvoidingView directly. */
export const KEYBOARD_AVOIDING_BEHAVIOR =
  Platform.OS === "ios" ? "padding" : undefined;

export type KeyboardFormScreenRef = {
  /** @deprecated Prefer focused-input scrolling provided automatically by this component. */
  scrollToEnd: (animated?: boolean) => void;
  /** Reveal only the requested input above the keyboard. */
  scrollToInput: (input: TextInput | null, additionalOffset?: number) => void;
};

export type KeyboardFormScreenProps = {
  children: ReactNode;
  /** Extra offset for fixed headers / nav bars (mainly iOS). */
  keyboardVerticalOffset?: number;
  contentContainerStyle?: StyleProp<ViewStyle>;
  /**
   * @deprecated Retained for call-site compatibility. Native keyboard resizing keeps the
   * focused field visible; forcing the entire form to its end hides fields higher in the form.
   */
  scrollToEndOnKeyboard?: boolean;
  /** Web-only: constrain form column width. Ignored on native. */
  webVariant?: WebContentVariant;
  webMaxWidth?: number;
  /** Web-only: vertically center content on tall viewports (auth). */
  centerVertically?: boolean;
};
