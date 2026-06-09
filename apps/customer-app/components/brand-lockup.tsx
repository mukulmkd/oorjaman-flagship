import { Image, StyleSheet, View } from "react-native";
import { brandAssets } from "../lib/brand-assets";
import { BrandWordmark } from "./brand-wordmark";

type Props = {
  /** Big O raster size — welcome uses 108; auth screens use ~96. */
  iconSize?: number;
  showTagline?: boolean;
};

/**
 * Composed brand lockup: transparent Big O + styled wordmark (matches welcome / splash).
 */
export function BrandLockup({ iconSize = 96, showTagline = true }: Props) {
  return (
    <View style={styles.root}>
      <Image
        source={brandAssets.logoIcon}
        style={{ width: iconSize, height: iconSize }}
        resizeMode="contain"
        accessibilityRole="image"
        accessibilityLabel="OorjaMan logo"
      />
      <BrandWordmark size="compact" showTagline={showTagline} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: "center",
    gap: 14,
  },
});
