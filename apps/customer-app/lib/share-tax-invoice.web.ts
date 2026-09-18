import {
  customerBookingDisplayTitle,
  isAmcSubscriptionBooking,
  type BookingRow,
  type CustomerRow,
  type PaymentRow,
  type UserRow,
} from "@oorjaman/api";
import {
  buildTaxInvoiceHtml,
  invoiceNumberForBooking,
  type TaxInvoiceInput,
} from "@oorjaman/utils";
import { INVOICE_MARK_DATA_URI } from "./invoice-mark-data-uri";

// NOTE: do NOT statically import `./tax-invoice-pdf.web` / `pdf-lib` here.
// pdf-lib's tslib interop crashes Expo web's main bundle (__extends of undefined).
// Load it only inside downloadBookingTaxInvoice via dynamic import.

function invoiceLogoDataUri(): string {
  return INVOICE_MARK_DATA_URI;
}

function formatAddressJson(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const t = value.trim();
    return t || null;
  }
  if (typeof value === "object" && value !== null && "formatted" in value) {
    const f = (value as { formatted?: unknown }).formatted;
    if (typeof f === "string" && f.trim()) return f.trim();
  }
  try {
    const s = JSON.stringify(value);
    return s === "{}" || s === "null" ? null : s;
  } catch {
    return null;
  }
}

function humanizeServiceType(raw: string): string {
  const cleaned = raw.trim().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  if (!cleaned) return "Solar panel cleaning";
  return cleaned.replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function formatPhoneDisplay(phone: string | null | undefined): string | null {
  if (!phone?.trim()) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  if (digits.length === 10) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  return phone.trim().startsWith("+") ? phone.trim() : `+${digits || phone.trim()}`;
}

function serviceDescription(booking: BookingRow): string {
  const title = customerBookingDisplayTitle(booking);
  if (isAmcSubscriptionBooking(booking)) {
    return `AMC solar panel cleaning - ${title}`;
  }
  const st = booking.service_type?.trim();
  if (st && st.toLowerCase() !== "cleaning") {
    return `${humanizeServiceType(st)} - ${title}`;
  }
  return `Solar panel cleaning service - ${title}`;
}

function invoiceFileName(invoiceNo: string): string {
  return `${invoiceNo.replace(/[^A-Za-z0-9_-]+/g, "-")}.pdf`;
}

export type BookingTaxInvoiceParams = {
  booking: BookingRow;
  customer?: CustomerRow | null;
  user?: UserRow | null;
  payment?: PaymentRow | null;
};

export async function buildBookingTaxInvoiceInput(
  params: BookingTaxInvoiceParams,
): Promise<TaxInvoiceInput> {
  const { booking, customer, user, payment } = params;
  const totalPaise = Math.max(
    0,
    Math.round(booking.final_price_cents != null ? booking.final_price_cents : booking.estimated_price_cents),
  );
  const name = customer?.display_name?.trim() || user?.full_name?.trim() || "Customer";
  const phone = formatPhoneDisplay(customer?.alternate_phone) || formatPhoneDisplay(user?.phone);
  const email = customer?.contact_email?.trim() || null;
  const address =
    formatAddressJson(booking.service_site_address) ||
    formatAddressJson(customer?.service_default_address) ||
    formatAddressJson(customer?.billing_address);

  const paymentRef =
    payment?.razorpay_payment_id?.trim() ||
    (payment?.id ? `PAY-${payment.id.slice(0, 8).toUpperCase()}` : null);

  const invoiceDate = booking.actual_end ?? booking.updated_at ?? new Date().toISOString();
  const logoDataUri = invoiceLogoDataUri();

  return {
    billTo: { name, phone, email, address },
    invoiceNo: invoiceNumberForBooking(booking.reference_code || booking.id),
    invoiceDate,
    bookingRef: booking.reference_code,
    serviceDate: booking.actual_end ?? booking.scheduled_end,
    paymentRef,
    logoDataUri,
    lineItems: [
      {
        description: serviceDescription(booking),
        qty: 1,
        amountPaise: totalPaise,
      },
    ],
  };
}

export async function buildBookingTaxInvoiceHtml(
  params: BookingTaxInvoiceParams,
  layout: "print" | "screen" = "print",
): Promise<string> {
  const input = await buildBookingTaxInvoiceInput(params);
  return buildTaxInvoiceHtml(input, { layout });
}

export async function prepareBookingTaxInvoiceHtml(params: BookingTaxInvoiceParams): Promise<string> {
  return buildBookingTaxInvoiceHtml(params, "screen");
}

function printHtmlDocument(html: string): void {
  // Same-document iframe avoids about:blank popups and Chrome's `noopener` null-window trap.
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";
  document.body.appendChild(iframe);

  const frameWindow = iframe.contentWindow;
  const doc = iframe.contentDocument ?? frameWindow?.document;
  if (!frameWindow || !doc) {
    iframe.remove();
    throw new Error("Could not prepare the print view. Try Download PDF instead.");
  }

  doc.open();
  doc.write(html);
  doc.close();

  const cleanup = () => {
    window.setTimeout(() => {
      try {
        iframe.remove();
      } catch {
        /* already removed */
      }
    }, 1_500);
  };

  const triggerPrint = () => {
    try {
      frameWindow.focus();
      frameWindow.print();
    } catch {
      cleanup();
      throw new Error("Could not open the print dialog. Try Download PDF instead.");
    }
    cleanup();
  };

  // Logo is a data URI — short delay is enough for layout paint before print.
  window.setTimeout(triggerPrint, 400);
}

function downloadPdfBytes(bytes: Uint8Array, filename: string): void {
  // Fresh copy so Blob always gets an ArrayBuffer-backed view (not SharedArrayBuffer).
  const copy = Uint8Array.from(bytes);
  const blob = new Blob([copy], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
}

/** Web: open the system print dialog (Save as PDF from there). */
export async function shareBookingTaxInvoice(params: BookingTaxInvoiceParams): Promise<void> {
  const input = await buildBookingTaxInvoiceInput(params);
  const html = buildTaxInvoiceHtml(input, { layout: "print" });
  printHtmlDocument(html);
}

/** Web: generate and download a real tax invoice PDF (pdf-lib loaded on demand). */
export async function downloadBookingTaxInvoice(params: BookingTaxInvoiceParams): Promise<void> {
  const input = await buildBookingTaxInvoiceInput(params);
  try {
    const { buildTaxInvoicePdfBytes } = await import("./tax-invoice-pdf.web");
    const pdfBytes = await buildTaxInvoicePdfBytes(input);
    downloadPdfBytes(pdfBytes, invoiceFileName(input.invoiceNo));
  } catch (err) {
    // If pdf-lib fails to initialize on this browser/bundle, fall back to print → Save as PDF.
    console.warn("Tax invoice PDF engine unavailable; falling back to print", err);
    const html = buildTaxInvoiceHtml(input, { layout: "print" });
    printHtmlDocument(html);
  }
}
