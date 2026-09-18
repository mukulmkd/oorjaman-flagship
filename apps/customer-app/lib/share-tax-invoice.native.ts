import { Alert, Platform } from "react-native";
import {
  StorageAccessFramework,
  copyAsync,
  documentDirectory,
  readAsStringAsync,
  writeAsStringAsync,
} from "expo-file-system/legacy";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
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

async function generateInvoicePdf(params: BookingTaxInvoiceParams): Promise<{ uri: string; invoiceNo: string }> {
  const input = await buildBookingTaxInvoiceInput(params);
  const html = buildTaxInvoiceHtml(input, { layout: "print" });
  const file = await Print.printToFileAsync({
    html,
    base64: false,
    width: 595,
    height: 842,
  });
  return { uri: file.uri, invoiceNo: input.invoiceNo };
}

/** Open the branded tax invoice in an in-app HTML preview (caller shows modal). */
export async function prepareBookingTaxInvoiceHtml(params: BookingTaxInvoiceParams): Promise<string> {
  return buildBookingTaxInvoiceHtml(params, "screen");
}

/** Generate a branded tax invoice PDF and open the system share sheet. */
export async function shareBookingTaxInvoice(params: BookingTaxInvoiceParams): Promise<void> {
  const { uri, invoiceNo } = await generateInvoicePdf(params);
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    Alert.alert(
      "Invoice ready",
      Platform.select({
        ios: "Sharing is not available on this device.",
        default: "Sharing is not available on this device. Try again from a phone build.",
      }) ?? "Sharing is not available.",
    );
    return;
  }
  await Sharing.shareAsync(uri, {
    mimeType: "application/pdf",
    UTI: "com.adobe.pdf",
    dialogTitle: `Tax invoice ${invoiceNo}`,
  });
}

/**
 * Save the tax invoice PDF on-device.
 * Android: folder picker (Downloads / Documents). iOS: Save to Files via share sheet.
 */
export async function downloadBookingTaxInvoice(params: BookingTaxInvoiceParams): Promise<void> {
  const { uri, invoiceNo } = await generateInvoicePdf(params);
  const filename = invoiceFileName(invoiceNo);

  if (Platform.OS === "android") {
    const permissions = await StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!permissions.granted) {
      throw new Error("Storage permission was not granted. Choose a folder to save the invoice, or use Share PDF.");
    }
    const destUri = await StorageAccessFramework.createFileAsync(
      permissions.directoryUri,
      filename,
      "application/pdf",
    );
    const base64 = await readAsStringAsync(uri, { encoding: "base64" });
    await writeAsStringAsync(destUri, base64, { encoding: "base64" });
    Alert.alert("Invoice downloaded", `${filename} was saved to the folder you selected.`);
    return;
  }

  // iOS: persist a named copy, then open the share sheet so the user can Save to Files.
  const destDir = documentDirectory;
  if (!destDir) {
    await shareBookingTaxInvoice(params);
    return;
  }
  const namedUri = `${destDir}${filename}`;
  await copyAsync({ from: uri, to: namedUri });
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    Alert.alert("Invoice ready", `PDF saved as ${filename} in the app documents folder.`);
    return;
  }
  await Sharing.shareAsync(namedUri, {
    mimeType: "application/pdf",
    UTI: "com.adobe.pdf",
    dialogTitle: `Save ${filename}`,
  });
}
