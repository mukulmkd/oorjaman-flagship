/**
 * Cross-platform typography tokens.
 * - Primary: Plus Jakarta Sans (Expo: `PlusJakartaSans_*`; web falls through the stack)
 * - Secondary: same family (reserved for future display / marketing styles)
 */
export const typography = {
  family: {
    primary: {
      regular:
        "Plus Jakarta Sans, PlusJakartaSans_400Regular, Inter, Inter_400Regular, system-ui, -apple-system, Segoe UI, sans-serif",
      medium:
        "Plus Jakarta Sans, PlusJakartaSans_500Medium, Inter, Inter_500Medium, system-ui, -apple-system, Segoe UI, sans-serif",
      semibold:
        "Plus Jakarta Sans, PlusJakartaSans_600SemiBold, Inter, Inter_600SemiBold, system-ui, -apple-system, Segoe UI, sans-serif",
      bold:
        "Plus Jakarta Sans, PlusJakartaSans_700Bold, Inter, Inter_700Bold, system-ui, -apple-system, Segoe UI, sans-serif",
    },
    secondary: {
      regular:
        "Plus Jakarta Sans, PlusJakartaSans_400Regular, Inter, Inter_400Regular, system-ui, -apple-system, Segoe UI, sans-serif",
      medium:
        "Plus Jakarta Sans, PlusJakartaSans_500Medium, Inter, Inter_500Medium, system-ui, -apple-system, Segoe UI, sans-serif",
      semibold:
        "Plus Jakarta Sans, PlusJakartaSans_600SemiBold, Inter, Inter_600SemiBold, system-ui, -apple-system, Segoe UI, sans-serif",
      bold:
        "Plus Jakarta Sans, PlusJakartaSans_700Bold, Inter, Inter_700Bold, system-ui, -apple-system, Segoe UI, sans-serif",
    },
  },
  size: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 22,
    xxl: 28,
    display: 36,
  },
  weight: {
    regular: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  },
} as const;

export const lineHeight = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 28,
  xl: 32,
  xxl: 38,
  display: 44,
} as const;

/** Backward compatible aliases used in existing app code. */
export const fontFamily = {
  regular: typography.family.primary.regular,
  medium: typography.family.primary.medium,
  semiBold: typography.family.primary.semibold,
  bold: typography.family.primary.bold,
  secondaryRegular: typography.family.secondary.regular,
  secondaryMedium: typography.family.secondary.medium,
  secondarySemiBold: typography.family.secondary.semibold,
  secondaryBold: typography.family.secondary.bold,
} as const;

/** Backward compatible aliases used in existing app code. */
export const fontSize = {
  xs: typography.size.xs,
  sm: typography.size.sm,
  md: typography.size.md,
  lg: typography.size.lg,
  xl: typography.size.xl,
  "2xl": typography.size.xxl,
  "3xl": typography.size.display,
} as const;
