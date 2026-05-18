/** 4px grid scale (xs -> xxxl) for web + React Native. */
export const spacing = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,

  /** Backward-compatible aliases */
  "3xs": 2,
  "2xl": 32,
  "3xl": 48,
} as const;

export type SpacingToken = keyof typeof spacing;
