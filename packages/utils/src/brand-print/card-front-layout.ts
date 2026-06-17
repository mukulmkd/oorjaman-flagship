import { CARD_PRINT_MM, CARD_PRINT_PX } from "./print-spec";

/** Lockup placement on card front (mm, viewBox 0 0 90 54). */
export const CARD_FRONT_LOCKUP = {
  x: 18,
  y: 3.2,
  w: 54,
  h: 29.5,
} as const;

/** Minimum lockup raster width for sharp 300 DPI print (2× oversample). */
export const CARD_FRONT_LOCKUP_PRINT_MIN_PX = Math.ceil(
  (CARD_FRONT_LOCKUP.w / CARD_PRINT_MM.w) * CARD_PRINT_PX.w * 2,
);

export const CARD_FRONT_WAVE_PATHS = [
  {
    fill: "#1C4276",
    d: "M 0 54 L 0 49.5 C 11 47.5, 22 50.5, 34 48.5 C 48 46, 62 49.5, 76 43.5 C 86 39, 90 30.5, 90 18.5 L 90 54 Z",
  },
  {
    fill: "#3d7a6e",
    opacity: 0.92,
    d: "M 0 54 L 0 51.2 C 14 49.5, 28 51.5, 42 49.8 C 56 48, 72 51, 90 47.5 L 90 54 Z",
  },
  {
    fill: "#549048",
    d: "M 0 54 L 0 52.4 C 16 50.8, 32 52.6, 48 51 C 64 49.5, 78 52.2, 90 50.2 L 90 54 Z",
  },
] as const;

export function cardFrontWaveSvg(): string {
  return CARD_FRONT_WAVE_PATHS.map((p) => {
    const opacity = "opacity" in p && p.opacity != null ? ` opacity="${p.opacity}"` : "";
    return `<path fill="${p.fill}"${opacity} d="${p.d}"/>`;
  }).join("\n  ");
}
