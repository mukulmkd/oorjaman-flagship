import type { BrandPrintContact } from "./types";
import { cardBackContactSvg, cardBackCornerWaveSvg, cardBackHeaderSvg } from "./card-back-layout";
import { CARD_FRONT_LOCKUP, cardFrontWaveSvg } from "./card-front-layout";

export { CARD_PRINT_MM, CARD_PRINT_DPI, CARD_PRINT_PX } from "./print-spec";

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Front — full-width bottom wave. */
function svgFrontWave(): string {
  return cardFrontWaveSvg();
}

export function buildCardFrontSvg(_contact: BrandPrintContact, lockupB64: string): string {
  const { x, y, w, h } = CARD_FRONT_LOCKUP;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="90mm" height="54mm" viewBox="0 0 90 54">
  <rect width="90" height="54" fill="#ffffff"/>
  <image href="data:image/png;base64,${lockupB64}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/>
  ${svgFrontWave()}
</svg>`;
}

export function buildCardBackSvg(contact: BrandPrintContact, watermarkB64: string): string {
  const name = escapeXml(contact.cardName);
  const title = escapeXml(contact.cardTitle);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="90mm" height="54mm" viewBox="0 0 90 54">
  <rect width="90" height="54" fill="#ffffff"/>
  <image href="data:image/png;base64,${watermarkB64}" x="48" y="0" width="48" height="48" opacity="0.11" preserveAspectRatio="xMidYMid meet"/>
  ${cardBackHeaderSvg(name, title)}
  ${cardBackContactSvg(
    escapeXml(contact.phone),
    escapeXml(contact.email),
    escapeXml(contact.web),
    escapeXml(contact.address),
  )}
  ${cardBackCornerWaveSvg()}
</svg>`;
}

