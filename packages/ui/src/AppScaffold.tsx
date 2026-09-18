import { useRef, type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { colors, spacing } from "@oorjaman/config";
import { SCREEN_EDGES_ABOVE_TAB_BAR } from "./Screen";
import { KEYBOARD_AVOIDING_BEHAVIOR } from "./KeyboardFormScreen.shared";
import {
  USE_WEB_LAYOUT,
  webContentColumnStyle,
  type WebContentVariant,
} from "./web-layout";

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
  /** @deprecated Native keyboard resizing now keeps the focused field visible. */
  scrollToEndOnKeyboard?: boolean;
  /** Web-only: constrain scroll/body width. Ignored on native. */
  webVariant?: WebContentVariant;
  webMaxWidth?: number;
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
  webVariant = "page",
  webMaxWidth,
}: AppScaffoldProps) {
  const scrollRef = useRef<ScrollView>(null);
  const webColumn = USE_WEB_LAYOUT
    ? webContentColumnStyle(webVariant, { maxWidth: webMaxWidth })
    : undefined;

  const scrollBody = scrollable ? (
    <ScrollView
      ref={scrollRef}
      style={styles.content}
      contentContainerStyle={[
        styles.contentContainer,
        webColumn,
        contentContainerStyle,
      ]}
      keyboardShouldPersistTaps={keyboardAware ? "always" : "handled"}
      keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View
      style={[styles.content, styles.contentContainer, webColumn, contentContainerStyle]}
    >
      {children}
    </View>
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
