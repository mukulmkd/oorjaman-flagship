/// <reference path="../supabase-edge.d.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders as resolveCors } from "../_shared/cors.ts";
import {
  addressOf,
  buildPartnerReceiptPdf,
  buildTaxInvoicePdf,
  formatSite,
  stateLabel,
} from "../_shared/payment-document-pdf.ts";

function invoiceSubject(reference: string): string {
  return `Invoice for your booking with OorjaMan — ${reference}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

Deno.serve(async (req: Request) => {
  const cors = resolveCors(req);
  const json = (body: Record<string, unknown>, status = 200): Response =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !serviceKey || !anonKey) return json({ ok: false, error: "Server configuration error" }, 500);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ ok: false, error: "Unauthorized" }, 401);
  const jwt = authHeader.slice("Bearer ".length).trim();

  let body: { bookingId?: string; paymentId?: string } = {};
  try {
    body = (await req.json()) as { bookingId?: string; paymentId?: string };
  } catch {
    body = {};
  }
  const bookingId = body.bookingId?.trim() ?? "";
  if (!bookingId) return json({ ok: false, error: "bookingId is required" }, 400);

  const admin = createClient(supabaseUrl, serviceKey);
  const isService = jwt === serviceKey.trim();
  if (!isService) {
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser(jwt);
    if (userErr || !user) return json({ ok: false, error: "Unauthorized" }, 401);

    const { data: caller } = await admin.from("users").select("role").eq("id", user.id).maybeSingle();
    const privileged = caller?.role === "admin" || caller?.role === "state_ops";
    if (!privileged) {
      const { data: bookingGate } = await admin
        .from("bookings")
        .select("customer_id, vendor_id, technician_id")
        .eq("id", bookingId)
        .maybeSingle();
      if (!bookingGate) return json({ ok: false, error: "Booking not found" }, 404);

      const { data: customerOwner } = await admin
        .from("customers")
        .select("id")
        .eq("id", bookingGate.customer_id)
        .eq("user_id", user.id)
        .maybeSingle();
      let allowed = Boolean(customerOwner?.id);
      if (!allowed && bookingGate.technician_id) {
        const { data: technician } = await admin
          .from("technicians")
          .select("id")
          .eq("id", bookingGate.technician_id)
          .eq("user_id", user.id)
          .maybeSingle();
        allowed = Boolean(technician?.id);
      }
      if (!allowed && bookingGate.vendor_id) {
        const { data: vendor } = await admin
          .from("vendors")
          .select("id")
          .eq("id", bookingGate.vendor_id)
          .eq("user_id", user.id)
          .maybeSingle();
        allowed = Boolean(vendor?.id);
      }
      if (!allowed) return json({ ok: false, error: "Forbidden" }, 403);
    }
  }

  const { data: booking, error: bookingErr } = await admin
    .from("bookings")
    .select(
      "id, reference_code, customer_id, vendor_id, subscription_id, scheduled_start, service_site_address, metadata, final_price_cents, estimated_price_cents, service_type",
    )
    .eq("id", bookingId)
    .maybeSingle();
  if (bookingErr) return json({ ok: false, error: bookingErr.message }, 500);
  if (!booking) return json({ ok: false, error: "Booking not found" }, 404);

  const metadata = asRecord(booking.metadata);
  if (typeof metadata.payment_documents_email_sent_at === "string" && metadata.payment_documents_email_sent_at) {
    return json({ ok: true, sent: 0, reason: "already_sent" });
  }

  let paymentQuery = admin
    .from("payments")
    .select("id, amount, status, paid_at, payment_method, provider")
    .eq("booking_id", booking.id)
    .eq("status", "success")
    .order("paid_at", { ascending: false })
    .limit(1);
  if (body.paymentId?.trim()) {
    paymentQuery = admin
      .from("payments")
      .select("id, amount, status, paid_at, payment_method, provider")
      .eq("id", body.paymentId.trim())
      .eq("booking_id", booking.id)
      .eq("status", "success")
      .limit(1);
  }
  const { data: payment, error: paymentErr } = await paymentQuery.maybeSingle();
  if (paymentErr) return json({ ok: false, error: paymentErr.message }, 500);
  if (!payment) return json({ ok: true, sent: 0, reason: "not_paid" });

  const { data: customer } = await admin
    .from("customers")
    .select("user_id, display_name, contact_email")
    .eq("id", booking.customer_id)
    .maybeSingle();
  const { data: account } = customer?.user_id
    ? await admin.from("users").select("full_name, email").eq("id", customer.user_id).maybeSingle()
    : { data: null };
  const to = (customer?.contact_email || account?.email || "").trim();
  if (!to.includes("@")) return json({ ok: true, sent: 0, reason: "no_email" });

  const site = addressOf(booking.service_site_address);
  const address = formatSite(site) || "Your service address";
  const supplyState = stateLabel(site.state);
  const reference = booking.reference_code?.trim() || booking.id.slice(0, 8).toUpperCase();
  const invoiceNo = `INV-${reference.replace(/^INV[-_]?/i, "").replace(/\s+/g, "").toUpperCase()}`;
  const receiptNo = `RCP-${reference.replace(/^RCP[-_]?/i, "").replace(/\s+/g, "").toUpperCase()}`;
  const amountPaise = Math.max(0, Math.round(payment.amount || booking.final_price_cents || booking.estimated_price_cents || 0));
  const customerName = customer?.display_name?.trim() || account?.full_name?.trim() || "Customer";

  let serviceLabel = "Solar panel cleaning";
  if (booking.subscription_id) {
    const { data: subscription } = await admin
      .from("subscriptions")
      .select("plan_name")
      .eq("id", booking.subscription_id)
      .maybeSingle();
    serviceLabel = subscription?.plan_name?.trim() || "AMC visit";
  } else if (booking.service_type && booking.service_type.toLowerCase() !== "cleaning") {
    serviceLabel = booking.service_type.replace(/[_-]+/g, " ");
  }

  let partnerName = "Your OorjaMan partner";
  let partnerAddress = address;
  let partnerGstin: string | null = null;
  let partnerState = supplyState;
  if (booking.vendor_id) {
    const { data: vendor } = await admin
      .from("vendors")
      .select("trade_name, business_name, gstin, registered_address")
      .eq("id", booking.vendor_id)
      .maybeSingle();
    partnerName = vendor?.trade_name?.trim() || vendor?.business_name?.trim() || partnerName;
    const partnerSite = addressOf(vendor?.registered_address);
    const partnerSiteText = formatSite(partnerSite);
    if (partnerSiteText) partnerAddress = partnerSiteText;
    partnerGstin = vendor?.gstin?.trim() || null;
    partnerState = stateLabel(partnerSite.state, partnerGstin) !== "-"
      ? stateLabel(partnerSite.state, partnerGstin)
      : supplyState;
  }

  const paidAt = payment.paid_at || new Date().toISOString();
  const [invoicePdf, receiptPdf] = await Promise.all([
    buildTaxInvoicePdf({
      invoiceNo,
      invoiceDate: paidAt,
      customerName,
      address,
      stateLabel: supplyState,
      serviceLabel,
      amountPaise,
      bookingRef: reference,
    }),
    buildPartnerReceiptPdf({
      receiptNo,
      receiptDate: paidAt,
      customerName,
      address,
      stateLabel: supplyState,
      partnerName,
      partnerAddress,
      partnerGstin,
      partnerStateLabel: partnerState,
      serviceLabel,
      amountPaise,
      invoiceNo,
    }),
  ]);

  const { data: claimed, error: claimErr } = await admin.rpc("claim_payment_documents_email", {
    p_booking_id: booking.id,
    p_payment_id: payment.id,
  });
  if (claimErr) return json({ ok: false, error: claimErr.message }, 500);
  if (!claimed) return json({ ok: true, sent: 0, reason: "already_sent" });

  const apiKey = Deno.env.get("RESEND_API_KEY")?.trim();
  const from = Deno.env.get("RESEND_FROM_EMAIL")?.trim() || "OorjaMan <noreply@oorjaman.com>";
  if (!apiKey) {
    await admin.rpc("release_payment_documents_email", { p_booking_id: booking.id });
    return json({ ok: true, sent: 0, reason: "email_not_configured" });
  }

  const html = `<div style="margin:0;padding:32px 16px;background:#f6faf9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f2938;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #c5d9d4;border-radius:16px;padding:32px 28px;">
    <img src="https://www.oorjaman.com/logo-icon.png" width="56" height="56" alt="OorjaMan" style="display:block;width:56px;height:56px;margin:0 0 20px;border:0;outline:none;text-decoration:none;" />
    <p style="margin:0 0 4px;font-size:22px;line-height:1.2;font-weight:700;"><span style="color:#549048;">Oorja</span><span style="color:#1C4276;">Man</span></p>
    <p style="margin:0 0 28px;font-size:11px;letter-spacing:0.08em;color:#9B9B9B;">WE CLEAN. YOU GENERATE.</p>
    <p style="margin:0 0 8px;font-size:16px;line-height:1.5;">Hi ${escapeHtml(customerName)},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;color:#516a7b;">Thank you for booking with us. Your tax invoice and partner receipt are attached for your reference.</p>
    <p style="margin:0;font-size:13px;line-height:1.5;color:#516a7b;">The tax invoice is the GST bill for this payment. The partner receipt records the same visit. It is not an extra charge.</p>
  </div>
</div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: invoiceSubject(reference),
      text: [
        `Hi ${customerName},`,
        "",
        "Thank you for booking with us. Your tax invoice and partner receipt are attached for your reference.",
        "",
        "The tax invoice is the GST bill for this payment. The partner receipt records the same visit. It is not an extra charge.",
        "",
        "OorjaMan",
      ].join("\n"),
      html,
      attachments: [
        { filename: `${invoiceNo}.pdf`, content: bytesToBase64(invoicePdf) },
        { filename: `${receiptNo}.pdf`, content: bytesToBase64(receiptPdf) },
      ],
    }),
  });
  if (!res.ok) {
    await admin.rpc("release_payment_documents_email", { p_booking_id: booking.id });
    return json({ ok: false, error: "Email provider rejected the message" }, 502);
  }

  return json({ ok: true, sent: 1 });
});
