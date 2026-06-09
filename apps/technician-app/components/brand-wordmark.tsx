import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View, type TextStyle } from "react-native";
import { fontFamily, fontSize } from "../constants/fonts";
import { BRAND_TAGLINE, brandTextColors } from "../lib/brand-assets";

type Props = {
  showTagline?: boolean;
  size?: "splash" | "compact";
};

type SplashWordmarkProps = {
  /** Wait for logo entrance before wordmark animates. */
  delayMs?: number;
  /** Defaults to shared brand tagline when omitted. */
  tagline?: string;
  /** Optional role line above the wordmark (e.g. “Partner app”). */
  roleLabel?: string;
};

/** Splash: name rises from below, tagline slides in from the right. */
export function BrandSplashWordmark({
  delayMs = 580,
  tagline = BRAND_TAGLINE,
  roleLabel,
}: SplashWordmarkProps) {
  const nameOpacity = useRef(new Animated.Value(0)).current;
  const nameY = useRef(new Animated.Value(28)).current;
  const tagOpacity = useRef(new Animated.Value(0)).current;
  const tagX = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.sequence([
        Animated.parallel([
          Animated.timing(nameOpacity, {
            toValue: 1,
            duration: 440,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(nameY, {
            toValue: 0,
            duration: 520,
            easing: Easing.out(Easing.back(1.1)),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(tagOpacity, {
            toValue: 1,
            duration: 400,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(tagX, {
            toValue: 0,
            duration: 480,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    }, delayMs);

    return () => clearTimeout(timer);
  }, [delayMs, nameOpacity, nameY, tagOpacity, tagX]);

  return (
    <View style={styles.root}>
      {roleLabel ? (
        <Animated.View style={{ opacity: nameOpacity, transform: [{ translateY: nameY }] }}>
          <Text style={styles.roleLabel}>{roleLabel}</Text>
        </Animated.View>
      ) : null}
      <Animated.View style={{ opacity: nameOpacity, transform: [{ translateY: nameY }] }}>
        <Text style={[styles.wordmark, styles.wordmarkSplash]}>
          <Text style={styles.oorja}>Oorja</Text>
          <Text style={styles.man}>Man</Text>
        </Text>
      </Animated.View>
      <Animated.View style={{ opacity: tagOpacity, transform: [{ translateX: tagX }] }}>
        <Text style={[styles.tagline, styles.taglineSplash]}>{tagline}</Text>
      </Animated.View>
    </View>
  );
}

export function BrandWordmark({ showTagline = true, size = "splash" }: Props) {
  const isSplash = size === "splash";
  return (
    <View style={styles.root}>
      <Text style={[styles.wordmark, isSplash ? styles.wordmarkSplash : styles.wordmarkCompact]}>
        <Text style={styles.oorja}>Oorja</Text>
        <Text style={styles.man}>Man</Text>
      </Text>
      {showTagline ? (
        <Text style={[styles.tagline, isSplash ? styles.taglineSplash : styles.taglineCompact]}>
          {BRAND_TAGLINE}
        </Text>
      ) : null}
    </View>
  );
}

/** Inline “Oorja” + “Man” for titles on pre-home screens without the logo lockup. */
export function BrandNameInline({
  prefix = "",
  suffix = "",
  style,
}: {
  prefix?: string;
  suffix?: string;
  style?: TextStyle;
}) {
  return (
    <Text style={style}>
      {prefix}
      <Text style={styles.oorja}>Oorja</Text>
      <Text style={styles.man}>Man</Text>
      {suffix}
    </Text>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: "center",
    gap: 8,
  },
  wordmark: {
    letterSpacing: -0.4,
  },
  wordmarkSplash: {
    fontFamily: fontFamily.bold,
    fontSize: 28,
    lineHeight: 34,
  },
  wordmarkCompact: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    lineHeight: 28,
  },
  oorja: {
    color: brandTextColors.oorja,
  },
  man: {
    color: brandTextColors.man,
  },
  tagline: {
    fontFamily: fontFamily.medium,
    color: brandTextColors.tagline,
    textAlign: "center",
  },
  taglineSplash: {
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 2.2,
  },
  taglineCompact: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    lineHeight: 18,
    letterSpacing: 1.8,
  },
  roleLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.xs,
    lineHeight: 14,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: brandTextColors.tagline,
    marginBottom: 2,
  },
});
