/** Standard business card size at 300 DPI (90×54 mm). */
export const CARD_PRINT_MM = { w: 90, h: 54 } as const;
export const CARD_PRINT_DPI = 300;
export const CARD_PRINT_PX = {
  w: Math.round((CARD_PRINT_MM.w / 25.4) * CARD_PRINT_DPI),
  h: Math.round((CARD_PRINT_MM.h / 25.4) * CARD_PRINT_DPI),
} as const;
