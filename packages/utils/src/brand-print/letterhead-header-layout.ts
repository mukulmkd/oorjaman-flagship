/** Letterhead header layout — lockup left, icon contact block right, two-tone rule. */
export const LETTERHEAD_HEADER = {
  marginMm: 14,
  lockupWidthMm: 62,
  separatorGapMm: 5,
  /** Left segment of the header rule (green); right segment is navy — edge to edge. */
  separatorGreenRatio: 2 / 3,
  separatorThicknessPt: 2.75,
  contact: {
    textSizePt: 9.5,
    rowStepPt: 14,
    iconPt: 11,
    iconTextGapPt: 5,
  },
} as const;

/** Faded logo icon — bottom-right above the wave footer. */
export const LETTERHEAD_WATERMARK = {
  sizeMm: 40,
  marginRightMm: 14,
  gapAboveWaveMm: 2,
} as const;
