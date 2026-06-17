import { renderCardBackPng } from "./card-back-canvas";
import { renderCardFrontPng } from "./card-front-canvas";
import { buildLetterheadPdf } from "./letterhead-pdf";
import {
  hostedEmailLockupUrl,
  pickEmailLogoSrcForClipboard,
} from "./email-signature-assets";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  buildCardBackSvg,
  buildEmailSignatureHtml,
  buildEmailSignatureClipboardHtml,
  buildEmailSignaturePlainText,
  CARD_PRINT_DPI,
  CARD_PRINT_MM,
  type BrandPrintContact,
} from "@oorjaman/utils";

const CARD_MM = { w: CARD_PRINT_MM.w, h: CARD_PRINT_MM.h };
const A4_MM = { w: 210, h: 297 };
const CARD_DPI = CARD_PRINT_DPI;
const CARD_PX_W = Math.round((CARD_MM.w / 25.4) * CARD_DPI);
const CARD_PX_H = Math.round((CARD_MM.h / 25.4) * CARD_DPI);
const WATERMARK_RASTER_PX = Math.max(CARD_PX_W, 1400);

const mm = (n: number) => (n / 25.4) * 72;

const C = {
  man: hex("#1C4276"),
  oorja: hex("#549048"),
  tagline: hex("#9B9B9B"),
  muted: hex("#516a7b"),
  line: hex("#c5d9d4"),
  white: rgb(1, 1, 1),
};

export type BrandPrintAssets = {
  iconUrl: string;
  /** UI preview lockup (may be web-sized). */
  lockupUrl: string;
  /** High-res lockup for 300 DPI print — use logo-lockup-tagline-print.png when available. */
  lockupPrintUrl: string;
};

export type GeneratedCard = {
  pdfBytes: Uint8Array;
  pngBytes: Uint8Array;
  previewPngBytes: Uint8Array;
  svg: string;
};

export type EmailSignatureResult = {
  emailHtml: string;
  emailPreviewHtml: string;
  emailClipboardHtml: string;
  emailClipboardPlain: string;
  emailHostedLogoUrl: string | null;
  emailLockupPng: Uint8Array;
};

export type BusinessCardsResult = {
  cardFront: GeneratedCard;
  cardBack: GeneratedCard;
};

async function loadBrandAssets(assets: BrandPrintAssets) {
  const [iconImg, lockupPrintImg] = await Promise.all([
    loadImage(assets.iconUrl),
    loadImage(assets.lockupPrintUrl),
  ]);
  return { iconImg, lockupPrintImg };
}

export async function generateBusinessCards(
  contact: BrandPrintContact,
  assets: BrandPrintAssets,
): Promise<BusinessCardsResult> {
  const { iconImg, lockupPrintImg } = await loadBrandAssets(assets);
  const watermarkB64 = await imageToPngBase64(iconImg, WATERMARK_RASTER_PX, WATERMARK_RASTER_PX, 1);

  const frontPng = await renderCardFrontPng(lockupPrintImg, CARD_PX_W, CARD_PX_H);
  const cardFront = await buildBusinessCardFromPng(frontPng);
  const backPng = await renderCardBackPng(contact, iconImg, CARD_PX_W, CARD_PX_H);
  const cardBack = await buildBusinessCardFromPng(backPng, buildCardBackSvg(contact, watermarkB64));

  return { cardFront, cardBack };
}

export async function generateEmailSignature(
  contact: BrandPrintContact,
  assets: BrandPrintAssets,
): Promise<EmailSignatureResult> {
  const { lockupPrintImg } = await loadBrandAssets(assets);
  const emailLockupPng = await resizeLockupPng(lockupPrintImg, 400);
  const lockupDataUri = pngBytesToDataUri(emailLockupPng);
  const clipboardLogoSrc = pickEmailLogoSrcForClipboard(lockupDataUri, assets.lockupPrintUrl);

  return {
    emailHtml: buildEmailSignatureHtml(contact, { logoSrc: lockupDataUri, includeDocumentWrapper: true }),
    emailPreviewHtml: buildEmailSignatureHtml(contact, { logoSrc: lockupDataUri, previewPadding: true }),
    emailClipboardHtml: buildEmailSignatureClipboardHtml(contact, clipboardLogoSrc),
    emailClipboardPlain: buildEmailSignaturePlainText(contact),
    emailHostedLogoUrl: hostedEmailLockupUrl(assets.lockupPrintUrl),
    emailLockupPng,
  };
}

export async function generateLetterhead(
  contact: BrandPrintContact,
  assets: BrandPrintAssets,
): Promise<Uint8Array> {
  const { iconImg, lockupPrintImg } = await loadBrandAssets(assets);
  const lockupPng = await resizeLockupPng(lockupPrintImg, 900);
  const wmLetterPng = b64ToBytes(await imageToPngBase64(iconImg, 520, 520, 0.07));
  return buildLetterheadPdf(contact, lockupPng, wmLetterPng);
}

export async function generateInvoice(contact: BrandPrintContact, assets: BrandPrintAssets): Promise<Uint8Array> {
  const { lockupPrintImg } = await loadBrandAssets(assets);
  const lockupPng = await resizeLockupPng(lockupPrintImg, 900);
  return buildInvoicePdf(contact, lockupPng);
}

function hex(h: string) {
  const x = h.replace("#", "");
  return rgb(parseInt(x.slice(0, 2), 16) / 255, parseInt(x.slice(2, 4), 16) / 255, parseInt(x.slice(4, 6), 16) / 255);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load image: ${url}`));
    img.src = url;
  });
}

async function imageToPngBase64(img: HTMLImageElement, maxWidthPx: number, maxHeightPx?: number, opacity = 1): Promise<string> {
  const canvas = document.createElement("canvas");
  const scale = Math.min(maxWidthPx / img.width, (maxHeightPx ?? maxWidthPx) / img.height);
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not available");
  ctx.clearRect(0, 0, w, h);
  ctx.globalAlpha = opacity;
  ctx.drawImage(img, 0, 0, w, h);
  const dataUrl = canvas.toDataURL("image/png");
  return dataUrl.split(",")[1] ?? "";
}

/** Half-size PNG for sharp on-screen preview (full 300 DPI file is still used for download). */
export function pngBytesForPreview(pngBytes: Uint8Array, printWidth: number, printHeight: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([pngBytes.slice()], { type: "image/png" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const w = Math.round(printWidth / 2);
      const h = Math.round(printHeight / 2);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Canvas not available"));
        return;
      }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob((b) => {
        URL.revokeObjectURL(url);
        if (!b) {
          reject(new Error("Preview resize failed"));
          return;
        }
        b.arrayBuffer().then((buf) => resolve(new Uint8Array(buf)));
      }, "image/png");
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Preview image load failed"));
    };
    img.src = url;
  });
}

async function pngBytesToPdf(png: Uint8Array, pageW: number, pageH: number): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([pageW, pageH]);
  const img = await pdf.embedPng(png);
  page.drawImage(img, { x: 0, y: 0, width: pageW, height: pageH });
  return pdf.save();
}

async function buildBusinessCardFromPng(pngBytes: Uint8Array, svg = ""): Promise<GeneratedCard> {
  const previewPngBytes = await pngBytesForPreview(pngBytes, CARD_PX_W, CARD_PX_H);
  const pdfBytes = await pngBytesToPdf(pngBytes, mm(CARD_MM.w), mm(CARD_MM.h));
  return { pdfBytes, pngBytes, previewPngBytes, svg };
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function drawWaveBandFull(page: import("pdf-lib").PDFPage, pageW: number, bandH: number) {
  page.drawRectangle({ x: 0, y: 0, width: pageW, height: bandH, color: C.man });
  page.drawSvgPath(
    `M 0 ${bandH} C ${pageW * 0.22} ${bandH * 0.35}, ${pageW * 0.45} ${bandH * 1.15}, ${pageW * 0.62} ${bandH * 0.55}` +
      ` S ${pageW * 0.92} ${bandH * 0.2}, ${pageW} ${bandH * 0.75} L ${pageW} ${bandH} Z`,
    { color: C.oorja },
  );
}

async function buildInvoicePdf(contact: BrandPrintContact, lockupPng: Uint8Array): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const pageW = mm(A4_MM.w);
  const pageH = mm(A4_MM.h);
  const page = pdf.addPage([pageW, pageH]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const margin = mm(14);

  const lockupImg = await pdf.embedPng(lockupPng);
  const lockupW = mm(48);
  const lockupH = (lockupImg.height / lockupImg.width) * lockupW;
  page.drawImage(lockupImg, { x: margin, y: pageH - margin - lockupH, width: lockupW, height: lockupH });

  const rightX = pageW - margin;
  let headerY = pageH - margin - 10;
  page.drawText("TAX INVOICE", { x: rightX - fontBold.widthOfTextAtSize("TAX INVOICE", 16), y: headerY, size: 16, font: fontBold, color: C.man });
  headerY -= 18;
  for (const line of [`Invoice No: INV-________`, `Date: ____________`, `GSTIN: __________`]) {
    const w = font.widthOfTextAtSize(line, 9.5);
    page.drawText(line, { x: rightX - w, y: headerY, size: 9.5, font, color: C.man });
    headerY -= 13;
  }

  const bodyTop = pageH - margin - lockupH - mm(12);
  page.drawLine({ start: { x: margin, y: bodyTop }, end: { x: pageW - margin, y: bodyTop }, thickness: 0.75, color: C.line });

  let y = bodyTop - mm(10);
  page.drawText("Bill to", { x: margin, y, size: 10, font: fontBold, color: C.man });
  y -= 14;
  page.drawText(contact.cardName, { x: margin, y, size: 10, font: fontBold, color: C.man });
  y -= 13;
  page.drawText(contact.address, { x: margin, y, size: 9.5, font, color: C.muted });
  y -= 12;
  page.drawText(contact.phone, { x: margin, y, size: 9.5, font, color: C.muted });
  y -= 12;
  page.drawText(contact.email, { x: margin, y, size: 9.5, font, color: C.muted });

  const tableTop = y - mm(10);
  const colDesc = margin;
  const colQty = pageW - margin - mm(70);
  const colRate = pageW - margin - mm(45);
  const colAmt = pageW - margin - mm(18);

  page.drawRectangle({ x: margin, y: tableTop - mm(8), width: pageW - margin * 2, height: mm(8), color: C.man });
  page.drawText("Description", { x: colDesc + 4, y: tableTop - mm(6), size: 9, font: fontBold, color: C.white });
  page.drawText("Qty", { x: colQty, y: tableTop - mm(6), size: 9, font: fontBold, color: C.white });
  page.drawText("Rate", { x: colRate, y: tableTop - mm(6), size: 9, font: fontBold, color: C.white });
  page.drawText("Amount", { x: colAmt - fontBold.widthOfTextAtSize("Amount", 9), y: tableTop - mm(6), size: 9, font: fontBold, color: C.white });

  const rows = [
    { desc: "Solar panel cleaning service", qty: "1", rate: "________", amt: "________" },
    { desc: "Preventive maintenance visit", qty: "—", rate: "—", amt: "—" },
  ];
  let rowY = tableTop - mm(14);
  for (const row of rows) {
    page.drawText(row.desc, { x: colDesc + 4, y: rowY, size: 9, font, color: C.man });
    page.drawText(row.qty, { x: colQty, y: rowY, size: 9, font, color: C.man });
    page.drawText(row.rate, { x: colRate, y: rowY, size: 9, font, color: C.man });
    page.drawText(row.amt, { x: colAmt - font.widthOfTextAtSize(row.amt, 9), y: rowY, size: 9, font, color: C.man });
    rowY -= mm(8);
    page.drawLine({ start: { x: margin, y: rowY + mm(3) }, end: { x: pageW - margin, y: rowY + mm(3) }, thickness: 0.5, color: C.line });
    rowY -= mm(2);
  }

  const totalsX = pageW - margin - mm(55);
  let totalY = rowY - mm(4);
  for (const [label, value] of [
    ["Subtotal", "________"],
    ["GST (18%)", "________"],
    ["Total", "________"],
  ] as const) {
    page.drawText(label, { x: totalsX, y: totalY, size: 9.5, font: label === "Total" ? fontBold : font, color: C.man });
    page.drawText(value, {
      x: pageW - margin - font.widthOfTextAtSize(value, 9.5),
      y: totalY,
      size: 9.5,
      font: label === "Total" ? fontBold : font,
      color: C.man,
    });
    totalY -= 14;
  }

  page.drawText("Amount in words: ________________________________________________", {
    x: margin,
    y: totalY - mm(4),
    size: 9,
    font,
    color: C.muted,
  });

  const footerH = mm(18);
  drawWaveBandFull(page, pageW, footerH);
  page.drawText(`${contact.company}  ·  ${contact.web}`, { x: margin, y: mm(6), size: 8, font: fontBold, color: C.white });
  page.drawText(contact.tagline, {
    x: pageW - margin - font.widthOfTextAtSize(contact.tagline, 7.5),
    y: mm(6),
    size: 7.5,
    font,
    color: C.white,
    opacity: 0.9,
  });

  return pdf.save();
}

async function resizeLockupPng(img: HTMLImageElement, widthPx: number): Promise<Uint8Array> {
  const canvas = document.createElement("canvas");
  const scale = widthPx / img.width;
  canvas.width = widthPx;
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not available");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Lockup PNG failed"))), "image/png");
  });
  return new Uint8Array(await blob.arrayBuffer());
}

function pngBytesToDataUri(png: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < png.length; i++) bin += String.fromCharCode(png[i]!);
  return `data:image/png;base64,${btoa(bin)}`;
}

export function downloadBytes(bytes: Uint8Array, filename: string, mime: string) {
  const blob = new Blob([bytes.slice()], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadText(text: string, filename: string, mime = "text/html;charset=utf-8") {
  downloadBytes(new TextEncoder().encode(text), filename, mime);
}
