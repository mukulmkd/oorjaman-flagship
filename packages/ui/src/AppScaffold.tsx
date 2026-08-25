import { useEffect, useRef, type ReactNode } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { colors, spacing } from "@oorjaman/config";
import { SCREEN_EDGES_ABOVE_TAB_BAR } from "./Screen";
import { KEYBOARD_AVOIDING_BEHAVIOR } from "./KeyboardFormScreen";

type AppScaffoldProps = {
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  scrollable?: boolean;
  contentContainerStyle?: object;
  /**
   * Defaults to tab-friendly insets (no bottom edge). Full-screen onboarding flows should pass
   * `SCREEN_EDGES_FULL_SCREEN` from `./Screen`.
   */
  edges?: readonly Edge[];
  /** Lift scrollable content when the keyboard opens (forms with text inputs). */
  keyboardAware?: boolean;
  keyboardVerticalOffset?: number;
  /** Scroll to end when the keyboard opens — useful for OTP / bottom fields. */
  scrollToEndOnKeyboard?: boolean;
};

/**
 * Shared app page scaffold:
 * fixed header, scrollable content, optional sticky bottom CTA/footer.
 */
export function AppScaffold({
  header,
  footer,
  children,
  scrollable = true,
  contentContainerStyle,
  edges = SCREEN_EDGES_ABOVE_TAB_BAR,
  keyboardAware = false,
  keyboardVerticalOffset = 0,
  scrollToEndOnKeyboard = false,
}: AppScaffoldProps) {
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!keyboardAware || !scrollToEndOnKeyboard || !scrollable) return;
    const event = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const sub = Keyboard.addListener(event, () => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
    return () => sub.remove();
  }, [keyboardAware, scrollToEndOnKeyboard, scrollable]);

  const scrollBody = scrollable ? (
    <ScrollView
      ref={scrollRef}
      style={styles.content}
      contentContainerStyle={[styles.contentContainer, contentContainerStyle]}
      keyboardShouldPersistTaps={keyboardAware ? "always" : "handled"}
      keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, styles.contentContainer, contentContainerStyle]}>{children}</View>
  );

  const main = keyboardAware ? (
    <KeyboardAvoidingView
      style={styles.content}
      behavior={KEYBOARD_AVOIDING_BEHAVIOR}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      {scrollBody}
    </KeyboardAvoidingView>
  ) : (
    scrollBody
  );

  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      {header ? <View style={styles.header}>{header}</View> : null}
      {main}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    paddingBottom: spacing.xl,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
});
