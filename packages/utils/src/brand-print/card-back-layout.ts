/** Name / title block on card back (mm). */
export const CARD_BACK_HEADER = {
  nameX: 7,
  nameY: 12,
  nameSize: 4.8,
  titleY: 15.5,
  titleSize: 2.95,
} as const;

/** Shared layout for business-card back contact block (mm, viewBox 0 0 90 54). */
export const CARD_BACK_CONTACT = {
  iconCx: 9.25,
  textX: 13,
  textSize: 2.3,
  rowYs: [31, 34.7, 38.4, 42.1] as const,
  iconDrawSize: 3.2,
} as const;

/** Heroicons-style phone receiver (20×20 viewBox). */
export const CARD_BACK_PHONE_PATH =
  "M2 3.5A1.5 1.5 0 013.5 2h1.148a1.5 1.5 0 011.465 1.175l.716 3.223a1.5 1.5 0 01-1.052 1.767l-.933.267a13.75 13.75 0 006.105 6.105l.267-.933a1.5 1.5 0 011.767-1.052l3.223.716A1.5 1.5 0 0118 15.352V16.5a1.5 1.5 0 01-1.5 1.5H15c-1.149 0-2.263-.15-3.326-.43A19.022 19.022 0 012.43 8.326 19.048 19.048 0 012 5V3.5z";

/** Map pin path in 20×20 box. */
export const CARD_BACK_PIN_PATH =
  "M10 18 C10 18 4.5 12.2 4.5 8.2 C4.5 5.1 6.9 2.5 10 2.5 C13.1 2.5 15.5 5.1 15.5 8.2 C15.5 12.2 10 18 10 18 Z M10 10.2 C11.2 10.2 12.2 9.2 12.2 8 C12.2 6.8 11.2 5.8 10 5.8 C8.8 5.8 7.8 6.8 7.8 8 C7.8 9.2 8.8 10.2 10 10.2 Z";

/** Back corner accent — flows down the right edge, curves into a longer bottom blend. */
export const CARD_BACK_CORNER = {
  fill: "#1C4276",
  /** Vertical rise on the right edge (mm). */
  rightHeight: 5.5,
  /** Horizontal run along the bottom edge (mm). */
  bottomRun: 34,
  /**
   * Closed path (mm): short right strip + long bottom strip + smooth blend curve.
   * Bottom span (34 mm) is much longer than right height (5.5 mm).
   */
  fillPath: "M 56 54 L 90 54 L 90 48.5 C 90 52.8 68 54 56 54 Z",
} as const;

export function cardBackCornerWaveSvg(): string {
  return `<path fill="${CARD_BACK_CORNER.fill}" d="${CARD_BACK_CORNER.fillPath}"/>`;
}

function svgIconPath(cx: number, cy: number, path: string, viewSize = 20): string {
  const s = CARD_BACK_CONTACT.iconDrawSize / viewSize;
  return `<g transform="translate(${cx} ${cy}) scale(${s}) translate(${-viewSize / 2} ${-viewSize / 2})"><path fill="#549048" d="${path}"/></g>`;
}

/** Wireframe internet globe (20×20 viewBox). */
export function cardBackGlobeIconSvg(cx: number, cy: number): string {
  const s = CARD_BACK_CONTACT.iconDrawSize / 20;
  return `<g transform="translate(${cx} ${cy}) scale(${s}) translate(-10 -10)" fill="none" stroke="#549048" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="10" cy="10" r="7.5"/>
    <ellipse cx="10" cy="10" rx="3" ry="7.5"/>
    <line x1="2.5" y1="10" x2="17.5" y2="10"/>
    <path d="M10 2.5 C13.5 5.5 13.5 14.5 10 17.5"/>
    <path d="M10 2.5 C6.5 5.5 6.5 14.5 10 17.5"/>
  </g>`;
}

function svgIconText(cx: number, cy: number, label: string, fontSize: number): string {
  return `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" font-family="Helvetica, Arial, sans-serif" font-size="${fontSize}" font-weight="700" fill="#549048">${label}</text>`;
}

function svgContactText(x: number, cy: number, text: string): string {
  return `<text x="${x}" y="${cy}" dominant-baseline="central" fill="#1C4276" font-family="Helvetica, Arial, sans-serif" font-size="${CARD_BACK_CONTACT.textSize}" font-weight="500">${text}</text>`;
}

export function cardBackHeaderSvg(name: string, title: string): string {
  const { nameX, nameY, nameSize, titleY, titleSize } = CARD_BACK_HEADER;
  return `
  <text x="${nameX}" y="${nameY}" fill="#1C4276" font-family="Helvetica, Arial, sans-serif" font-size="${nameSize}" font-weight="700">${name}</text>
  <text x="${nameX}" y="${titleY}" fill="#666666" font-family="Helvetica, Arial, sans-serif" font-size="${titleSize}" font-weight="400">${title}</text>
  `;
}

export function cardBackContactSvg(phone: string, email: string, web: string, address: string): string {
  const { iconCx, textX, rowYs } = CARD_BACK_CONTACT;
  const [y0, y1, y2, y3] = rowYs;
  return `
  ${svgIconPath(iconCx, y0, CARD_BACK_PHONE_PATH)}
  ${svgIconText(iconCx, y1, "@", 3.4)}
  ${cardBackGlobeIconSvg(iconCx, y2)}
  ${svgIconPath(iconCx, y3, CARD_BACK_PIN_PATH)}
  ${svgContactText(textX, y0, phone)}
  ${svgContactText(textX, y1, email)}
  ${svgContactText(textX, y2, web)}
  ${svgContactText(textX, y3, address)}
  `;
}
