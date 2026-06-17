import sharp from "sharp";
import { letterheadFooterBackgroundSvg, LETTERHEAD_FOOTER } from "../../packages/utils/src/brand-print/letterhead-footer-bg.mjs";

/** Rasterize full footer wave background for embedding in PDF. */
export async function rasterizeLetterheadFooterBackground(pageWidthPt, footerHeightPt) {
  const pxW = Math.max(400, Math.round(pageWidthPt * 2.5));
  const pxH = Math.max(80, Math.round(footerHeightPt * 2.5));
  const svg = letterheadFooterBackgroundSvg(LETTERHEAD_FOOTER.viewWidthMm, LETTERHEAD_FOOTER.heightMm);
  return sharp(Buffer.from(svg), { density: 288 }).resize(pxW, pxH, { fit: "fill" }).png().toBuffer();
}
