/**
 * Letterhead footer — raster wave background only (no text).
 */

export const LETTERHEAD_FOOTER = {
  heightMm: 50,
  viewWidthMm: 210,
};

/**
 * @param {import('pdf-lib').PDFPage} page
 * @param {{
 *   pageW: number;
 *   footerH: number;
 *   backgroundImg: import('pdf-lib').PDFImage;
 * }} opts
 */
export function drawLetterheadFooter(page, { pageW, footerH, backgroundImg }) {
  page.drawImage(backgroundImg, { x: 0, y: 0, width: pageW, height: footerH });
}
