import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { PressableProps } from "react-native";
import { colors, spacing } from "@oorjaman/config";
import {
  AnimatedPressable,
  hasReanimated,
  useAnimatedStyleSafe,
  useSharedValueSafe,
  withTimingSafe,
} from "./reanimated-safe";

type Variant = "elevated" | "outline" | "muted";

type Base = {
  children: ReactNode;
  padded?: boolean;
  variant?: Variant;
};

export type CardProps = Base & {
  onPress?: PressableProps["onPress"];
  accessibilityLabel?: string;
};

export function Card({
  children,
  padded = true,
  variant = "elevated",
  onPress,
  accessibilityLabel,
}: CardProps) {
  if (hasReanimated && AnimatedPressable && useAnimatedStyleSafe && useSharedValueSafe && withTimingSafe) {
    return (
      <AnimatedCard
        children={children}
        padded={padded}
        variant={variant}
        onPress={onPress}
        accessibilityLabel={accessibilityLabel}
      />
    );
  }

  return (
    <FallbackCard
      children={children}
      padded={padded}
      variant={variant}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
    />
  );
}

function FallbackCard({
  children,
  padded = true,
  variant = "elevated",
  onPress,
  accessibilityLabel,
}: CardProps) {
  const shell = [
    styles.base,
    padded && styles.padded,
    variant === "elevated" && styles.elevated,
    variant === "outline" && styles.outline,
    variant === "muted" && styles.muted,
  ];

  if (onPress != null) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={({ pressed }) => [...shell, pressed && styles.pressed]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={shell}>{children}</View>;
}

function AnimatedCard({
  children,
  padded = true,
  variant = "elevated",
  onPress,
  accessibilityLabel,
}: CardProps) {
  const AnimatedPressableImpl = AnimatedPressable as NonNullable<typeof AnimatedPressable>;
  const shell = [
    styles.base,
    padded && styles.padded,
    variant === "elevated" && styles.elevated,
    variant === "outline" && styles.outline,
    variant === "muted" && styles.muted,
  ];
  const pressedScale = useSharedValueSafe!(1);
  const animatedStyle = useAnimatedStyleSafe!(() => ({
    transform: [{ scale: pressedScale.value }],
  }));

  if (onPress != null) {
    return (
      <AnimatedPressableImpl
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        onPressIn={() => {
          pressedScale.value = withTimingSafe!(0.98, { duration: 90 });
        }}
        onPressOut={() => {
          pressedScale.value = withTimingSafe!(1, { duration: 140 });
        }}
        style={[animatedStyle, ...shell]}
      >
        {children}
      </AnimatedPressableImpl>
    );
  }

  return <View style={shell}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 14,
    overflow: "hidden",
  },
  padded: {
    padding: spacing.lg,
  },
  elevated: {
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  outline: {
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  muted: {
    backgroundColor: colors.muted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
});
