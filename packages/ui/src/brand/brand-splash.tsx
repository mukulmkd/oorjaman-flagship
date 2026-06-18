import { useEffect, useRef } from "react";
import { Animated, Easing, Image, StyleSheet, View } from "react-native";
import { hideNativeSplashScreenOnce } from "../safe-splash-screen";
import { BRAND_TAGLINE, brandAssets } from "./brand-assets";
import {
  BrandLoadingIndicator,
  SPLASH_LOADING_DELAY_MS,
} from "./brand-loading-indicator";
import { BrandLogoIcon } from "./brand-logo-icon";
import { BrandSunburst } from "./brand-sunburst";
import { BrandSplashWordmark } from "./brand-wordmark";

/** Keep in sync with Android `expo-splash-screen` `imageWidth` (196dp pre-splash). */
const O_SIZE = 196;
/** Rays extend ~half the O width beyond the logo (kit reference). */
const SUN_SIZE = Math.round(O_SIZE * 1.5);

type Props = {
  releaseNativeSplash?: boolean;
  onAnimationsComplete?: () => void;
  variant?: "customer" | "partner";
};

export function BrandSplash({
  releaseNativeSplash = true,
  onAnimationsComplete,
  variant = "customer",
}: Props) {
  const logoScale = useRef(new Animated.Value(0.88)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const isPartner = variant === "partner";

  useEffect(() => {
    if (releaseNativeSplash) {
      void hideNativeSplashScreenOnce();
    }

    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(logoScale, {
        toValue: 1,
        duration: 650,
        easing: Easing.out(Easing.back(1.05)),
        useNativeDriver: true,
      }),
    ]).start();
  }, [logoOpacity, logoScale, releaseNativeSplash]);

  return (
    <View style={styles.root}>
      <View style={styles.stage}>
        <View style={styles.sunLayer}>
          <BrandSunburst size={SUN_SIZE} />
        </View>

        <Animated.View
          style={[
            styles.logoWrap,
            isPartner ? styles.logoWrapPartner : styles.logoWrapCustomer,
            {
              opacity: logoOpacity,
              transform: [{ scale: logoScale }],
            },
          ]}
        >
          {isPartner ? (
            <BrandLogoIcon size={O_SIZE} />
          ) : (
            <Image
              source={brandAssets.logoIcon}
              style={styles.logoIcon}
              resizeMode="contain"
              accessibilityRole="image"
              accessibilityLabel="OorjaMan logo"
            />
          )}
        </Animated.View>
      </View>

      <BrandSplashWordmark
        roleLabel={isPartner ? "Partner app" : undefined}
        tagline={BRAND_TAGLINE}
      />

      <View style={styles.loadingWrap}>
        <BrandLoadingIndicator
          delayMs={SPLASH_LOADING_DELAY_MS}
          loop={false}
          onComplete={onAnimationsComplete}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  stage: {
    width: "100%",
    maxWidth: 360,
    minHeight: 300,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  sunLayer: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 0,
  },
  logoWrap: {
    zIndex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  logoWrapCustomer: {
    width: O_SIZE,
    height: O_SIZE,
  },
  logoWrapPartner: {
    overflow: "visible",
  },
  logoIcon: {
    width: O_SIZE,
    height: O_SIZE,
  },
  loadingWrap: {
    marginTop: 36,
  },
});
