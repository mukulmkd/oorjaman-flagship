import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { colors, spacing } from "@oorjaman/config";
import { SCREEN_EDGES_ABOVE_TAB_BAR } from "./Screen";

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
}: AppScaffoldProps) {
  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      {header ? <View style={styles.header}>{header}</View> : null}
      {scrollable ? (
        <ScrollView
          style={styles.content}
          contentContainerStyle={[styles.contentContainer, contentContainerStyle]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, styles.contentContainer, contentContainerStyle]}>{children}</View>
      )}
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
