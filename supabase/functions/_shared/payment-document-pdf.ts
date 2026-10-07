/// <reference path="../supabase-edge.d.ts" />
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "https://esm.sh/pdf-lib@1.17.1";

const A4 = { w: 595.28, h: 841.89 };
const MARGIN = 40;
const MAN = rgb(0x1c / 255, 0x42 / 255, 0x76 / 255);
const OORJA = rgb(0x54 / 255, 0x90 / 255, 0x48 / 255);
const MUTED = rgb(0x51 / 255, 0x6a / 255, 0x7b / 255);
const WHITE = rgb(1, 1, 1);
const BAND = rgb(0xf6 / 255, 0xfa / 255, 0xf9 / 255);

export const OORJAMAN_SELLER = {
  legal: "OORJA MAN LLP",
  address: "House No. 18, Bye Lane 2, Zoo Road Tiniali, Guwahati, Assam 781001, India",
  phone: "+91 98765 43210",
  email: "info@oorjaman.com",
  web: "www.oorjaman.com",
  gstin: "18AAKFO2664E1Z5",
  stateLabel: "Assam 18",
} as const;

const GST_STATE_CODES: Record<string, string> = {
  "jammu and kashmir": "01",
  "himachal pradesh": "02",
  punjab: "03",
  chandigarh: "04",
  uttarakhand: "05",
  haryana: "06",
  delhi: "07",
  rajasthan: "08",
  "uttar pradesh": "09",
  bihar: "10",
  sikkim: "11",
  "arunachal pradesh": "12",
  nagaland: "13",
  manipur: "14",
  mizoram: "15",
  tripura: "16",
  meghalaya: "17",
  assam: "18",
  "west bengal": "19",
  jharkhand: "20",
  odisha: "21",
  chhattisgarh: "22",
  "madhya pradesh": "23",
  gujarat: "24",
  maharashtra: "27",
  karnataka: "29",
  goa: "30",
  kerala: "32",
  "tamil nadu": "33",
  puducherry: "34",
  telangana: "36",
  "andhra pradesh": "37",
};

export type AddressBits = {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  formatted?: string;
};

export function addressOf(value: unknown): AddressBits {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const o = value as Record<string, unknown>;
  const pick = (key: string) => (typeof o[key] === "string" ? o[key].trim() : "");
  return {
    line1: pick("line1"),
    line2: pick("line2"),
    city: pick("city"),
    state: pick("state"),
    pincode: pick("pincode"),
    formatted: pick("formatted"),
  };
}

export function formatSite(address: AddressBits): string {
  if (address.formatted) return address.formatted;
  return [address.line1, address.line2, address.city, address.state, address.pincode].filter(Boolean).join(", ");
}

export function stateLabel(state: string | null | undefined, gstin?: string | null): string {
  const name = state?.trim() ?? "";
  const fromGstin = gstin && /^\d{2}/.test(gstin) ? gstin.slice(0, 2) : "";
  const code = (name && GST_STATE_CODES[name.toLowerCase()]) || fromGstin;
  if (name && code) return `${name} ${code}`;
  if (name) return name;
  if (code) return code;
  return "-";
}

export function inr(paise: number): string {
  const amount = Math.max(0, Math.round(paise)) / 100;
  const formatted = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `INR ${formatted}`;
}

export function splitGst(totalPaise: number): { taxable: number; gst: number; total: number } {
  const total = Math.max(0, Math.round(totalPaise));
  const taxable = Math.round(total / 1.18);
  return { taxable, gst: total - taxable, total };
}

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n] ?? "";
  return `${TENS[Math.floor(n / 10)] ?? ""}${n % 10 ? ` ${ONES[n % 10]}` : ""}`.trim();
}

export function amountInWords(paise: number): string {
  const rupees = Math.floor(Math.max(0, Math.round(paise)) / 100);
  if (rupees === 0) return "Zero Rupees Only";
  const crore = Math.floor(rupees / 1_00_00_000);
  const lakh = Math.floor((rupees % 1_00_00_000) / 1_00_000);
  const thousand = Math.floor((rupees % 1_00_000) / 1000);
  const rest = rupees % 1000;
  const chunk = (n: number) => {
    if (!n) return "";
    const h = Math.floor(n / 100);
    const tail = n % 100;
    return [h ? `${ONES[h]} Hundred` : "", tail ? twoDigits(tail) : ""].filter(Boolean).join(" ");
  };
  const parts = [
    crore ? `${chunk(crore)} Crore` : "",
    lakh ? `${chunk(lakh)} Lakh` : "",
    thousand ? `${chunk(thousand)} Thousand` : "",
    rest ? chunk(rest) : "",
  ].filter(Boolean);
  return `${parts.join(" ")} Rupees Only`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(d);
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return ["-"];
  const lines: string[] = [];
  let current = words[0]!;
  for (let i = 1; i < words.length; i += 1) {
    const next = `${current} ${words[i]}`;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) current = next;
    else {
      lines.push(current);
      current = words[i]!;
    }
  }
  lines.push(current);
  return lines;
}

const RULE = rgb(0xc5 / 255, 0xd9 / 255, 0xd4 / 255);
const CONTENT_RIGHT = A4.w - MARGIN;
const COL_GAP = 28;
const COL_W = (CONTENT_RIGHT - MARGIN - COL_GAP) / 2;
const RIGHT_X = MARGIN + COL_W + COL_GAP;
const VALUE_COL = 78;

function safeText(value: string): string {
  const cleaned = value.replace(/[^\x20-\x7E]/g, " ").replace(/ +/g, " ").trim();
  return cleaned || "-";
}

function drawRight(
  page: PDFPage,
  text: string,
  xRight: number,
  y: number,
  font: PDFFont,
  size: number,
  color = MAN,
): void {
  const line = safeText(text);
  page.drawText(line, {
    x: xRight - font.widthOfTextAtSize(line, size),
    y,
    size,
    font,
    color,
  });
}

function drawWrapped(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  width: number,
  font: PDFFont,
  size: number,
  color = MUTED,
): number {
  const lines = wrap(safeText(text), font, size, width);
  let cursor = y;
  for (const line of lines) {
    page.drawText(line, { x, y: cursor, size, font, color });
    cursor -= size + 4;
  }
  return cursor;
}

function drawStack(
  page: PDFPage,
  rows: Array<{ text: string; font: PDFFont; size: number; color?: typeof MUTED }>,
  x: number,
  y: number,
  width: number,
): number {
  let cursor = y;
  for (const row of rows) {
    cursor = drawWrapped(page, row.text, x, cursor, width, row.font, row.size, row.color ?? MUTED);
    cursor -= 2;
  }
  return cursor;
}

function drawWordmark(page: PDFPage, bold: PDFFont, y: number): void {
  page.drawText("Oorja", { x: MARGIN, y, size: 18, font: bold, color: OORJA });
  page.drawText("Man", {
    x: MARGIN + bold.widthOfTextAtSize("Oorja", 18),
    y,
    size: 18,
    font: bold,
    color: MAN,
  });
}

function drawDocHeader(page: PDFPage, bold: PDFFont, title: string, y: number): number {
  drawWordmark(page, bold, y);
  drawRight(page, title, CONTENT_RIGHT, y, bold, 13, MAN);
  return y - 26;
}

function drawMeta(page: PDFPage, font: PDFFont, lines: string[], y: number): number {
  let cursor = y;
  for (const line of lines) {
    drawRight(page, line, CONTENT_RIGHT, cursor, font, 9, MAN);
    cursor -= 13;
  }
  return cursor - 6;
}

function drawRule(page: PDFPage, y: number): number {
  page.drawRectangle({
    x: MARGIN,
    y,
    width: CONTENT_RIGHT - MARGIN,
    height: 0.6,
    color: RULE,
  });
  return y - 18;
}

function drawFooter(page: PDFPage, font: PDFFont, bold: PDFFont): void {
  page.drawRectangle({ x: 0, y: 0, width: A4.w, height: 28, color: MAN });
  page.drawText("OorjaMan   www.oorjaman.com", { x: MARGIN, y: 10, size: 8, font: bold, color: WHITE });
  const tag = "WE CLEAN. YOU GENERATE.";
  page.drawText(tag, {
    x: CONTENT_RIGHT - font.widthOfTextAtSize(tag, 7.5),
    y: 10,
    size: 7.5,
    font,
    color: WHITE,
  });
}

function drawItemsHeader(page: PDFPage, bold: PDFFont, y: number): number {
  page.drawRectangle({
    x: MARGIN,
    y: y - 5,
    width: CONTENT_RIGHT - MARGIN,
    height: 18,
    color: BAND,
  });
  page.drawText("Items", { x: MARGIN + 8, y, size: 9, font: bold, color: MAN });
  drawRight(page, "Amount", CONTENT_RIGHT - 8, y, bold, 9, MAN);
  return y - 22;
}

function drawMoneyRow(
  page: PDFPage,
  label: string,
  value: string,
  y: number,
  font: PDFFont,
  strong: boolean,
): void {
  if (strong) {
    page.drawRectangle({
      x: MARGIN,
      y: y - 6,
      width: CONTENT_RIGHT - MARGIN,
      height: 20,
      color: BAND,
    });
  }
  drawRight(page, label, CONTENT_RIGHT - VALUE_COL - 12, y, font, 9, strong ? MAN : MUTED);
  drawRight(page, value, CONTENT_RIGHT - 8, y, font, 9, MAN);
}

async function savePdf(pdf: PDFDocument): Promise<Uint8Array> {
  // Object streams make these files render as a blank page in some mail viewers.
  return pdf.save({ useObjectStreams: false });
}

export type TaxInvoicePdfInput = {
  invoiceNo: string;
  invoiceDate: string;
  customerName: string;
  address: string;
  stateLabel: string;
  serviceLabel: string;
  amountPaise: number;
  bookingRef: string;
};

export async function buildTaxInvoicePdf(input: TaxInvoicePdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([A4.w, A4.h]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const gst = splitGst(input.amountPaise);

  let y = drawDocHeader(page, bold, "TAX INVOICE", A4.h - 52);
  y = drawMeta(page, font, [`Invoice No. ${input.invoiceNo}`, `Date ${formatDate(input.invoiceDate)}`], y);
  y = drawRule(page, y);

  page.drawText("To (Recipient)", { x: MARGIN, y, size: 11, font: bold, color: MAN });
  page.drawText("From (Supplier)", { x: RIGHT_X, y, size: 11, font: bold, color: MAN });
  const bodyTop = y - 18;

  const leftY = drawStack(
    page,
    [
      { text: "Name", font: bold, size: 9, color: MAN },
      { text: input.customerName, font: bold, size: 9, color: MAN },
      { text: input.address || "Service address", font, size: 8.5 },
      { text: "State Name & Code", font, size: 8.5 },
      { text: input.stateLabel, font, size: 8.5 },
      { text: "Place of Supply", font, size: 8.5 },
      { text: input.stateLabel, font, size: 8.5 },
    ],
    MARGIN,
    bodyTop,
    COL_W,
  );

  const rightY = drawStack(
    page,
    [
      { text: OORJAMAN_SELLER.legal, font: bold, size: 9, color: MAN },
      { text: OORJAMAN_SELLER.address, font, size: 8.5 },
      { text: `GSTIN ${OORJAMAN_SELLER.gstin}`, font, size: 8.5, color: MAN },
      { text: "State Name & Code", font, size: 8.5 },
      { text: OORJAMAN_SELLER.stateLabel, font, size: 8.5 },
    ],
    RIGHT_X,
    bodyTop,
    COL_W,
  );

  y = Math.min(leftY, rightY) - 12;
  y = drawItemsHeader(page, bold, y);

  const descWidth = CONTENT_RIGHT - VALUE_COL - 36 - (MARGIN + 8);
  const descLines = wrap(safeText(input.serviceLabel), bold, 9, descWidth);
  descLines.forEach((line, index) => {
    page.drawText(line, { x: MARGIN + 8, y: y - index * 12, size: 9, font: bold, color: MAN });
  });
  drawMoneyRow(page, "Gross Amount", inr(input.amountPaise), y, font, false);
  y -= Math.max(16, descLines.length * 12) + 6;

  drawMoneyRow(page, "Taxable amount", inr(gst.taxable), y, font, false);
  y -= 16;
  drawMoneyRow(page, "GST @18%", inr(gst.gst), y, font, false);
  y -= 16;
  drawMoneyRow(page, "Total", inr(gst.total), y, bold, true);
  y -= 28;

  y = drawWrapped(
    page,
    `Amount in words: ${amountInWords(input.amountPaise)}`,
    MARGIN,
    y,
    CONTENT_RIGHT - MARGIN,
    font,
    8.5,
  );
  y -= 6;
  drawWrapped(
    page,
    `Booking ${input.bookingRef}. This tax invoice is for the amount paid to OorjaMan. It includes 18% GST. Reverse charge is not applicable.`,
    MARGIN,
    y,
    CONTENT_RIGHT - MARGIN,
    font,
    8,
  );

  drawFooter(page, font, bold);
  return savePdf(pdf);
}

export type PartnerReceiptPdfInput = {
  receiptNo: string;
  receiptDate: string;
  customerName: string;
  address: string;
  stateLabel: string;
  partnerName: string;
  partnerAddress: string;
  partnerGstin: string | null;
  partnerStateLabel: string;
  serviceLabel: string;
  amountPaise: number;
  invoiceNo: string;
};

export async function buildPartnerReceiptPdf(input: PartnerReceiptPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([A4.w, A4.h]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let y = drawDocHeader(page, bold, "RECEIPT", A4.h - 52);
  y = drawMeta(page, font, [`Receipt No. ${input.receiptNo}`, `Date ${formatDate(input.receiptDate)}`], y);
  y = drawRule(page, y);

  page.drawText("To (Recipient)", { x: MARGIN, y, size: 11, font: bold, color: MAN });
  page.drawText("From (Partner)", { x: RIGHT_X, y, size: 11, font: bold, color: MAN });
  const bodyTop = y - 18;

  const leftY = drawStack(
    page,
    [
      { text: "Name", font: bold, size: 9, color: MAN },
      { text: input.customerName, font: bold, size: 9, color: MAN },
      { text: "Delivery address", font: bold, size: 8.5, color: MAN },
      { text: input.address || "Service address", font, size: 8.5 },
      { text: "State Name & Code", font, size: 8.5 },
      { text: input.stateLabel, font, size: 8.5 },
      { text: "Place of Supply", font, size: 8.5 },
      { text: input.stateLabel, font, size: 8.5 },
    ],
    MARGIN,
    bodyTop,
    COL_W,
  );

  const rightY = drawStack(
    page,
    [
      { text: "Name", font: bold, size: 9, color: MAN },
      { text: input.partnerName, font: bold, size: 9, color: MAN },
      { text: input.partnerAddress || "Service address on this booking", font, size: 8.5 },
      { text: input.partnerGstin ? `GSTIN ${input.partnerGstin}` : "GSTIN not on file", font, size: 8.5, color: MAN },
      { text: "State Name & Code", font, size: 8.5 },
      { text: input.partnerStateLabel, font, size: 8.5 },
    ],
    RIGHT_X,
    bodyTop,
    COL_W,
  );

  y = Math.min(leftY, rightY) - 12;
  y = drawItemsHeader(page, bold, y);

  const descWidth = CONTENT_RIGHT - VALUE_COL - 36 - (MARGIN + 8);
  const descLines = wrap(safeText(input.serviceLabel), bold, 9, descWidth);
  descLines.forEach((line, index) => {
    page.drawText(line, { x: MARGIN + 8, y: y - index * 12, size: 9, font: bold, color: MAN });
  });
  const gross = inr(input.amountPaise);
  drawMoneyRow(page, "Gross Amount", gross, y, font, false);
  y -= Math.max(16, descLines.length * 12) + 8;
  drawMoneyRow(page, "Subtotal", gross, y, bold, true);
  y -= 28;

  drawWrapped(
    page,
    `This receipt is from your OorjaMan partner for this visit. The amount is the same payment covered by tax invoice ${input.invoiceNo}. It is not an extra charge.`,
    MARGIN,
    y,
    CONTENT_RIGHT - MARGIN,
    font,
    8,
  );

  drawFooter(page, font, bold);
  return savePdf(pdf);
}
