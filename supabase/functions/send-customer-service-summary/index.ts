/// <reference path="../supabase-edge.d.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders as resolveCors } from "../_shared/cors.ts";

function summarySubject(reference: string): string {
  return `Payment Summary for your Service with OorjaMan — ${reference}`;
}

type Address = {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  formatted?: string;
};

type Summary = {
  customerName: string;
  lead: string;
  serviceLabel: string;
  serviceDate: string;
  site: string;
  partner: string;
  reference: string;
  amountLabel: string;
  amountValue: string;
  amountNote: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function addressOf(value: unknown): Address {
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

function formatSite(address: Address): string {
  if (address.formatted) return address.formatted;
  const parts = [address.line1, address.line2, address.city, address.state, address.pincode].filter(Boolean);
  return parts.join(", ");
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(d);
}

function inr(paise: number | null | undefined): string {
  const amount = typeof paise === "number" && Number.isFinite(paise) ? paise : 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: amount % 100 === 0 ? 0 : 2,
  }).format(amount / 100);
}

function paymentNote(payment: {
  provider?: string | null;
  collection_channel?: string | null;
  payment_method?: string | null;
} | null): string {
  if (!payment) return "Includes 18% GST.";
  if (payment.provider === "partner_collected" || payment.collection_channel === "partner") {
    return "Collected by your partner. Includes 18% GST.";
  }
  const method = payment.payment_method?.trim();
  if (method) return `Paid via ${method}. Includes 18% GST.`;
  return "Paid through OorjaMan. Includes 18% GST.";
}

function renderSummary(summary: Summary): { text: string; html: string } {
  const text = [
    "OorjaMan",
    "WE CLEAN. YOU GENERATE.",
    "",
    `Hi ${summary.customerName},`,
    "",
    summary.lead,
    "",
    "Service summary",
    `Service: ${summary.serviceLabel}`,
    `Date: ${summary.serviceDate}`,
    `Site: ${summary.site}`,
    `Partner: ${summary.partner}`,
    `Reference: ${summary.reference}`,
    `${summary.amountLabel}: ${summary.amountValue}`,
    summary.amountNote,
    "",
    "This is a summary of the completed visit. Your tax invoice is available in the OorjaMan app.",
    "",
    "Need help? Open Help & Support in the OorjaMan app.",
  ].join("\n");

  const row = (label: string, value: string) => `<tr>
    <td style="padding:10px 0;font-size:14px;line-height:1.4;color:#516a7b;">${escapeHtml(label)}</td>
    <td style="padding:10px 0;font-size:14px;line-height:1.4;color:#0f2938;text-align:right;font-weight:600;">${escapeHtml(value)}</td>
  </tr>`;

  const html = `<div style="margin:0;padding:32px 16px;background:#f6faf9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f2938;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #c5d9d4;border-radius:16px;padding:32px 28px;">
    <img src="https://www.oorjaman.com/logo-icon.png" width="56" height="56" alt="OorjaMan" style="display:block;width:56px;height:56px;margin:0 0 20px;border:0;outline:none;text-decoration:none;" />
    <p style="margin:0 0 4px;font-size:22px;line-height:1.2;font-weight:700;"><span style="color:#549048;">Oorja</span><span style="color:#1C4276;">Man</span></p>
    <p style="margin:0 0 28px;font-size:11px;letter-spacing:0.08em;color:#9B9B9B;">WE CLEAN. YOU GENERATE.</p>
    <p style="margin:0 0 8px;font-size:16px;line-height:1.5;">Hi ${escapeHtml(summary.customerName)},</p>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:#516a7b;">${escapeHtml(summary.lead)}</p>
    <div style="border:1px solid #c5d9d4;border-radius:12px;padding:8px 20px 16px;">
      <p style="margin:12px 0 4px;font-size:16px;font-weight:700;">Service summary</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        ${row("Service", summary.serviceLabel)}
        ${row("Date", summary.serviceDate)}
        ${row("Site", summary.site)}
        ${row("Partner", summary.partner)}
        ${row("Reference", summary.reference)}
      </table>
      <div style="margin-top:8px;padding-top:12px;border-top:1px solid #c5d9d4;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          <tr>
            <td style="font-size:15px;font-weight:700;">${escapeHtml(summary.amountLabel)}</td>
            <td style="font-size:15px;font-weight:700;text-align:right;color:#1f8660;">${escapeHtml(summary.amountValue)}</td>
          </tr>
        </table>
        <p style="margin:8px 0 0;font-size:13px;line-height:1.4;color:#516a7b;">${escapeHtml(summary.amountNote)}</p>
      </div>
    </div>
    <p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#516a7b;"><strong style="color:#0f2938;">Please note.</strong> This is a summary of the completed visit. Your tax invoice is available in the OorjaMan app.</p>
  </div>
  <p style="max-width:560px;margin:20px auto 0;font-size:12px;line-height:1.5;color:#9B9B9B;text-align:center;">Need help? Open Help &amp; Support in the OorjaMan app.<br />OorjaMan</p>
</div>`;

  return { text, html };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
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
  if (!supabaseUrl || !serviceKey || !anonKey) {
    return json({ ok: false, error: "Server configuration error" }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ ok: false, error: "Unauthorized" }, 401);

  let body: { bookingId?: string } = {};
  try {
    body = (await req.json()) as { bookingId?: string };
  } catch {
    body = {};
  }
  const bookingId = body.bookingId?.trim() ?? "";
  if (!bookingId) return json({ ok: false, error: "bookingId is required" }, 400);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const jwt = authHeader.replace("Bearer ", "");
  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser(jwt);
  if (userErr || !user) return json({ ok: false, error: "Unauthorized" }, 401);

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: booking, error: bookingErr } = await admin
    .from("bookings")
    .select(
      "id, reference_code, status, customer_id, vendor_id, technician_id, subscription_id, actual_end, scheduled_start, final_price_cents, estimated_price_cents, service_site_address, metadata, payment_timing",
    )
    .eq("id", bookingId)
    .maybeSingle();
  if (bookingErr) return json({ ok: false, error: bookingErr.message }, 500);
  if (!booking) return json({ ok: false, error: "Booking not found" }, 404);
  if (booking.status !== "completed") return json({ ok: true, sent: 0, reason: "visit_not_complete" });

  const metadata = asRecord(booking.metadata);
  if (typeof metadata.service_summary_email_sent_at === "string" && metadata.service_summary_email_sent_at) {
    return json({ ok: true, sent: 0, reason: "already_sent" });
  }

  const { data: caller } = await admin.from("users").select("role").eq("id", user.id).maybeSingle();
  const privileged = caller?.role === "admin" || caller?.role === "state_ops";
  let allowed = privileged;
  if (!allowed && booking.technician_id) {
    const { data: technician } = await admin
      .from("technicians")
      .select("id")
      .eq("id", booking.technician_id)
      .eq("user_id", user.id)
      .maybeSingle();
    allowed = Boolean(technician?.id);
  }
  if (!allowed && booking.vendor_id) {
    const { data: vendor } = await admin
      .from("vendors")
      .select("id")
      .eq("id", booking.vendor_id)
      .eq("user_id", user.id)
      .maybeSingle();
    allowed = Boolean(vendor?.id);
  }
  if (!allowed) return json({ ok: false, error: "Forbidden" }, 403);

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

  const site = formatSite(addressOf(booking.service_site_address)) || "Your service address";
  let partner = "Your OorjaMan partner";
  if (booking.vendor_id) {
    const { data: vendor } = await admin
      .from("vendors")
      .select("trade_name, business_name")
      .eq("id", booking.vendor_id)
      .maybeSingle();
    partner = vendor?.trade_name?.trim() || vendor?.business_name?.trim() || partner;
  }

  let serviceLabel = "Solar panel cleaning";
  let amountLabel = "Total amount";
  let amountValue = inr(booking.final_price_cents || booking.estimated_price_cents);
  let amountNote = "Includes 18% GST.";

  if (booking.subscription_id) {
    const { data: subscription } = await admin
      .from("subscriptions")
      .select("plan_name")
      .eq("id", booking.subscription_id)
      .maybeSingle();
    serviceLabel = subscription?.plan_name?.trim() || "AMC visit";
    amountLabel = "This visit";
    amountValue = "Included in your AMC";
    amountNote = "No extra charge for this visit. Your plan price includes 18% GST.";
  } else {
    const { data: payment } = await admin
      .from("payments")
      .select("amount, status, provider, collection_channel, payment_method")
      .eq("booking_id", booking.id)
      .eq("status", "success")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (payment?.amount) amountValue = inr(payment.amount);
    amountNote = paymentNote(payment);
  }

  const customerName = customer?.display_name?.trim() || account?.full_name?.trim() || "there";
  const reference = booking.reference_code?.trim() || booking.id.slice(0, 8).toUpperCase();
  const copy = renderSummary({
    customerName,
    lead: `Here is your service summary for the solar panel cleaning at ${site}.`,
    serviceLabel,
    serviceDate: formatDate(booking.actual_end || booking.scheduled_start),
    site,
    partner,
    reference,
    amountLabel,
    amountValue,
    amountNote,
  });

  const sentAt = new Date().toISOString();
  const { data: claimed, error: claimErr } = await admin
    .from("bookings")
    .update({ metadata: { ...metadata, service_summary_email_sent_at: sentAt } })
    .eq("id", booking.id)
    .is("metadata->>service_summary_email_sent_at", null)
    .select("id");
  if (claimErr) return json({ ok: false, error: claimErr.message }, 500);
  if (!claimed?.length) return json({ ok: true, sent: 0, reason: "already_sent" });

  const apiKey = Deno.env.get("RESEND_API_KEY")?.trim();
  const from = Deno.env.get("RESEND_FROM_EMAIL")?.trim() || "OorjaMan <noreply@oorjaman.com>";
  if (!apiKey) {
    await admin.from("bookings").update({ metadata }).eq("id", booking.id);
    return json({ ok: true, sent: 0, reason: "email_not_configured" });
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: summarySubject(reference),
      text: copy.text,
      html: copy.html,
    }),
  });
  if (!res.ok) {
    await admin.from("bookings").update({ metadata }).eq("id", booking.id);
    return json({ ok: false, error: "Email provider rejected the message" }, 502);
  }

  return json({ ok: true, sent: 1 });
});
