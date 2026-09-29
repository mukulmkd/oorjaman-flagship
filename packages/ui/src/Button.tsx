import { useEffect, useRef, type ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type PressableProps,
} from "react-native";
import { colors, fontFamily, fontSize, lineHeight, spacing } from "@oorjaman/config";
import { LoadingSpinner } from "./LoadingSpinner";
import {
  getAnimatedPressable,
  getHasReanimated,
  getUseAnimatedStyle,
  getUseSharedValue,
  getWithTiming,
} from "./reanimated-safe";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "destructive" | "danger";
type Size = "sm" | "md" | "lg";

type Props = PressableProps & {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
};

function useSinglePress(onPress: Props["onPress"], blocked: boolean) {
  const lockRef = useRef(false);
  const blockedRef = useRef(blocked);
  blockedRef.current = blocked;

  useEffect(() => {
    if (!blocked) lockRef.current = false;
  }, [blocked]);

  return (event: GestureResponderEvent) => {
    if (blockedRef.current || lockRef.current) return;
    lockRef.current = true;
    onPress?.(event);
    requestAnimationFrame(() => {
      if (!blockedRef.current) lockRef.current = false;
    });
  };
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  loading,
  disabled,
  ...rest
}: Props) {
  const hasReanimated = getHasReanimated();
  const AnimatedPressable = getAnimatedPressable();
  const useAnimatedStyleSafe = getUseAnimatedStyle();
  const useSharedValueSafe = getUseSharedValue();
  const withTimingSafe = getWithTiming();

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
  onPress,
  ...rest
}: Props) {
  const isDisabled = Boolean(disabled || loading);
  const normalizedVariant: Variant = variant === "danger" ? "destructive" : variant;
  const handlePress = useSinglePress(onPress, isDisabled);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: Boolean(loading) }}
      disabled={isDisabled}
      onPress={handlePress}
      style={(state) => [
        styles.base,
        sizeStyles[size],
        variantStyles[normalizedVariant],
        state.pressed && !isDisabled && styles.pressed,
        typeof style === "function" ? style(state) : style,
      ]}
      {...rest}
    >
      <ButtonContent
        loading={Boolean(loading)}
        size={size}
        variant={normalizedVariant}
      >
        {children}
      </ButtonContent>
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
  onPress,
  style,
  ...rest
}: Props) {
  const AnimatedPressableImpl = getAnimatedPressable()!;
  const useSharedValueSafe = getUseSharedValue();
  const useAnimatedStyleSafe = getUseAnimatedStyle();
  const withTimingSafe = getWithTiming();
  const isDisabled = Boolean(disabled || loading);
  const normalizedVariant: Variant = variant === "danger" ? "destructive" : variant;
  const handlePress = useSinglePress(onPress, isDisabled);
  const pressedOpacity = useSharedValueSafe!(1);
  const animatedStyle = useAnimatedStyleSafe!(() => ({
    opacity: pressedOpacity.value,
  }));

  useEffect(() => {
    if (loading) pressedOpacity.value = 1;
  }, [loading, pressedOpacity]);

  return (
    <AnimatedPressableImpl
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: Boolean(loading) }}
      disabled={isDisabled}
      onPress={handlePress}
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
        style,
      ]}
      {...rest}
    >
      <ButtonContent loading={Boolean(loading)} size={size} variant={normalizedVariant}>
        {children}
      </ButtonContent>
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
    backgroundColor: colors.primaryMuted,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  outline: {
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  ghost: {
    backgroundColor: colors.muted,
    borderWidth: 1.5,
    borderColor: colors.border,
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

function ButtonContent({
  loading,
  size,
  variant,
  children,
}: {
  loading: boolean;
  size: Size;
  variant: Variant;
  children: ReactNode;
}) {
  const label =
    typeof children === "string" || typeof children === "number" ? (
      <Text
        style={[
          styles.label,
          labelSizes[size],
          variant === "primary"
            ? styles.labelOnAccent
            : variant === "destructive"
              ? styles.labelOnDestructive
              : variant === "outline" || variant === "secondary"
                ? styles.labelOutline
                : styles.labelGhost,
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.85}
      >
        {children}
      </Text>
    ) : (
      children
    );

  if (!loading) return label;

  return (
    <View style={styles.loadingStack}>
      {label}
      <LoadingSpinner color={spinnerColor(variant)} width={size === "sm" ? 56 : 72} />
    </View>
  );
}

function spinnerColor(variant: Variant): string {
  if (variant === "destructive") return colors.destructiveForeground;
  if (variant === "primary") return colors.primaryForeground;
  return colors.primary;
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    maxWidth: "100%",
  },
  loadingStack: {
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    maxWidth: "100%",
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
    color: colors.primary,
  },
  labelGhost: {
    color: colors.foreground,
  },
});
