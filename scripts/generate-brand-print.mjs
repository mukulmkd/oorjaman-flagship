#!/usr/bin/env node
/**
 * Optional CLI export of print collateral from brand/source masters (company-default CONTACT).
 *
 * Primary workflow: Admin portal → Dashboard → Brand print (per-person contact, invoice tab).
 * Shared layout code: packages/utils/src/brand-print/
 *
 * Run: npm run brand:print
 * Writes to brand/print/ (gitignored PDF/PNG/SVG/HTML — see .gitignore).
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { buildEmailSignatureHtml } from "../packages/utils/src/brand-print/email-signature-html.mjs";
import { drawLetterheadHeader, drawLetterheadWatermark } from "../packages/utils/src/brand-print/letterhead-header.mjs";
import { drawLetterheadFooter, LETTERHEAD_FOOTER } from "../packages/utils/src/brand-print/letterhead-footer.mjs";
import { rasterizeLetterheadIcons } from "./lib/letterhead-icon-raster.mjs";
import { rasterizeLetterheadFooterBackground } from "./lib/letterhead-footer-bg-raster.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const sourceDir = join(repoRoot, "brand", "source");
const printDir = join(repoRoot, "brand", "print");

const LOCKUP = join(sourceDir, "logo-lockup-tagline.png");
const ICON = join(sourceDir, "logo-icon.png");

/** mm → PDF points (72 pt / inch, 25.4 mm / inch) */
const mm = (n) => (n / 25.4) * 72;

const A4 = { w: mm(210), h: mm(297) };
const CARD = { w: mm(90), h: mm(54) };

const C = {
  oorja: hex("#549048"),
  man: hex("#1C4276"),
  tagline: hex("#9B9B9B"),
  body: hex("#0f2938"),
  muted: hex("#516a7b"),
  primary: hex("#1f8660"),
  line: hex("#c5d9d4"),
  white: rgb(1, 1, 1),
  bg: hex("#f6faf9"),
};

const CONTACT = {
  company: "OorjaMan",
  companyLegal: "OorjaMan Energy Solutions Pvt. Ltd.",
  descriptor: "Solar panel cleaning & preventive care",
  tagline: "WE CLEAN. YOU GENERATE.",
  phone: "+91 98765 43210",
  email: "info@oorjaman.com",
  web: "www.oorjaman.com",
  url: "https://oorjaman.com",
  address: "Bengaluru, Karnataka, India",
  cardName: "Your Name",
  cardTitle: "Director",
};

function hex(h) {
  const x = h.replace("#", "");
  return rgb(
    parseInt(x.slice(0, 2), 16) / 255,
    parseInt(x.slice(2, 4), 16) / 255,
    parseInt(x.slice(4, 6), 16) / 255,
  );
}

async function pngForPdf(inputPath, maxWidthPx) {
  return sharp(inputPath).resize({ width: maxWidthPx, withoutEnlargement: true }).png().toBuffer();
}

async function fadedIcon(inputPath, sizePx, opacity) {
  const { data, info } = await sharp(inputPath)
    .resize(sizePx, sizePx, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let i = 3; i < data.length; i += 4) {
    data[i] = Math.round(data[i] * opacity);
  }

  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

const CARD_DPI = 300;
const CARD_PX_W = Math.round((90 / 25.4) * CARD_DPI);
const CARD_PX_H = Math.round((54 / 25.4) * CARD_DPI);

function b64(buf) {
  return buf.toString("base64");
}

/** Bottom wave band — full card width. */
function svgBottomWave() {
  return `
  <path fill="#1C4276" d="M 0 54 L 0 49.5 C 11 47.5, 22 50.5, 34 48.5 C 48 46, 62 49.5, 76 43.5 C 86 39, 90 30.5, 90 18.5 L 90 54 Z"/>
  <path fill="#3d7a6e" d="M 0 54 L 0 51.2 C 14 49.5, 28 51.5, 42 49.8 C 56 48, 72 51, 90 47.5 L 90 54 Z" opacity="0.92"/>
  <path fill="#549048" d="M 0 54 L 0 52.4 C 16 50.8, 32 52.6, 48 51 C 64 49.5, 78 52.2, 90 50.2 L 90 54 Z"/>
  `;
}

function svgBackCornerWave() {
  return `<path fill="#1C4276" d="M 56 54 L 90 54 L 90 48.5 C 90 52.8 68 54 56 54 Z"/>`;
}

const CARD_BACK_PHONE_PATH =
  "M2 3.5A1.5 1.5 0 013.5 2h1.148a1.5 1.5 0 011.465 1.175l.716 3.223a1.5 1.5 0 01-1.052 1.767l-.933.267a13.75 13.75 0 006.105 6.105l.267-.933a1.5 1.5 0 011.767-1.052l3.223.716A1.5 1.5 0 0118 15.352V16.5a1.5 1.5 0 01-1.5 1.5H15c-1.149 0-2.263-.15-3.326-.43A19.022 19.022 0 012.43 8.326 19.048 19.048 0 012 5V3.5z";
const CARD_BACK_PIN_PATH =
  "M10 18 C10 18 4.5 12.2 4.5 8.2 C4.5 5.1 6.9 2.5 10 2.5 C13.1 2.5 15.5 5.1 15.5 8.2 C15.5 12.2 10 18 10 18 Z M10 10.2 C11.2 10.2 12.2 9.2 12.2 8 C12.2 6.8 11.2 5.8 10 5.8 C8.8 5.8 7.8 6.8 7.8 8 C7.8 9.2 8.8 10.2 10 10.2 Z";

const BACK_HEADER = { nameX: 7, nameY: 12, nameSize: 4.8, titleY: 15.5, titleSize: 2.95 };
const BACK_CONTACT = { iconCx: 9.25, textX: 13, textSize: 2.3, rowYs: [31, 34.7, 38.4, 42.1], iconDrawSize: 3.2 };

function svgIconPath(cx, cy, path, viewSize = 20) {
  const s = BACK_CONTACT.iconDrawSize / viewSize;
  return `<g transform="translate(${cx} ${cy}) scale(${s}) translate(${-viewSize / 2} ${-viewSize / 2})"><path fill="#549048" d="${path}"/></g>`;
}

function svgGlobeIcon(cx, cy) {
  const s = BACK_CONTACT.iconDrawSize / 20;
  return `<g transform="translate(${cx} ${cy}) scale(${s}) translate(-10 -10)" fill="none" stroke="#549048" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="10" cy="10" r="7.5"/>
    <ellipse cx="10" cy="10" rx="3" ry="7.5"/>
    <line x1="2.5" y1="10" x2="17.5" y2="10"/>
    <path d="M10 2.5 C13.5 5.5 13.5 14.5 10 17.5"/>
    <path d="M10 2.5 C6.5 5.5 6.5 14.5 10 17.5"/>
  </g>`;
}

function svgIconText(cx, cy, label, fontSize) {
  return `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" font-family="Helvetica, Arial, sans-serif" font-size="${fontSize}" font-weight="700" fill="#549048">${label}</text>`;
}

function svgContactText(x, cy, text) {
  return `<text x="${x}" y="${cy}" dominant-baseline="central" fill="#1C4276" font-family="Helvetica, Arial, sans-serif" font-size="${BACK_CONTACT.textSize}" font-weight="500">${text}</text>`;
}

function svgContactRows() {
  const { iconCx, textX, rowYs } = BACK_CONTACT;
  const [y0, y1, y2, y3] = rowYs;
  return `
  ${svgIconPath(iconCx, y0, CARD_BACK_PHONE_PATH)}
  ${svgIconText(iconCx, y1, "@", 3.4)}
  ${svgGlobeIcon(iconCx, y2)}
  ${svgIconPath(iconCx, y3, CARD_BACK_PIN_PATH)}
  ${svgContactText(textX, y0, CONTACT.phone)}
  ${svgContactText(textX, y1, CONTACT.email)}
  ${svgContactText(textX, y2, CONTACT.web)}
  ${svgContactText(textX, y3, CONTACT.address)}
  `;
}

function buildCardFrontSvg(lockupB64) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="90mm" height="54mm" viewBox="0 0 90 54">
  <rect width="90" height="54" fill="#ffffff"/>
  <image href="data:image/png;base64,${lockupB64}" x="18" y="3.2" width="54" height="29.5" preserveAspectRatio="xMidYMid meet"/>
  ${svgBottomWave()}
</svg>`;
}

function buildCardBackSvg(_iconB64, watermarkB64) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="90mm" height="54mm" viewBox="0 0 90 54">
  <rect width="90" height="54" fill="#ffffff"/>
  <image href="data:image/png;base64,${watermarkB64}" x="48" y="0" width="48" height="48" opacity="0.11" preserveAspectRatio="xMidYMid meet"/>
  <text x="${BACK_HEADER.nameX}" y="${BACK_HEADER.nameY}" fill="#1C4276" font-family="Helvetica, Arial, sans-serif" font-size="${BACK_HEADER.nameSize}" font-weight="700">${CONTACT.cardName}</text>
  <text x="${BACK_HEADER.nameX}" y="${BACK_HEADER.titleY}" fill="#666666" font-family="Helvetica, Arial, sans-serif" font-size="${BACK_HEADER.titleSize}" font-weight="400">${CONTACT.cardTitle}</text>
  ${svgContactRows()}
  ${svgBackCornerWave()}
</svg>`;
}

async function rasterCardSvg(svg) {
  return sharp(Buffer.from(svg), { density: CARD_DPI }).resize(CARD_PX_W, CARD_PX_H, { fit: "fill" }).png().toBuffer();
}

async function cardSvgToPdf(svg) {
  const png = await rasterCardSvg(svg);
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([CARD.w, CARD.h]);
  const img = await pdf.embedPng(png);
  page.drawImage(img, { x: 0, y: 0, width: CARD.w, height: CARD.h });
  return { pdfBytes: await pdf.save(), png };
}

async function buildLetterhead() {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([A4.w, A4.h]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  const lockupPng = await pngForPdf(LOCKUP, 900);
  const lockupImg = await pdf.embedPng(lockupPng);
  const iconPngs = await rasterizeLetterheadIcons();
  const icons = {
    phone: await pdf.embedPng(iconPngs.phone),
    email: await pdf.embedPng(iconPngs.email),
    globe: await pdf.embedPng(iconPngs.globe),
  };

  drawLetterheadHeader(page, {
    pageW: A4.w,
    pageH: A4.h,
    contact: CONTACT,
    lockupImg,
    icons,
    font,
    mm,
    colors: { man: C.man, oorja: C.oorja },
  });

  const wmPng = await fadedIcon(ICON, 520, 0.07);
  const wmImg = await pdf.embedPng(wmPng);
  const footerH = mm(LETTERHEAD_FOOTER.heightMm);
  const footerBgPng = await rasterizeLetterheadFooterBackground(A4.w, footerH);
  const footerBgImg = await pdf.embedPng(footerBgPng);

  drawLetterheadFooter(page, {
    pageW: A4.w,
    footerH,
    backgroundImg: footerBgImg,
  });

  drawLetterheadWatermark(page, { pageW: A4.w, wmImg, footerH, mm });

  return pdf.save();
}

async function buildBusinessCardFront() {
  const lockupPng = await pngForPdf(LOCKUP, 2800);
  const svg = buildCardFrontSvg(b64(lockupPng));
  const { pdfBytes, png } = await cardSvgToPdf(svg);
  return { pdfBytes, png, svg };
}

async function buildBusinessCardBack() {
  const iconPng = await trimmedIconPng(ICON, 800);
  const wmPng = await fadedIcon(ICON, 900, 1);
  const svg = buildCardBackSvg(b64(iconPng), b64(wmPng));
  const { pdfBytes, png } = await cardSvgToPdf(svg);
  return { pdfBytes, png, svg };
}

async function trimmedIconPng(inputPath, sizePx) {
  return sharp(inputPath).trim().resize(sizePx, sizePx, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } }).png().toBuffer();
}

async function buildEmailLockupPng() {
  return sharp(LOCKUP).resize({ width: 400, withoutEnlargement: true }).png().toBuffer();
}

async function buildEmailHtml(lockupPng) {
  const lockupDataUri = `data:image/png;base64,${lockupPng.toString("base64")}`;
  return buildEmailSignatureHtml(CONTACT, { logoSrc: lockupDataUri, includeDocumentWrapper: true });
}

async function main() {
  mkdirSync(join(printDir, "letterhead"), { recursive: true });
  mkdirSync(join(printDir, "business-card"), { recursive: true });
  mkdirSync(join(printDir, "email-signature"), { recursive: true });

  const letterheadPath = join(printDir, "letterhead", "oorjaman-letterhead-a4-v1.pdf");
  const cardFrontPath = join(printDir, "business-card", "oorjaman-business-card-front-v1.pdf");
  const cardBackPath = join(printDir, "business-card", "oorjaman-business-card-back-v1.pdf");
  const cardFrontPngPath = join(printDir, "business-card", "oorjaman-business-card-front-v1.png");
  const cardBackPngPath = join(printDir, "business-card", "oorjaman-business-card-back-v1.png");
  const cardFrontSvgPath = join(printDir, "business-card", "oorjaman-business-card-front-v1.svg");
  const cardBackSvgPath = join(printDir, "business-card", "oorjaman-business-card-back-v1.svg");
  const emailPngPath = join(printDir, "email-signature", "oorjaman-email-signature-lockup.png");
  const emailHtmlPath = join(printDir, "email-signature", "oorjaman-email-signature.html");

  writeFileSync(letterheadPath, await buildLetterhead());
  console.log(`wrote ${letterheadPath}`);

  const front = await buildBusinessCardFront();
  writeFileSync(cardFrontPath, front.pdfBytes);
  writeFileSync(cardFrontPngPath, front.png);
  writeFileSync(cardFrontSvgPath, front.svg);
  console.log(`wrote ${cardFrontPath}`);
  console.log(`wrote ${cardFrontPngPath}`);

  const back = await buildBusinessCardBack();
  writeFileSync(cardBackPath, back.pdfBytes);
  writeFileSync(cardBackPngPath, back.png);
  writeFileSync(cardBackSvgPath, back.svg);
  console.log(`wrote ${cardBackPath}`);
  console.log(`wrote ${cardBackPngPath}`);

  const emailLockupBuf = await buildEmailLockupPng();
  writeFileSync(emailPngPath, emailLockupBuf);
  console.log(`wrote ${emailPngPath}`);

  writeFileSync(emailHtmlPath, await buildEmailHtml(emailLockupBuf));
  console.log(`wrote ${emailHtmlPath}`);

  console.log("\nDone. Open PDFs to review. Run again after updating brand/source/ masters.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
