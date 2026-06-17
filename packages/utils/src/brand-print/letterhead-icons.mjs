/** @typedef {'phone' | 'email' | 'globe'} LetterheadIconKind */

const GREEN = "#549048";

/** Heroicons-style phone receiver (20×20) — same glyph as business card back. */
const PHONE_PATH =
  "M2 3.5A1.5 1.5 0 013.5 2h1.148a1.5 1.5 0 011.465 1.175l.716 3.223a1.5 1.5 0 01-1.052 1.767l-.933.267a13.75 13.75 0 006.105 6.105l.267-.933a1.5 1.5 0 011.767-1.052l3.223.716A1.5 1.5 0 0118 15.352V16.5a1.5 1.5 0 01-1.5 1.5H15c-1.149 0-2.263-.15-3.326-.43A19.022 19.022 0 012.43 8.326 19.048 19.048 0 012 5V3.5z";

/** Outline envelope (20×20) — rectangle body + V flap, distinct from @. */
const ENVELOPE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="${GREEN}" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round">
  <path d="M2.5 6.75v8a2 2 0 002 2h11a2 2 0 002-2v-8"/>
  <path d="M2.5 6.75h15"/>
  <path d="M2.5 6.75 10 12 17.5 6.75"/>
</svg>`;

const ICON_SVGS = {
  phone: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path fill="${GREEN}" d="${PHONE_PATH}"/></svg>`,
  email: ENVELOPE_SVG,
  globe: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="${GREEN}" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="10" cy="10" r="7.5"/>
    <ellipse cx="10" cy="10" rx="3" ry="7.5"/>
    <line x1="2.5" y1="10" x2="17.5" y2="10"/>
    <path d="M10 2.5 C13.5 5.5 13.5 14.5 10 17.5"/>
    <path d="M10 2.5 C6.5 5.5 6.5 14.5 10 17.5"/>
  </svg>`,
};

/** @param {LetterheadIconKind} kind */
export function letterheadIconSvg(kind) {
  return ICON_SVGS[kind];
}

export const LETTERHEAD_ICON_RASTER_PX = 80;
