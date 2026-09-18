import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { brandAssets } from "./brand-assets";
import { USE_NATIVE_DRIVER } from "../use-native-driver";

type Props = {
  size: number;
};

/** 14 soft pale-gold bands behind the Big O (branding kit). */
export function BrandSunburst({ size }: Props) {
  const pulseScale = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.89)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseScale, {
            toValue: 1.04,
            duration: 2600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.timing(pulseScale, {
            toValue: 0.96,
            duration: 2600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
        ]),
        Animated.sequence([
          Animated.timing(pulseOpacity, {
            toValue: 0.96,
            duration: 2600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.timing(pulseOpacity, {
            toValue: 0.82,
            duration: 2600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulseOpacity, pulseScale]);

  return (
    <View style={[styles.wrap, { width: size, height: size, pointerEvents: "none" }]}>
      <Animated.Image
        source={brandAssets.sunburst}
        style={[
          styles.sun,
          {
            width: size,
            height: size,
            opacity: pulseOpacity,
            transform: [{ scale: pulseScale }],
          },
        ]}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  sun: {
    position: "absolute",
  },
});
