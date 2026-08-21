import { StyleSheet, Text } from "react-native";
import { colors, fontFamily, fontSize } from "@oorjaman/config";

/**
 * OorjaMan CTA label for Razorpay Standard Checkout.
 * Avoids a faux Razorpay logo/wordmark (trademarks require official assets + Usage Agreement).
 */
export function RazorpayPayLabel() {
  return (
    <Text style={styles.label} numberOfLines={1} accessibilityLabel="Pay securely">
      Pay securely
    </Text>
  );
}

/** Muted caption under the pay button. */
export function RazorpayPoweredByCaption() {
  return <Text style={styles.caption}>Powered by Razorpay</Text>;
}

const styles = StyleSheet.create({
  label: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.md,
    lineHeight: 20,
    color: colors.primaryForeground,
    textAlign: "center",
  },
  caption: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    lineHeight: 16,
    color: colors.mutedForeground,
    textAlign: "center",
  },
});
