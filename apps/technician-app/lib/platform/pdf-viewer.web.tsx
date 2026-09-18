import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing } from "@oorjaman/config";

type Props = {
  url: string;
  onLoadStart?: () => void;
  onLoadEnd?: () => void;
  loading?: boolean;
};

/**
 * Web PDF iframe / download UX lands in Phase 6.
 * Clear non-silent fallback: open in a new tab.
 */
export function PdfDocumentPreview({ url, onLoadEnd }: Props) {
  return (
    <View style={styles.wrap}>
      <Ionicons name="document-text-outline" size={40} color={colors.mutedForeground} />
      <Text style={styles.title}>PDF preview on web coming soon</Text>
      <Text style={styles.body}>
        In-app PDF viewing will be available in a later release. Open the file in a new browser tab for
        now.
      </Text>
      <Pressable
        accessibilityRole="link"
        onPress={() => {
          onLoadEnd?.();
          void Linking.openURL(url);
        }}
        style={styles.linkBtn}
      >
        <Text style={styles.linkText}>Open PDF</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
    backgroundColor: colors.muted,
  },
  title: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  body: {
    color: colors.mutedForeground,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  linkBtn: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  linkText: {
    color: colors.primaryForeground,
    fontSize: 14,
    fontWeight: "600",
  },
});
