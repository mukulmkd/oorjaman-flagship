import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { hideNativeSplashScreenOnce } from "@oorjaman/ui/safe-splash-screen";
import { PARTNER_APP_TAGLINE } from "../lib/brand-assets";
import {
  BrandLoadingIndicator,
  SPLASH_LOADING_DELAY_MS,
} from "./brand-loading-indicator";
import { BrandLogoIcon } from "./brand-logo-icon";
import { BrandSunburst } from "./brand-sunburst";
import { BrandSplashWordmark } from "./brand-wordmark";

const O_SIZE = 196;
/** Rays extend ~half the O width beyond the logo (kit reference). */
const SUN_SIZE = Math.round(O_SIZE * 1.5);

type Props = {
  releaseNativeSplash?: boolean;
  onAnimationsComplete?: () => void;
};

export function BrandSplash({ releaseNativeSplash = true, onAnimationsComplete }: Props) {
  const logoScale = useRef(new Animated.Value(0.88)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
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
            {
              opacity: logoOpacity,
              transform: [{ scale: logoScale }],
            },
          ]}
        >
          <BrandLogoIcon size={O_SIZE} />
        </Animated.View>
      </View>

      <BrandSplashWordmark
        roleLabel="Partner app"
        tagline={PARTNER_APP_TAGLINE}
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
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 0,
  },
  logoWrap: {
    zIndex: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  loadingWrap: {
    marginTop: 36,
  },
});
