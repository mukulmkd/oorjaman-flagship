import { Image, StyleSheet, View } from "react-native";
import { brandAssets } from "./brand-assets";
import { BrandLogoIcon } from "./brand-logo-icon";
import { BrandWordmark } from "./brand-wordmark";

type Props = {
  /** Big O raster size — welcome uses 108; auth screens use ~96. */
  iconSize?: number;
  showTagline?: boolean;
  variant?: "customer" | "partner";
};

/**
 * Composed brand lockup: transparent Big O + styled wordmark (matches welcome / splash).
 */
export function BrandLockup({ iconSize = 96, showTagline = true, variant = "customer" }: Props) {
  return (
    <View style={styles.root}>
      {variant === "partner" ? (
        <BrandLogoIcon size={iconSize} />
      ) : (
        <Image
          source={brandAssets.logoIcon}
          style={{ width: iconSize, height: iconSize }}
          resizeMode="contain"
          accessibilityRole="image"
          accessibilityLabel="OorjaMan logo"
        />
      )}
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
