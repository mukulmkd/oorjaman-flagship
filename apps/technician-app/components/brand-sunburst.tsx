import { useEffect, useRef } from "react";
import { Animated, Easing, Image, StyleSheet, View } from "react-native";
import { brandAssets } from "../lib/brand-assets";

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
            useNativeDriver: true,
          }),
          Animated.timing(pulseScale, {
            toValue: 0.96,
            duration: 2600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(pulseOpacity, {
            toValue: 0.96,
            duration: 2600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseOpacity, {
            toValue: 0.82,
            duration: 2600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulseOpacity, pulseScale]);

  return (
    <View pointerEvents="none" style={[styles.wrap, { width: size, height: size }]}>
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
