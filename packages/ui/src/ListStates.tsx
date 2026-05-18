import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, fontFamily, fontSize, lineHeight, spacing } from "@oorjaman/config";
import { Button } from "./Button";
import { Card } from "./Card";

type EmptyProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

/** Premium empty placeholder - muted surface, optional action slot (e.g. primary Button). */
export function EmptyStateCard({ title, description, action }: EmptyProps) {
  return (
    <Card variant="muted" padded>
      <View style={styles.glyph}>
        <View style={styles.glyphInner} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{description}</Text>
      {action ? <View style={styles.actionGap}>{action}</View> : null}
    </Card>
  );
}

type ErrorProps = {
  title: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
};

/** Recoverable failure surface - destructive hint text + retry. */
export function ErrorStateCard({
  title,
  message,
  onRetry,
  retryLabel = "Try again",
}: ErrorProps) {
  return (
    <Card variant="outline" padded>
      <Text style={styles.errorTitle}>{title}</Text>
      <Text style={styles.errorBody}>{message}</Text>
      {onRetry ? (
        <Button variant="primary" size="md" onPress={onRetry}>
          {retryLabel}
        </Button>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  glyph: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primaryMuted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primaryBorder,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  glyphInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.primary,
    opacity: 0.65,
  },
  emptyTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.lg,
    lineHeight: lineHeight.lg,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  emptyBody: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    lineHeight: lineHeight.md,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
  },
  actionGap: {
    marginTop: spacing.sm,
    alignSelf: "stretch",
  },
  errorTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.lg,
    lineHeight: lineHeight.lg,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  errorBody: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    color: colors.destructive,
    marginBottom: spacing.md,
  },
});
