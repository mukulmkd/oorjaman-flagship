import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { fontFamily } from "../constants/fonts";
import { brandTextColors } from "../lib/brand-assets";

export const SPLASH_LOADING_DELAY_MS = 1500;
export const SPLASH_LOADING_FADE_MS = 360;
export const SPLASH_LOADING_FILL_MS = 1800;

type Props = {
  /** Fade in after splash wordmark / tagline entrance. */
  delayMs?: number;
  /** Splash runs once; in-app loaders loop. */
  loop?: boolean;
  onComplete?: () => void;
};

const TRACK_WIDTH = 200;
const TRACK_HEIGHT = 4;
const TRACK_GREY = "#e4e4e4";

/** Left-anchored scale so the bar grows from the track start (native-driver safe). */
function leftAnchoredScale(
  progress: Animated.Value | Animated.AnimatedInterpolation<number>,
) {
  return [
    {
      translateX: progress.interpolate({
        inputRange: [0, 1],
        outputRange: [-TRACK_WIDTH / 2, 0],
      }),
    },
    { scaleX: progress },
  ];
}

/**
 * Gray “Loading…” label with a bar that fills green → blue.
 */
export function BrandLoadingIndicator({
  delayMs = 0,
  loop = true,
  onComplete,
}: Props) {
  const rootOpacity = useRef(new Animated.Value(0)).current;
  const fillProgress = useRef(new Animated.Value(0)).current;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    let fillAnim: Animated.CompositeAnimation | null = null;
    let completed = false;

    const notifyComplete = () => {
      if (completed || loop) return;
      completed = true;
      onCompleteRef.current?.();
    };

    const fadeTimer = setTimeout(() => {
      Animated.timing(rootOpacity, {
        toValue: 1,
        duration: SPLASH_LOADING_FADE_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }, delayMs);

    const fillTimer = setTimeout(() => {
      const fillTiming = Animated.timing(fillProgress, {
        toValue: 1,
        duration: SPLASH_LOADING_FILL_MS,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      });

      fillAnim = loop
        ? Animated.loop(fillTiming)
        : Animated.sequence([fillTiming, Animated.delay(120)]);

      fillAnim.start(({ finished }) => {
        if (finished) notifyComplete();
      });
    }, delayMs);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(fillTimer);
      fillAnim?.stop();
      notifyComplete();
    };
  }, [delayMs, loop]);

  const greenTransform = useMemo(
    () => leftAnchoredScale(fillProgress),
    [fillProgress],
  );
  const blueScale = useMemo(
    () =>
      fillProgress.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0, 0, 1],
      }),
    [fillProgress],
  );
  const blueTransform = useMemo(() => leftAnchoredScale(blueScale), [blueScale]);

  return (
    <Animated.View style={[styles.root, { opacity: rootOpacity }]}>
      <Text style={styles.label}>Loading...</Text>
      <View style={styles.track}>
        <Animated.View
          style={[
            styles.fill,
            {
              backgroundColor: brandTextColors.oorja,
              transform: greenTransform,
            },
          ]}
        />
        <Animated.View
          style={[
            styles.fill,
            {
              backgroundColor: brandTextColors.man,
              transform: blueTransform,
            },
          ]}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    minHeight: 32,
  },
  label: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
    lineHeight: 16,
    letterSpacing: 0.3,
    color: brandTextColors.tagline,
  },
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: TRACK_GREY,
    overflow: "hidden",
  },
  fill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: TRACK_WIDTH,
    borderRadius: TRACK_HEIGHT / 2,
  },
});
