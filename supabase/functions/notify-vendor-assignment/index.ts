/// <reference path="../supabase-edge.d.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders as resolveCors } from "../_shared/cors.ts";

type Address = {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  formatted?: string | null;
};

type RequestBody = {
  kind?: "booking" | "amc_subscription";
  bookingId?: string;
  subscriptionId?: string;
};

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

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(d);
}

function inr(cents: number | null | undefined): string {
  const paise = typeof cents === "number" && Number.isFinite(cents) ? cents : 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(paise / 100);
}

function looksLikeEmail(value: string | null | undefined): value is string {
  return typeof value === "string" && value.includes("@");
}

function vendorPortalUrl(): string {
  return Deno.env.get("VENDOR_PORTAL_URL")?.trim() || "https://vendor.oorjaman.com";
}

async function resolveVendorRecipient(
  admin: ReturnType<typeof createClient>,
  vendorId: string,
): Promise<{
  email: string | null;
  displayName: string;
  reason?: string;
}> {
  const { data: vendor, error } = await admin
    .from("vendors")
    .select("id, business_name, trade_name, contact_email, contact_person_email, user_id")
    .eq("id", vendorId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!vendor) return { email: null, displayName: "Partner", reason: "vendor_not_found" };

  const displayName =
    vendor.trade_name?.trim() || vendor.business_name?.trim() || "Partner";

  if (looksLikeEmail(vendor.contact_email)) {
    return { email: vendor.contact_email.trim(), displayName };
  }
  if (looksLikeEmail(vendor.contact_person_email)) {
    return { email: vendor.contact_person_email.trim(), displayName };
  }
  if (vendor.user_id) {
    const { data: owner } = await admin
      .from("users")
      .select("email")
      .eq("id", vendor.user_id)
      .maybeSingle();
    if (looksLikeEmail(owner?.email)) {
      return { email: owner!.email!.trim(), displayName };
    }
  }
  return { email: null, displayName, reason: "vendor_has_no_email" };
}

/** UAT must not burn Resend credits — soft-pass without calling the provider. */
function isUatEnvironment(): boolean {
  const deployEnv = (Deno.env.get("OORJAMAN_DEPLOY_ENV") ?? Deno.env.get("DEPLOY_ENV") ?? "")
    .trim()
    .toLowerCase();
  if (deployEnv === "uat" || deployEnv === "staging") return true;
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").toLowerCase();
  // OorjaMan UAT project ref (Singapore)
  return supabaseUrl.includes("caearbriteguqjvnbrcg");
}

async function sendResendEmail(input: {
  to: string;
  subject: string;
  text: string;
}): Promise<{ ok: true; sent: 1 } | { ok: false; error: string; detail?: string } | { ok: true; sent: 0; reason: string }> {
  if (isUatEnvironment()) {
    return { ok: true, sent: 0, reason: "uat_email_skipped" };
  }
  const apiKey = Deno.env.get("RESEND_API_KEY")?.trim();
  const from = Deno.env.get("RESEND_FROM_EMAIL")?.trim() || "OorjaMan <noreply@oorjaman.com>";
  if (!apiKey) {
    return { ok: true, sent: 0, reason: "email_not_configured" };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      text: input.text,
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    return { ok: false, error: "Email provider rejected the message", detail };
  }
  return { ok: true, sent: 1 };
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

  let body: RequestBody = {};
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    body = {};
  }

  const kind = body.kind === "amc_subscription" ? "amc_subscription" : "booking";
  const bookingId = body.bookingId?.trim() ?? "";
  const subscriptionId = body.subscriptionId?.trim() ?? "";
  if (kind === "booking" && !bookingId) {
    return json({ ok: false, error: "bookingId is required" }, 400);
  }
  if (kind === "amc_subscription" && !subscriptionId) {
    return json({ ok: false, error: "subscriptionId is required" }, 400);
  }

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
  const { data: caller } = await admin.from("users").select("role").eq("id", user.id).maybeSingle();
  const privileged = caller?.role === "admin" || caller?.role === "state_ops";

  const portal = vendorPortalUrl();

  try {
    if (kind === "booking") {
      const { data: booking, error: bookingErr } = await admin
        .from("bookings")
        .select(
          "id, reference_code, status, customer_id, vendor_id, scheduled_start, scheduled_end, service_site_address, customer_notes, estimated_price_cents, final_price_cents, currency",
        )
        .eq("id", bookingId)
        .maybeSingle();
      if (bookingErr) return json({ ok: false, error: bookingErr.message }, 500);
      if (!booking) return json({ ok: false, error: "Booking not found" }, 404);
      if (!booking.vendor_id) {
        return json({ ok: true, sent: 0, reason: "booking_has_no_vendor" });
      }

      const { data: customer } = await admin
        .from("customers")
        .select("user_id, display_name, contact_email")
        .eq("id", booking.customer_id)
        .maybeSingle();

      if (!privileged && customer?.user_id !== user.id) {
        const { data: callerVendor } = await admin
          .from("vendors")
          .select("id")
          .eq("user_id", user.id)
          .eq("id", booking.vendor_id)
          .maybeSingle();
        if (!callerVendor) return json({ ok: false, error: "Forbidden" }, 403);
      }

      const recipient = await resolveVendorRecipient(admin, booking.vendor_id);
      if (!recipient.email) {
        return json({
          ok: true,
          sent: 0,
          reason: recipient.reason ?? "vendor_has_no_email",
          vendorId: booking.vendor_id,
        });
      }

      const { data: account } = customer?.user_id
        ? await admin.from("users").select("full_name, phone, email").eq("id", customer.user_id).maybeSingle()
        : { data: null };

      const site = addressOf(booking.service_site_address);
      const customerName = customer?.display_name?.trim() || account?.full_name?.trim() || "Customer";
      const amount = booking.final_price_cents ?? booking.estimated_price_cents;
      const lines = [
        `Hello ${recipient.displayName},`,
        "",
        "A new OorjaMan visit has been assigned to your team.",
        "",
        `Reference: ${booking.reference_code ?? booking.id}`,
        `Status: ${booking.status}`,
        `When: ${formatWhen(booking.scheduled_start)} – ${formatWhen(booking.scheduled_end)} IST`,
        `Customer: ${customerName}`,
        `Phone: ${account?.phone ?? "—"}`,
        `Site: ${[site.formatted, site.line1, site.line2, site.city, site.state, site.pincode].filter(Boolean).join(", ") || "—"}`,
        `Estimate: ${inr(amount)}`,
        booking.customer_notes?.trim() ? `Notes: ${booking.customer_notes.trim()}` : null,
        "",
        "Open the partner portal to accept the visit and assign a technician:",
        portal,
        "",
        "— OorjaMan Operations",
      ].filter((line): line is string => line !== null);

      const subject = `New visit assigned · ${booking.reference_code ?? booking.id}`;
      const result = await sendResendEmail({
        to: recipient.email,
        subject,
        text: lines.join("\n"),
      });
      if (!result.ok) return json({ ok: false, error: result.error, detail: result.detail }, 502);
      return json({
        ok: true,
        sent: result.sent,
        kind,
        bookingId: booking.id,
        vendorId: booking.vendor_id,
        ...(result.sent === 0 ? { reason: result.reason } : {}),
      });
    }

    // AMC subscription assignment
    const { data: subscription, error: subErr } = await admin
      .from("subscriptions")
      .select(
        "id, plan_name, plan_code, status, customer_id, assigned_vendor_id, visits_included, starts_at, ends_at, amount_cents, currency",
      )
      .eq("id", subscriptionId)
      .maybeSingle();
    if (subErr) return json({ ok: false, error: subErr.message }, 500);
    if (!subscription) return json({ ok: false, error: "Subscription not found" }, 404);
    if (!subscription.assigned_vendor_id) {
      return json({ ok: true, sent: 0, reason: "subscription_has_no_vendor" });
    }

    if (!privileged) {
      const { data: callerVendor } = await admin
        .from("vendors")
        .select("id")
        .eq("user_id", user.id)
        .eq("id", subscription.assigned_vendor_id)
        .maybeSingle();
      if (!callerVendor) return json({ ok: false, error: "Forbidden" }, 403);
    }

    const recipient = await resolveVendorRecipient(admin, subscription.assigned_vendor_id);
    if (!recipient.email) {
      return json({
        ok: true,
        sent: 0,
        reason: recipient.reason ?? "vendor_has_no_email",
        vendorId: subscription.assigned_vendor_id,
      });
    }

    const { data: customer } = await admin
      .from("customers")
      .select("user_id, display_name, contact_email")
      .eq("id", subscription.customer_id)
      .maybeSingle();
    const { data: account } = customer?.user_id
      ? await admin.from("users").select("full_name, phone").eq("id", customer.user_id).maybeSingle()
      : { data: null };
    const customerName = customer?.display_name?.trim() || account?.full_name?.trim() || "Customer";
    const plan = subscription.plan_name?.trim() || subscription.plan_code || "AMC plan";
    const visits =
      typeof subscription.visits_included === "number" ? String(subscription.visits_included) : "—";

    const lines = [
      `Hello ${recipient.displayName},`,
      "",
      "You have been assigned as the dedicated AMC partner for an OorjaMan customer.",
      "",
      `Plan: ${plan}`,
      `Subscription: ${subscription.id}`,
      `Status: ${subscription.status}`,
      `Customer: ${customerName}`,
      `Phone: ${account?.phone ?? "—"}`,
      `Included visits: ${visits}`,
      `Contract window: ${formatWhen(subscription.starts_at)} – ${formatWhen(subscription.ends_at)} IST`,
      `Contract value: ${inr(subscription.amount_cents)}`,
      "",
      "Open the partner portal to review this AMC contract and upcoming visits:",
      portal,
      "",
      "— OorjaMan Operations",
    ];

    const subject = `AMC partner assignment · ${plan}`;
    const result = await sendResendEmail({
      to: recipient.email,
      subject,
      text: lines.join("\n"),
    });
    if (!result.ok) return json({ ok: false, error: result.error, detail: result.detail }, 502);
    return json({
      ok: true,
      sent: result.sent,
      kind,
      subscriptionId: subscription.id,
      vendorId: subscription.assigned_vendor_id,
      ...(result.sent === 0 ? { reason: result.reason } : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return json({ ok: false, error: message }, 500);
  }
});
