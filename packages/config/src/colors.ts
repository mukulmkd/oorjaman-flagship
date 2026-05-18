/**
 * Centralized semantic colors for web + React Native.
 *
 * Brand mapping (OorjaMan logo):
 * - Leaf / “Oorja” green → primary CTAs, success, interactive emphasis
 * - Deep blue / “Man” navy → typography and structure
 * - Icon lime accents → accent + focus ring (paired sparingly with green)
 * - Neutral cool grays → surfaces and secondary text (aligned to navy undertone)
 */
export const colors = {
  /** Leaf green - primary actions */
  primary: "#1f8660",
  /** Cool-tint canvas (subtle nod to greens / blues without tinting cards) */
  background: "#f6faf9",
  backgroundSecondary: "#edf2f2",
  textPrimary: "#0f2938",
  textSecondary: "#516a7b",
  border: "#c5d9d4",

  /** Backward-compatible aliases */
  foreground: "#0f2938",
  muted: "#e9f1ef",
  mutedForeground: "#516a7b",
  primaryForeground: "#ffffff",
  primaryMuted: "#d8eee4",
  primaryBorder: "#1a734f",
  card: "#ffffff",
  cardForeground: "#0f2938",
  elevated: "#f0f7f5",
  destructive: "#dc2626",
  destructiveForeground: "#fafafa",
  /** Focus rings / active outline - airy green lifted from logo */
  ring: "#5cbd8c",
  /** Lime highlight from icon gradients - badges, tertiary emphasis */
  accent: "#9fc93c",
  accentForeground: "#0f2938",

  /** Solar / eco-adjacent; kept distinct from destructive */
  success: "#1a7d52",
  error: "#dc2626",
} as const;

export type ColorToken = keyof typeof colors;
