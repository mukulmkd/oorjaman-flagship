import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { Animated, Easing, type StyleProp, type ViewStyle } from "react-native";

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Fade duration in ms */
  duration?: number;
};

/** Soft entrance when switching out of skeleton / loading branches (native-driver opacity). */
export function FadeInView({ children, style, duration = 320 }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    opacity.setValue(0);
    Animated.timing(opacity, {
      toValue: 1,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [duration, opacity]);

  return <Animated.View style={[style, { opacity }]}>{children}</Animated.View>;
}
