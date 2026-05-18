import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type GestureResponderEvent,
  type PressableProps,
} from "react-native";
import { colors, fontFamily, fontSize, lineHeight, spacing } from "@oorjaman/config";
import {
  AnimatedPressable,
  hasReanimated,
  useAnimatedStyleSafe,
  useSharedValueSafe,
  withTimingSafe,
} from "./reanimated-safe";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "destructive" | "danger";
type Size = "sm" | "md" | "lg";

type Props = PressableProps & {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  loading,
  disabled,
  ...rest
}: Props) {
  if (hasReanimated && AnimatedPressable && useAnimatedStyleSafe && useSharedValueSafe && withTimingSafe) {
    return (
      <AnimatedButton
        children={children}
        variant={variant}
        size={size}
        loading={loading}
        disabled={disabled}
        {...rest}
      />
    );
  }

  return (
    <FallbackButton
      children={children}
      variant={variant}
      size={size}
      loading={loading}
      disabled={disabled}
      {...rest}
    />
  );
}

function FallbackButton({
  children,
  variant = "primary",
  size = "md",
  loading,
  disabled,
  style,
  ...rest
}: Props) {
  const isDisabled = Boolean(disabled || loading);
  const normalizedVariant: Variant = variant === "danger" ? "destructive" : variant;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      style={(state) => [
        styles.base,
        sizeStyles[size],
        variantStyles[normalizedVariant],
        state.pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        typeof style === "function" ? style(state) : style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator
          color={
            normalizedVariant === "destructive"
              ? colors.destructiveForeground
              : normalizedVariant === "primary"
                ? colors.primaryForeground
                : colors.primary
          }
        />
      ) : (
        <Text
          style={[
            styles.label,
            labelSizes[size],
            normalizedVariant === "primary"
              ? styles.labelOnAccent
              : normalizedVariant === "destructive"
                ? styles.labelOnDestructive
                : normalizedVariant === "outline" || normalizedVariant === "secondary"
                ? styles.labelOutline
                : styles.labelGhost,
          ]}
        >
          {children}
        </Text>
      )}
    </Pressable>
  );
}

function AnimatedButton({
  children,
  variant = "primary",
  size = "md",
  loading,
  disabled,
  onPressIn,
  onPressOut,
  style,
  ...rest
}: Props) {
  const AnimatedPressableImpl = AnimatedPressable as NonNullable<typeof AnimatedPressable>;
  const isDisabled = Boolean(disabled || loading);
  const normalizedVariant: Variant = variant === "danger" ? "destructive" : variant;
  const pressedOpacity = useSharedValueSafe!(1);
  const animatedStyle = useAnimatedStyleSafe!(() => ({
    opacity: pressedOpacity.value,
  }));

  return (
    <AnimatedPressableImpl
      accessibilityRole="button"
      disabled={isDisabled}
      onPressIn={(event: GestureResponderEvent) => {
        pressedOpacity.value = withTimingSafe!(0.88, { duration: 90 });
        onPressIn?.(event);
      }}
      onPressOut={(event: GestureResponderEvent) => {
        pressedOpacity.value = withTimingSafe!(1, { duration: 140 });
        onPressOut?.(event);
      }}
      style={[
        animatedStyle,
        styles.base,
        sizeStyles[size],
        variantStyles[normalizedVariant],
        isDisabled && styles.disabled,
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator
          color={
            normalizedVariant === "destructive"
              ? colors.destructiveForeground
              : normalizedVariant === "primary"
                ? colors.primaryForeground
                : colors.primary
          }
        />
      ) : (
        <Text
          style={[
            styles.label,
            labelSizes[size],
            normalizedVariant === "primary"
              ? styles.labelOnAccent
              : normalizedVariant === "destructive"
                ? styles.labelOnDestructive
                : normalizedVariant === "outline" || normalizedVariant === "secondary"
                ? styles.labelOutline
                : styles.labelGhost,
          ]}
        >
          {children}
        </Text>
      )}
    </AnimatedPressableImpl>
  );
}

const sizeStyles = StyleSheet.create({
  sm: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: 48,
    borderRadius: 10,
  },
  md: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 52,
    borderRadius: 11,
  },
  lg: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg + spacing.xs,
    minHeight: 56,
    borderRadius: 12,
  },
});

const variantStyles = StyleSheet.create({
  primary: {
    backgroundColor: colors.primary,
    borderWidth: 0,
  },
  destructive: {
    backgroundColor: colors.destructive,
    borderWidth: 0,
  },
  secondary: {
    backgroundColor: colors.backgroundSecondary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  outline: {
    backgroundColor: colors.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  ghost: {
    backgroundColor: "transparent",
    borderWidth: 0,
  },
});

const labelSizes = StyleSheet.create({
  sm: {
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
  },
  md: {
    fontSize: fontSize.md,
    lineHeight: lineHeight.md,
  },
  lg: {
    fontSize: fontSize.lg,
    lineHeight: lineHeight.lg,
  },
});

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    maxWidth: "100%",
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.88,
  },
  label: {
    fontFamily: fontFamily.medium,
    textAlign: "center",
    flexShrink: 1,
  },
  labelOnAccent: {
    color: colors.primaryForeground,
  },
  labelOnDestructive: {
    color: colors.destructiveForeground,
  },
  labelOutline: {
    color: colors.foreground,
  },
  labelGhost: {
    color: colors.foreground,
  },
});
