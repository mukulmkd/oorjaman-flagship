import { Ionicons } from "@expo/vector-icons";
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { brandAssets, brandTextColors } from "./brand-assets";

/** In-app badge (overflow visible). Raster icons in sync-brand-assets use 22% / 16% inset. */
const BADGE_SIZE_RATIO = 0.26;
const BADGE_TOP_RATIO = 0.08;
const BADGE_RIGHT_RATIO = 0.08;

type Props = {
  /** Big O raster edge length. */
  size: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Partner-app mark: Big O with a blended persona badge on the top-right.
 * Customer app uses the plain Big O only.
 */
export function BrandLogoIcon({ size, style }: Props) {
  const badgeSize = Math.max(22, Math.round(size * BADGE_SIZE_RATIO));
  const glyphSize = Math.round(badgeSize * 0.48);

  return (
    <View
      style={[styles.canvas, { width: size, height: size }, style]}
      accessibilityRole="image"
      accessibilityLabel="OorjaMan Partner logo"
    >
      <Image
        source={brandAssets.logoIcon}
        style={{ width: size, height: size }}
        resizeMode="contain"
        importantForAccessibility="no"
      />

      <View
        pointerEvents="none"
        style={[
          styles.personaBadge,
          {
            width: badgeSize,
            height: badgeSize,
            borderRadius: badgeSize / 2,
            top: size * BADGE_TOP_RATIO,
            right: size * BADGE_RIGHT_RATIO,
          },
        ]}
      >
        <Ionicons name="person" size={glyphSize} color={brandTextColors.man} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    position: "relative",
    overflow: "visible",
  },
  personaBadge: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderWidth: 2,
    borderColor: brandTextColors.oorja,
    shadowColor: "#1C4276",
    shadowOpacity: 0.16,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
});
