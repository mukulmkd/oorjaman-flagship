import type { BookingRow, CustomerRow, PaymentRow, UserRow } from "@oorjaman/api";
import {
  buildTaxInvoiceHtml,
  invoiceNumberForBooking,
  type TaxInvoiceInput,
} from "@oorjaman/utils";

let cachedInvoiceLogoDataUri: string | null | undefined;

/** Load public brand icon as a data URI (required for pdf-lib + iframe srcDoc). */
async function invoiceLogoDataUri(): Promise<string | null> {
  if (cachedInvoiceLogoDataUri !== undefined) return cachedInvoiceLogoDataUri;
  try {
    const url = `${import.meta.env.BASE_URL}logo-icon.png`;
    const res = await fetch(url);
    if (!res.ok) {
      cachedInvoiceLogoDataUri = null;
      return null;
    }
    const blob = await res.blob();
    const dataUri = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(reader.error ?? new Error("Could not read logo"));
      reader.readAsDataURL(blob);
    });
    cachedInvoiceLogoDataUri = dataUri.startsWith("data:image/") ? dataUri : null;
    return cachedInvoiceLogoDataUri;
  } catch {
    cachedInvoiceLogoDataUri = null;
    return null;
  }
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

function formatPhoneDisplay(phone: string | null | undefined): string | null {
  if (!phone?.trim()) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  if (digits.length === 10) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  return phone.trim().startsWith("+") ? phone.trim() : `+${digits || phone.trim()}`;
}

function humanizeServiceType(raw: string): string {
  const cleaned = raw.trim().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  if (!cleaned) return "Solar panel cleaning";
  return cleaned.replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function serviceDescription(booking: BookingRow): string {
  const ref = booking.reference_code?.trim() || "visit";
  if (booking.subscription_id) {
    return `AMC solar panel cleaning - ${ref}`;
  }
  const st = booking.service_type?.trim();
  if (st && st.toLowerCase() !== "cleaning") {
    return `${humanizeServiceType(st)} - ${ref}`;
  }
  return `Solar panel cleaning service - ${ref}`;
}

export async function buildBookingTaxInvoiceInput(params: {
  booking: BookingRow;
  customer?: CustomerRow | null;
  user?: UserRow | null;
  payment?: PaymentRow | null;
}): Promise<TaxInvoiceInput> {
  const { booking, customer, user, payment } = params;
  const totalPaise = Math.max(
    0,
    Math.round(
      booking.final_price_cents != null
        ? booking.final_price_cents
        : booking.estimated_price_cents,
    ),
  );
  const name =
    customer?.display_name?.trim() || user?.full_name?.trim() || "Customer";
  const phone =
    formatPhoneDisplay(customer?.alternate_phone) ||
    formatPhoneDisplay(user?.phone);
  const email = customer?.contact_email?.trim() || null;
  const address =
    formatAddressJson(booking.service_site_address) ||
    formatAddressJson(customer?.service_default_address) ||
    formatAddressJson(customer?.billing_address);

  const paymentRef =
    payment?.razorpay_payment_id?.trim() ||
    (payment?.id ? `PAY-${payment.id.slice(0, 8).toUpperCase()}` : null);

  const invoiceDate =
    booking.actual_end ??
    payment?.paid_at ??
    booking.updated_at ??
    new Date().toISOString();

  const logoDataUri = await invoiceLogoDataUri();

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
  params: Parameters<typeof buildBookingTaxInvoiceInput>[0],
  layout: "print" | "screen" = "screen",
): Promise<string> {
  const input = await buildBookingTaxInvoiceInput(params);
  return buildTaxInvoiceHtml(input, { layout });
}

export function invoiceFileName(invoiceNo: string): string {
  return `${invoiceNo.replace(/[^A-Za-z0-9_-]+/g, "-")}.pdf`;
}

function downloadPdfBytes(bytes: Uint8Array, filename: string): void {
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

export async function downloadBookingTaxInvoicePdf(
  params: Parameters<typeof buildBookingTaxInvoiceInput>[0],
): Promise<void> {
  const input = await buildBookingTaxInvoiceInput(params);
  const { buildTaxInvoicePdfBytes } = await import("./tax-invoice-pdf");
  const pdfBytes = await buildTaxInvoicePdfBytes(input);
  downloadPdfBytes(pdfBytes, invoiceFileName(input.invoiceNo));
}
