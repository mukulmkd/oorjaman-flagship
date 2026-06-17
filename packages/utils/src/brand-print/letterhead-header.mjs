/**
 * Draw letterhead header: lockup left, icon contact rows right, two-tone rule.
 * Shared by admin browser PDF and `npm run brand:print`.
 */

const LETTERHEAD_HEADER = {
  marginMm: 14,
  lockupWidthMm: 62,
  separatorGapMm: 5,
  separatorGreenRatio: 2 / 3,
  /** Full-bleed rule at the page edges. */
  separatorThicknessPt: 2.75,
  contact: {
    textSizePt: 9.5,
    rowStepPt: 14,
    iconPt: 11,
    iconTextGapPt: 5,
  },
};

const LETTERHEAD_WATERMARK = {
  sizeMm: 40,
  marginRightMm: 14,
  gapAboveWaveMm: 2,
};

function footerWaveTopRightPt(footerH) {
  return footerH * (1 - (54 - 18.5) / 54);
}

/**
 * @param {import('pdf-lib').PDFPage} page
 * @param {{
 *   pageW: number;
 *   pageH: number;
 *   contact: { phone: string; email: string; web: string };
 *   lockupImg: import('pdf-lib').PDFImage;
 *   icons: { phone: import('pdf-lib').PDFImage; email: import('pdf-lib').PDFImage; globe: import('pdf-lib').PDFImage };
 *   font: import('pdf-lib').PDFFont;
 *   mm: (n: number) => number;
 *   colors: { man: import('pdf-lib').Color; oorja: import('pdf-lib').Color };
 * }} opts
 * @returns {{ separatorY: number; lockupH: number }}
 */
export function drawLetterheadHeader(page, { pageW, pageH, contact, lockupImg, icons, font, mm, colors }) {
  const { marginMm, lockupWidthMm, separatorGapMm, separatorGreenRatio, separatorThicknessPt, contact: c } =
    LETTERHEAD_HEADER;

  const margin = mm(marginMm);
  const lockupW = mm(lockupWidthMm);
  const lockupH = (lockupImg.height / lockupImg.width) * lockupW;
  const headerTop = pageH - margin;
  const lockupY = headerTop - lockupH;

  page.drawImage(lockupImg, { x: margin, y: lockupY, width: lockupW, height: lockupH });

  const rows = [
    { text: contact.phone, icon: icons.phone },
    { text: contact.email, icon: icons.email },
    { text: contact.web, icon: icons.globe },
  ];

  const textWidths = rows.map((row) => font.widthOfTextAtSize(row.text, c.textSizePt));
  const blockW = c.iconPt + c.iconTextGapPt + Math.max(...textWidths);
  const blockRight = pageW - margin;
  const blockLeft = blockRight - blockW;
  const iconX = blockLeft;
  const textX = blockLeft + c.iconPt + c.iconTextGapPt;
  const blockMidY = lockupY + lockupH / 2;
  const rowYs = [blockMidY + c.rowStepPt, blockMidY, blockMidY - c.rowStepPt];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const cy = rowYs[i];
    const iconY = cy - c.iconPt / 2;
    page.drawImage(row.icon, { x: iconX, y: iconY, width: c.iconPt, height: c.iconPt });
    page.drawText(row.text, {
      x: textX,
      y: cy - c.textSizePt * 0.35,
      size: c.textSizePt,
      font,
      color: colors.man,
    });
  }

  const separatorY = lockupY - mm(separatorGapMm);
  const splitX = pageW * separatorGreenRatio;

  page.drawLine({
    start: { x: 0, y: separatorY },
    end: { x: splitX, y: separatorY },
    thickness: separatorThicknessPt,
    color: colors.oorja,
  });
  page.drawLine({
    start: { x: splitX, y: separatorY },
    end: { x: pageW, y: separatorY },
    thickness: separatorThicknessPt,
    color: colors.man,
  });

  return { separatorY, lockupH };
}

/**
 * @param {import('pdf-lib').PDFPage} page
 * @param {{
 *   pageW: number;
 *   wmImg: import('pdf-lib').PDFImage;
 *   footerH: number;
 *   mm: (n: number) => number;
 * }} opts
 */
export function drawLetterheadWatermark(page, { pageW, wmImg, footerH, mm }) {
  const wmSize = mm(LETTERHEAD_WATERMARK.sizeMm);
  const margin = mm(LETTERHEAD_WATERMARK.marginRightMm);
  const gap = mm(LETTERHEAD_WATERMARK.gapAboveWaveMm);
  const waveTop = footerWaveTopRightPt(footerH);
  page.drawImage(wmImg, {
    x: pageW - margin - wmSize,
    y: waveTop + gap,
    width: wmSize,
    height: wmSize,
  });
}

export { LETTERHEAD_HEADER };
