import { DEFAULT_BRAND_PRINT_CONTACT, type BrandPrintContact } from "./types";

/** GST rate included in published OorjaMan catalogue prices (India). */
export const TAX_INVOICE_GST_RATE_PERCENT = 18;

const BRAND = {
  oorja: "#549048",
  man: "#1C4276",
  muted: "#516a7b",
  line: "#d7e3ec",
  white: "#ffffff",
  canvas: "#ffffff",
} as const;

export type TaxInvoiceBillTo = {
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
};

export type TaxInvoiceLineItem = {
  description: string;
  qty: number;
  /** Inclusive of GST, in INR paise. */
  amountPaise: number;
};

export type TaxInvoiceInput = {
  seller?: BrandPrintContact;
  billTo: TaxInvoiceBillTo;
  invoiceNo: string;
  /** ISO date or display-ready date string (Asia/Kolkata preferred). */
  invoiceDate: string;
  bookingRef?: string | null;
  serviceDate?: string | null;
  lineItems: TaxInvoiceLineItem[];
  /** Optional Razorpay / payment id for remittance reference. */
  paymentRef?: string | null;
  /** Optional data URI for logo / lockup PNG; falls back to styled wordmark. */
  logoDataUri?: string | null;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function invoiceNumberForBooking(referenceCodeOrId: string): string {
  const raw = referenceCodeOrId.trim() || "OORJAMAN";
  const cleaned = raw.replace(/^INV[-_]?/i, "").replace(/\s+/g, "").toUpperCase();
  return `INV-${cleaned}`;
}

export function formatInrFromPaise(amountPaise: number): string {
  const paise = Math.max(0, Math.round(amountPaise));
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
      minimumFractionDigits: paise % 100 === 0 ? 0 : 2,
    }).format(paise / 100);
  } catch {
    return `₹${(paise / 100).toFixed(paise % 100 === 0 ? 0 : 2)}`;
  }
}

export function splitGstFromInclusivePaise(
  totalPaise: number,
  gstRatePercent = TAX_INVOICE_GST_RATE_PERCENT,
): { totalPaise: number; taxablePaise: number; gstPaise: number; gstRatePercent: number } {
  const total = Math.max(0, Math.round(totalPaise));
  if (total === 0) {
    return { totalPaise: 0, taxablePaise: 0, gstPaise: 0, gstRatePercent };
  }
  const rate = gstRatePercent / 100;
  const taxablePaise = Math.round(total / (1 + rate));
  const gstPaise = total - taxablePaise;
  return { totalPaise: total, taxablePaise, gstPaise, gstRatePercent };
}

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
] as const;

const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"] as const;

function twoDigits(n: number): string {
  if (n < 20) return ONES[n] ?? "";
  const t = Math.floor(n / 10);
  const o = n % 10;
  return `${TENS[t] ?? ""}${o ? ` ${ONES[o]}` : ""}`.trim();
}

function threeDigits(n: number): string {
  if (n === 0) return "";
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const head = h ? `${ONES[h]} Hundred` : "";
  const tail = rest ? twoDigits(rest) : "";
  return [head, tail].filter(Boolean).join(" ");
}

/** Indian numbering: crore / lakh / thousand. */
export function amountInInrWords(amountPaise: number): string {
  const paise = Math.max(0, Math.round(amountPaise));
  const rupees = Math.floor(paise / 100);
  const leftoverPaise = paise % 100;

  if (rupees === 0 && leftoverPaise === 0) return "Zero Rupees Only";

  const crore = Math.floor(rupees / 1_00_00_000);
  const lakh = Math.floor((rupees % 1_00_00_000) / 1_00_000);
  const thousand = Math.floor((rupees % 1_00_000) / 1000);
  const hundred = rupees % 1000;

  const parts: string[] = [];
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${threeDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${threeDigits(thousand)} Thousand`);
  if (hundred) parts.push(threeDigits(hundred));

  let out = parts.join(" ").replace(/\s+/g, " ").trim();
  out = out ? `${out} Rupees` : "Zero Rupees";
  if (leftoverPaise) {
    out += ` and ${twoDigits(leftoverPaise)} Paise`;
  }
  return `${out} Only`;
}

function formatInvoiceDate(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "-";
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return escapeHtml(trimmed);
  try {
    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    }).format(d);
  } catch {
    return escapeHtml(trimmed);
  }
}


export type TaxInvoiceHtmlOptions = {
  /**
   * `print` — A4-oriented layout for expo-print PDF.
   * `screen` — fluid phone WebView preview (no A4 zoom).
   */
  layout?: "print" | "screen";
};

/**
 * Self-contained tax invoice HTML (Admin Brand-print visual language).
 * Suitable for `expo-print` (`layout: "print"`) or in-app WebView (`layout: "screen"`).
 */
export function buildTaxInvoiceHtml(input: TaxInvoiceInput, options: TaxInvoiceHtmlOptions = {}): string {
  const layout = options.layout ?? "print";
  const forScreen = layout === "screen";
  const seller = input.seller ?? DEFAULT_BRAND_PRINT_CONTACT;
  const totalPaise = input.lineItems.reduce((sum, row) => sum + Math.max(0, Math.round(row.amountPaise)), 0);
  const gst = splitGstFromInclusivePaise(totalPaise);
  const words = amountInInrWords(totalPaise);

  const logoSrc =
    input.logoDataUri && input.logoDataUri.startsWith("data:image/")
      ? input.logoDataUri.replace(/"/g, "")
      : null;

  const brandMark = logoSrc
    ? `<div class="brand">
        <img class="logo" src="${logoSrc}" width="40" height="40" alt="" />
        <div class="wordmark"><span class="oorja">Oorja</span><span class="man">Man</span></div>
      </div>`
    : `<div class="brand">
        <div class="wordmark"><span class="oorja">Oorja</span><span class="man">Man</span></div>
      </div>`;

  const billLines = [
    escapeHtml(input.billTo.name.trim() || "Customer"),
    input.billTo.address?.trim() ? escapeHtml(input.billTo.address.trim()) : null,
    input.billTo.phone?.trim() ? escapeHtml(input.billTo.phone.trim()) : null,
    input.billTo.email?.trim() ? escapeHtml(input.billTo.email.trim()) : null,
  ].filter(Boolean);

  const rowsHtml = input.lineItems
    .map((row) => {
      const qty = Math.max(1, Math.round(row.qty));
      const amt = Math.max(0, Math.round(row.amountPaise));
      const rate = qty > 0 ? Math.round(amt / qty) : amt;
      return `<tr>
        <td>${escapeHtml(row.description)}</td>
        <td class="num">${qty}</td>
        <td class="num">${escapeHtml(formatInrFromPaise(rate))}</td>
        <td class="num">${escapeHtml(formatInrFromPaise(amt))}</td>
      </tr>`;
    })
    .join("\n");

  const metaBits = [
    input.bookingRef?.trim() ? `Booking: ${escapeHtml(input.bookingRef.trim())}` : null,
    input.serviceDate?.trim() ? `Service date: ${formatInvoiceDate(input.serviceDate)}` : null,
    input.paymentRef?.trim() ? `Payment ref: ${escapeHtml(input.paymentRef.trim())}` : null,
  ].filter(Boolean);

  const viewport = forScreen
    ? `<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />`
    : `<meta name="viewport" content="width=device-width, initial-scale=1" />`;

  const layoutCss = forScreen
    ? `
    html, body {
      margin: 0;
      padding: 0;
      font-family: Helvetica, Arial, sans-serif;
      color: ${BRAND.man};
      background: ${BRAND.canvas};
      font-size: 13px;
      line-height: 1.4;
      -webkit-text-size-adjust: 100%;
    }
    .sheet {
      width: 100%;
      max-width: 100%;
      margin: 0;
      padding: 16px 16px 24px;
    }
    .wordmark { font-size: 22px; font-weight: 700; letter-spacing: -0.02em; line-height: 1; }
    .logo { height: 36px; width: 36px; flex: 0 0 36px; }
    .title-block h1 { font-size: 16px; margin: 0 0 6px; letter-spacing: 0.04em; }
    .title-block p { margin: 0 0 3px; font-size: 12px; }
    .seller { font-size: 12px; margin: 0 0 12px; color: ${BRAND.muted}; }
    .seller strong { color: ${BRAND.man}; font-size: 13px; }
    .billto h2 { margin: 0 0 4px; font-size: 13px; }
    .billto p { margin: 0 0 2px; font-size: 12px; color: ${BRAND.muted}; }
    .billto p.name { color: ${BRAND.man}; font-weight: 700; font-size: 13px; }
    .meta { margin: 8px 0 0; font-size: 11px; color: ${BRAND.muted}; }
    table.items { margin-top: 14px; }
    table.items th { padding: 8px; font-size: 11px; }
    table.items td { padding: 8px; font-size: 12px; }
    .totals { width: min(220px, 55%); margin: 12px 0 0 auto; }
    .totals .row { font-size: 12px; margin-bottom: 4px; }
    .totals .row.total { font-size: 14px; }
    .words { margin: 14px 0 16px; font-size: 11px; color: ${BRAND.muted}; }
    .footer { padding: 12px; font-size: 11px; }
    `
    : `
    @page { size: A4; margin: 12mm; }
    html, body {
      margin: 0;
      padding: 0;
      font-family: Helvetica, Arial, sans-serif;
      color: ${BRAND.man};
      background: ${BRAND.canvas};
      font-size: 10pt;
      line-height: 1.35;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .sheet {
      max-width: 186mm;
      margin: 0 auto;
      padding: 0;
    }
    .wordmark { font-size: 20pt; font-weight: 700; letter-spacing: -0.02em; line-height: 1; }
    .logo { height: 40px; width: 40px; flex: 0 0 40px; }
    .title-block h1 { margin: 0 0 6px; font-size: 15pt; letter-spacing: 0.04em; }
    .title-block p { margin: 0 0 3px; font-size: 9pt; }
    .seller { margin: 0 0 10px; font-size: 8.5pt; color: ${BRAND.muted}; }
    .seller strong { color: ${BRAND.man}; font-size: 9.5pt; }
    .billto h2 { margin: 0 0 4px; font-size: 9.5pt; }
    .billto p { margin: 0 0 2px; font-size: 9pt; color: ${BRAND.muted}; }
    .billto p.name { color: ${BRAND.man}; font-weight: 700; font-size: 10pt; }
    .meta { margin: 8px 0 0; font-size: 8.5pt; color: ${BRAND.muted}; }
    table.items { margin-top: 12px; }
    table.items th { padding: 7px 8px; font-size: 8.5pt; }
    table.items td { padding: 8px; font-size: 9pt; }
    .totals { width: 200px; margin: 10px 0 0 auto; }
    .totals .row { font-size: 9pt; margin-bottom: 4px; }
    .totals .row.total { font-size: 10.5pt; }
    .words { margin: 12px 0 14px; font-size: 8.5pt; color: ${BRAND.muted}; }
    .footer { padding: 10px 12px; font-size: 8pt; }
    `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  ${viewport}
  <title>Tax Invoice ${escapeHtml(input.invoiceNo)}</title>
  <style>
    * { box-sizing: border-box; }
    ${layoutCss}
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
    }
    .brand { display: flex; align-items: center; gap: 10px; }
    .logo { object-fit: contain; display: block; }
    .wordmark .oorja { color: ${BRAND.oorja}; }
    .wordmark .man { color: ${BRAND.man}; }
    .title-block { text-align: right; color: ${BRAND.man}; }
    .title-block h1 { color: ${BRAND.man}; }
    .rule { border: 0; border-top: 1px solid ${BRAND.line}; margin: 12px 0 10px; }
    table.items { width: 100%; border-collapse: collapse; }
    table.items th {
      background: ${BRAND.man};
      color: ${BRAND.white};
      text-align: left;
      font-weight: 700;
    }
    table.items th.num, table.items td.num { text-align: right; white-space: nowrap; }
    table.items td {
      border-bottom: 1px solid ${BRAND.line};
      color: ${BRAND.man};
      vertical-align: top;
    }
    .totals .row { display: flex; justify-content: space-between; }
    .totals .row.total { font-weight: 700; margin-top: 2px; }
    .footer {
      margin-top: 8px;
      background: ${BRAND.man};
      color: ${BRAND.white};
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .footer .tag { opacity: 0.9; white-space: nowrap; }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      ${brandMark}
      <div class="title-block">
        <h1>TAX INVOICE</h1>
        <p>Invoice No: ${escapeHtml(input.invoiceNo)}</p>
        <p>Date: ${formatInvoiceDate(input.invoiceDate)}</p>
        <p>GSTIN: ${escapeHtml(seller.gstin || "-")}</p>
      </div>
    </div>
    <hr class="rule" />
    <div class="seller">
      <strong>${escapeHtml(seller.companyLegal)}</strong><br />
      ${escapeHtml(seller.address)}<br />
      ${escapeHtml(seller.phone)} · ${escapeHtml(seller.email)} · ${escapeHtml(seller.web)}
    </div>
    <div class="billto">
      <h2>Bill to</h2>
      ${billLines.map((line, i) => `<p class="${i === 0 ? "name" : ""}">${line}</p>`).join("\n")}
    </div>
    ${metaBits.length ? `<div class="meta">${metaBits.join(" · ")}</div>` : ""}
    <table class="items">
      <thead>
        <tr>
          <th>Description</th>
          <th class="num">Qty</th>
          <th class="num">Rate</th>
          <th class="num">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml || `<tr><td colspan="4">No line items</td></tr>`}
      </tbody>
    </table>
    <div class="totals">
      <div class="row"><span>Subtotal</span><span>${escapeHtml(formatInrFromPaise(gst.taxablePaise))}</span></div>
      <div class="row"><span>GST (${gst.gstRatePercent}%)</span><span>${escapeHtml(formatInrFromPaise(gst.gstPaise))}</span></div>
      <div class="row total"><span>Total</span><span>${escapeHtml(formatInrFromPaise(gst.totalPaise))}</span></div>
    </div>
    <p class="words">Amount in words: ${escapeHtml(words)}</p>
    <div class="footer">
      <span>${escapeHtml(seller.company)} · ${escapeHtml(seller.web)}</span>
      <span class="tag">${escapeHtml(seller.tagline)}</span>
    </div>
  </div>
</body>
</html>`;
}
