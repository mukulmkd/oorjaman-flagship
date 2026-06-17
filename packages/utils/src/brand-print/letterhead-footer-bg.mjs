/** Combined letterhead footer background — green accent under navy wave (viewBox 210×H, flat bottom). */

export const LETTERHEAD_FOOTER = {
  heightMm: 50,
  viewWidthMm: 210,
};

const GREEN_CREST_RATIO = 3.2 / 22;
const GREEN_MID_RATIO = 1.4 / 22;
const GREEN_END_RATIO = 1.1 / 22;

function yFromCard(yc, H) {
  return H - ((54 - yc) * H) / 54;
}

function letterheadFooterGreenAccentPath(W, H) {
  const extent = W * 0.38;
  const crest = H * (1 - GREEN_CREST_RATIO * 1.2);
  const mid = H * (1 - GREEN_MID_RATIO);
  const endY = H * (1 - GREEN_END_RATIO * 0.5);
  return (
    `M 0 ${H} L 0 ${crest} ` +
    `C ${extent * 0.32} ${mid}, ${extent * 0.68} ${endY}, ${extent} ${H * 0.93} ` +
    `L ${extent} ${H} Z`
  );
}

function letterheadFooterNavyPathFromCard(W, H) {
  const sx = W / 90;
  const y = (yc) => yFromCard(yc, H);
  return (
    `M 0 ${H} L 0 ${y(49.5)} ` +
    `C ${11 * sx} ${y(47.5)}, ${22 * sx} ${y(50.5)}, ${34 * sx} ${y(48.5)} ` +
    `C ${48 * sx} ${y(46)}, ${62 * sx} ${y(49.5)}, ${76 * sx} ${y(43.5)} ` +
    `C ${86 * sx} ${y(39)}, ${90 * sx} ${y(30.5)}, ${90 * sx} ${y(18.5)} ` +
    `L ${W} ${H} Z`
  );
}

/** @param {number} [viewW] @param {number} [viewH] */
export function letterheadFooterBackgroundSvg(
  viewW = LETTERHEAD_FOOTER.viewWidthMm,
  viewH = LETTERHEAD_FOOTER.heightMm,
) {
  const w = viewW;
  const h = viewH;
  const greenAccent = letterheadFooterGreenAccentPath(w, h);
  const navy = letterheadFooterNavyPathFromCard(w, h);
  const accentW = w * 0.38;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
  <defs>
    <linearGradient id="footerGrad" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="${h}">
      <stop offset="0%" stop-color="#D4ED9A"/>
      <stop offset="28%" stop-color="#A8D65A"/>
      <stop offset="58%" stop-color="#6FAF52"/>
      <stop offset="100%" stop-color="#457A3A"/>
    </linearGradient>
    <linearGradient id="footerGradBlend" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${accentW}" y2="0">
      <stop offset="0%" stop-color="#A8D65A" stop-opacity="0.95"/>
      <stop offset="45%" stop-color="#6F9A62" stop-opacity="0.65"/>
      <stop offset="78%" stop-color="#4A7A6E" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#1C4276" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <path fill="url(#footerGrad)" d="${greenAccent}"/>
  <path fill="url(#footerGradBlend)" d="${greenAccent}" opacity="0.65"/>
  <path fill="#1C4276" d="${navy}"/>
</svg>`;
}
