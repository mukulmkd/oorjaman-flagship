import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  DEFAULT_BRAND_PRINT_CONTACT,
  amountInInrWords,
  formatInrFromPaise,
  splitGstFromInclusivePaise,
  type TaxInvoiceInput,
} from "@oorjaman/utils";

const A4 = { w: 595.28, h: 841.89 }; // points
const MARGIN = 40;

const C = {
  man: rgb(0x1c / 255, 0x42 / 255, 0x76 / 255),
  oorja: rgb(0x54 / 255, 0x90 / 255, 0x48 / 255),
  muted: rgb(0x51 / 255, 0x6a / 255, 0x7b / 255),
  line: rgb(0xd7 / 255, 0xe3 / 255, 0xec / 255),
  white: rgb(1, 1, 1),
};

function formatInvoiceDatePlain(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "-";
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return trimmed;
  try {
    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    }).format(d);
  } catch {
    return trimmed;
  }
}

function dataUriToBytes(dataUri: string): Uint8Array | null {
  const match = /^data:image\/(png|jpeg|jpg);base64,(.+)$/i.exec(dataUri.trim());
  if (!match?.[2]) return null;
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function wrapText(text: string, font: { widthOfTextAtSize: (t: string, s: number) => number }, size: number, maxWidth: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let current = words[0]!;
  for (let i = 1; i < words.length; i += 1) {
    const next = `${current} ${words[i]}`;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
    } else {
      lines.push(current);
      current = words[i]!;
    }
  }
  lines.push(current);
  return lines;
}

/** Build a branded A4 tax invoice PDF matching the on-screen HTML invoice. */
export async function buildTaxInvoicePdfBytes(input: TaxInvoiceInput): Promise<Uint8Array> {
  const seller = input.seller ?? DEFAULT_BRAND_PRINT_CONTACT;
  const totalPaise = input.lineItems.reduce((sum, row) => sum + Math.max(0, Math.round(row.amountPaise)), 0);
  const gst = splitGstFromInclusivePaise(totalPaise);
  const words = amountInInrWords(totalPaise);

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([A4.w, A4.h]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let y = A4.h - MARGIN;

  // Brand mark
  if (input.logoDataUri) {
    const logoBytes = dataUriToBytes(input.logoDataUri);
    if (logoBytes) {
      try {
        const isJpeg = /^data:image\/jpe?g;/i.test(input.logoDataUri);
        const logo = isJpeg ? await pdf.embedJpg(logoBytes) : await pdf.embedPng(logoBytes);
        const logoSize = 36;
        page.drawImage(logo, {
          x: MARGIN,
          y: y - logoSize,
          width: logoSize,
          height: logoSize,
        });
        page.drawText("Oorja", {
          x: MARGIN + logoSize + 8,
          y: y - 18,
          size: 18,
          font: fontBold,
          color: C.oorja,
        });
        const oorjaW = fontBold.widthOfTextAtSize("Oorja", 18);
        page.drawText("Man", {
          x: MARGIN + logoSize + 8 + oorjaW,
          y: y - 18,
          size: 18,
          font: fontBold,
          color: C.man,
        });
      } catch {
        page.drawText("OorjaMan", { x: MARGIN, y: y - 18, size: 18, font: fontBold, color: C.man });
      }
    } else {
      page.drawText("OorjaMan", { x: MARGIN, y: y - 18, size: 18, font: fontBold, color: C.man });
    }
  } else {
    page.drawText("OorjaMan", { x: MARGIN, y: y - 18, size: 18, font: fontBold, color: C.man });
  }

  const title = "TAX INVOICE";
  page.drawText(title, {
    x: A4.w - MARGIN - fontBold.widthOfTextAtSize(title, 14),
    y: y - 14,
    size: 14,
    font: fontBold,
    color: C.man,
  });
  y -= 32;

  const rightMeta = [
    `Invoice No: ${input.invoiceNo}`,
    `Date: ${formatInvoiceDatePlain(input.invoiceDate)}`,
    `GSTIN: ${seller.gstin}`,
  ];
  let metaY = y;
  for (const line of rightMeta) {
    page.drawText(line, {
      x: A4.w - MARGIN - font.widthOfTextAtSize(line, 9),
      y: metaY,
      size: 9,
      font,
      color: C.man,
    });
    metaY -= 12;
  }

  page.drawText(seller.companyLegal, { x: MARGIN, y, size: 10, font: fontBold, color: C.man });
  y -= 12;
  for (const line of [seller.descriptor, seller.address, seller.phone, seller.email, seller.web]) {
    const clipped = line.length > 90 ? `${line.slice(0, 87)}…` : line;
    page.drawText(clipped, { x: MARGIN, y, size: 8.5, font, color: C.muted });
    y -= 11;
  }

  y = Math.min(y, metaY) - 10;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: A4.w - MARGIN, y },
    thickness: 0.75,
    color: C.line,
  });
  y -= 18;

  page.drawText("Bill to", { x: MARGIN, y, size: 10, font: fontBold, color: C.man });
  y -= 14;
  page.drawText(input.billTo.name.trim() || "Customer", {
    x: MARGIN,
    y,
    size: 10,
    font: fontBold,
    color: C.man,
  });
  y -= 12;
  const billBits = [
    input.billTo.address?.trim() || null,
    input.billTo.phone?.trim() || null,
    input.billTo.email?.trim() || null,
  ].filter(Boolean) as string[];
  for (const bit of billBits) {
    for (const line of wrapText(bit, font, 9, A4.w - MARGIN * 2)) {
      page.drawText(line, { x: MARGIN, y, size: 9, font, color: C.muted });
      y -= 11;
    }
  }

  const metaBits = [
    input.bookingRef?.trim() ? `Booking: ${input.bookingRef.trim()}` : null,
    input.serviceDate?.trim() ? `Service date: ${formatInvoiceDatePlain(input.serviceDate)}` : null,
    input.paymentRef?.trim() ? `Payment ref: ${input.paymentRef.trim()}` : null,
  ].filter(Boolean) as string[];
  if (metaBits.length) {
    y -= 4;
    for (const bit of metaBits) {
      page.drawText(bit, { x: MARGIN, y, size: 8.5, font, color: C.muted });
      y -= 11;
    }
  }

  y -= 10;
  const tableTop = y;
  const tableWidth = A4.w - MARGIN * 2;
  const colQty = A4.w - MARGIN - 160;
  const colRate = A4.w - MARGIN - 100;
  const colAmt = A4.w - MARGIN - 8;

  page.drawRectangle({
    x: MARGIN,
    y: tableTop - 18,
    width: tableWidth,
    height: 18,
    color: C.man,
  });
  page.drawText("Description", { x: MARGIN + 6, y: tableTop - 13, size: 9, font: fontBold, color: C.white });
  page.drawText("Qty", { x: colQty, y: tableTop - 13, size: 9, font: fontBold, color: C.white });
  page.drawText("Rate", { x: colRate, y: tableTop - 13, size: 9, font: fontBold, color: C.white });
  page.drawText("Amount", {
    x: colAmt - fontBold.widthOfTextAtSize("Amount", 9),
    y: tableTop - 13,
    size: 9,
    font: fontBold,
    color: C.white,
  });

  y = tableTop - 28;
  const descMax = colQty - MARGIN - 16;
  for (const row of input.lineItems) {
    const qty = Math.max(1, Math.round(row.qty));
    const amt = Math.max(0, Math.round(row.amountPaise));
    const rate = qty > 0 ? Math.round(amt / qty) : amt;
    const descLines = wrapText(row.description, font, 9, descMax);
    const rowHeight = Math.max(16, descLines.length * 11 + 4);

    for (let i = 0; i < descLines.length; i += 1) {
      page.drawText(descLines[i]!, {
        x: MARGIN + 6,
        y: y - i * 11,
        size: 9,
        font,
        color: C.man,
      });
    }
    page.drawText(String(qty), { x: colQty, y, size: 9, font, color: C.man });
    const rateText = formatInrFromPaise(rate);
    const amtText = formatInrFromPaise(amt);
    page.drawText(rateText, {
      x: colRate,
      y,
      size: 9,
      font,
      color: C.man,
    });
    page.drawText(amtText, {
      x: colAmt - font.widthOfTextAtSize(amtText, 9),
      y,
      size: 9,
      font,
      color: C.man,
    });

    y -= rowHeight;
    page.drawLine({
      start: { x: MARGIN, y: y + 4 },
      end: { x: A4.w - MARGIN, y: y + 4 },
      thickness: 0.5,
      color: C.line,
    });
    y -= 4;
  }

  y -= 8;
  const totalsX = A4.w - MARGIN - 170;
  const totals: Array<[string, string, boolean]> = [
    ["Taxable value", formatInrFromPaise(gst.taxablePaise), false],
    [`GST (${gst.gstRatePercent}%)`, formatInrFromPaise(gst.gstPaise), false],
    ["Total", formatInrFromPaise(gst.totalPaise), true],
  ];
  for (const [label, value, bold] of totals) {
    const f = bold ? fontBold : font;
    page.drawText(label, { x: totalsX, y, size: 9.5, font: f, color: C.man });
    page.drawText(value, {
      x: A4.w - MARGIN - f.widthOfTextAtSize(value, 9.5),
      y,
      size: 9.5,
      font: f,
      color: C.man,
    });
    y -= 14;
  }

  y -= 8;
  const wordsLabel = `Amount in words: ${words}`;
  for (const line of wrapText(wordsLabel, font, 8.5, A4.w - MARGIN * 2)) {
    page.drawText(line, { x: MARGIN, y, size: 8.5, font, color: C.muted });
    y -= 11;
  }

  // Footer band
  const footerH = 28;
  page.drawRectangle({
    x: 0,
    y: 0,
    width: A4.w,
    height: footerH,
    color: C.man,
  });
  page.drawText(`${seller.company}  ·  ${seller.web}`, {
    x: MARGIN,
    y: 10,
    size: 8,
    font: fontBold,
    color: C.white,
  });
  page.drawText(seller.tagline, {
    x: A4.w - MARGIN - font.widthOfTextAtSize(seller.tagline, 7.5),
    y: 10,
    size: 7.5,
    font,
    color: C.white,
  });

  return pdf.save();
}
