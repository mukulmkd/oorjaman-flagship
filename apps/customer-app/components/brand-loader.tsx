import { useEffect, useRef } from "react";
import { Animated, Easing, Image, StyleSheet, View } from "react-native";
import { spacing } from "@oorjaman/config";
import { brandAssets } from "../lib/brand-assets";
import { BrandLoadingIndicator } from "./brand-loading-indicator";

/** In-app loading: animated Big O + brand Loading… indicator. */
export function BrandLoader() {
  const breathe = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1.06,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breathe]);

  return (
    <View style={styles.root}>
      <Animated.View style={{ transform: [{ scale: breathe }] }}>
        <Image
          source={brandAssets.logoIcon}
          style={styles.icon}
          resizeMode="contain"
          accessibilityRole="image"
          accessibilityLabel="OorjaMan"
        />
      </Animated.View>
      <BrandLoadingIndicator />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  icon: {
    width: 72,
    height: 72,
  },
});
