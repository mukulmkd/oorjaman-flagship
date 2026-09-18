import { Ionicons } from "@expo/vector-icons";
import {
  Image,
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
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
  // Scale with the mark — a fixed 22px floor overwhelms compact sidebar sizes (~36–48).
  const badgeSize = Math.max(size < 72 ? 16 : 22, Math.round(size * BADGE_SIZE_RATIO));
  const glyphSize = Math.max(8, Math.round(badgeSize * 0.48));
  const badgeBorder = badgeSize < 20 ? 1 : 2;

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
        style={[
          styles.personaBadge,
          {
            width: badgeSize,
            height: badgeSize,
            borderRadius: badgeSize / 2,
            borderWidth: badgeBorder,
            top: size * BADGE_TOP_RATIO,
            right: size * BADGE_RIGHT_RATIO,
            pointerEvents: "none",
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
    borderColor: brandTextColors.oorja,
    ...(Platform.OS === "web"
      ? { boxShadow: "0px 2px 6px rgba(28, 66, 118, 0.16)" }
      : {
          shadowColor: "#1C4276",
          shadowOpacity: 0.16,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
          elevation: 4,
        }),
  },
});
