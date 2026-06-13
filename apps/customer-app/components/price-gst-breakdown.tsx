import { Text, View, StyleSheet } from "react-native";
import { formatInrFromCents, INDIAN_GST_RATE_PERCENT, splitGstFromInclusiveTotal } from "@oorjaman/api";
import { colors, spacing } from "@oorjaman/config";
import { fontFamily, fontSize } from "../constants/fonts";

type Props = {
  totalPaise: number;
  compact?: boolean;
};

export function PriceGstBreakdown({ totalPaise, compact = false }: Props) {
  if (totalPaise <= 0) return null;
  const breakdown = splitGstFromInclusiveTotal(totalPaise);

  if (compact) {
    return (
      <Text style={styles.compact}>
        {formatInrFromCents(breakdown.total_cents)} incl. {INDIAN_GST_RATE_PERCENT}% GST (
        {formatInrFromCents(breakdown.gst_cents)})
      </Text>
    );
  }

  return (
    <View style={styles.block}>
      <View style={styles.row}>
        <Text style={styles.label}>Service value</Text>
        <Text style={styles.value}>{formatInrFromCents(breakdown.taxable_value_cents)}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>GST ({INDIAN_GST_RATE_PERCENT}%)</Text>
        <Text style={styles.value}>{formatInrFromCents(breakdown.gst_cents)}</Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.row}>
        <Text style={styles.totalLabel}>Total (incl. GST)</Text>
        <Text style={styles.totalValue}>{formatInrFromCents(breakdown.total_cents)}</Text>
      </View>
      <Text style={styles.hint}>GST is included in the price shown above.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: spacing.xs,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
  },
  label: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    flex: 1,
  },
  value: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },
  totalLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    flex: 1,
  },
  totalValue: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.md,
    color: colors.textPrimary,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  hint: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  compact: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
});
