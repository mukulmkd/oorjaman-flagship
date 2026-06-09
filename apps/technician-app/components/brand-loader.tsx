import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { spacing } from "@oorjaman/config";
import { BrandLoadingIndicator } from "./brand-loading-indicator";
import { BrandLogoIcon } from "./brand-logo-icon";

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
        <BrandLogoIcon size={72} />
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
});
