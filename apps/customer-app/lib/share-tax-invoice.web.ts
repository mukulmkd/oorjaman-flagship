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
  return `${invoiceNo.replace(/[^A-Za-z0-9_-]+/g, "-")}.html`;
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

function openHtmlInPrintWindow(html: string, title: string): void {
  const win = window.open("", "_blank", "noopener,noreferrer");
  if (!win) {
    throw new Error("Pop-up blocked. Allow pop-ups to print or share the invoice.");
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.document.title = title;
  // Give the browser a beat to paint before the print dialog.
  window.setTimeout(() => {
    try {
      win.focus();
      win.print();
    } catch {
      // User can still use the opened tab.
    }
  }, 350);
}

function downloadHtmlFile(html: string, filename: string): void {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
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

/** Web: open branded invoice HTML and trigger the browser print / share sheet. */
export async function shareBookingTaxInvoice(params: BookingTaxInvoiceParams): Promise<void> {
  const input = await buildBookingTaxInvoiceInput(params);
  const html = buildTaxInvoiceHtml(input, { layout: "print" });
  openHtmlInPrintWindow(html, `Tax invoice ${input.invoiceNo}`);
}

/** Web: download invoice HTML (print to PDF from the browser for a PDF copy). */
export async function downloadBookingTaxInvoice(params: BookingTaxInvoiceParams): Promise<void> {
  const input = await buildBookingTaxInvoiceInput(params);
  const html = buildTaxInvoiceHtml(input, { layout: "print" });
  downloadHtmlFile(html, invoiceFileName(input.invoiceNo));
}
