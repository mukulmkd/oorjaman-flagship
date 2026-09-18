import type { CustomerRow, UserRow } from "@oorjaman/api";

/** Prefill Razorpay Checkout from the signed-in OorjaMan customer (not browser autofill). */
export function razorpayPrefillFromCustomer(params: {
  customer?: CustomerRow | null;
  user?: UserRow | null;
  authEmail?: string | null;
}): { name?: string; email?: string; contact?: string } {
  const name =
    params.customer?.display_name?.trim() ||
    params.user?.full_name?.trim() ||
    undefined;

  const email =
    params.customer?.contact_email?.trim() ||
    params.authEmail?.trim() ||
    params.user?.email?.trim() ||
    undefined;

  const rawPhone = params.user?.phone?.trim() || params.customer?.alternate_phone?.trim() || "";
  const digits = rawPhone.replace(/\D/g, "");
  let contact: string | undefined;
  if (digits.length >= 10) {
    // Razorpay expects E.164-ish contact; keep last 10 for IN if longer.
    contact = digits.length === 10 ? `+91${digits}` : `+${digits}`;
  }

  return {
    ...(name ? { name } : {}),
    ...(email ? { email } : {}),
    ...(contact ? { contact } : {}),
  };
}
