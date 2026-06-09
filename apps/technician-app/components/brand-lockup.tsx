import { StyleSheet, View } from "react-native";
import { BrandLogoIcon } from "./brand-logo-icon";
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
      <BrandLogoIcon size={iconSize} />
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
