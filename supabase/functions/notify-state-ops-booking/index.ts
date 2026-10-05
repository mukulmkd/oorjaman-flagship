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
  const { data: caller } = await admin.from("users").select("role").eq("id", user.id).maybeSingle();
  const { data: booking, error: bookingErr } = await admin
    .from("bookings")
    .select(
      "id, reference_code, status, customer_id, vendor_id, scheduled_start, scheduled_end, service_site_address, customer_notes, estimated_price_cents, currency",
    )
    .eq("id", bookingId)
    .maybeSingle();
  if (bookingErr) return json({ ok: false, error: bookingErr.message }, 500);
  if (!booking) return json({ ok: false, error: "Booking not found" }, 404);

  const { data: customer } = await admin
    .from("customers")
    .select("user_id, display_name, contact_email")
    .eq("id", booking.customer_id)
    .maybeSingle();

  const privileged = caller?.role === "admin" || caller?.role === "state_ops";
  if (!privileged && customer?.user_id !== user.id) {
    return json({ ok: false, error: "Forbidden" }, 403);
  }

  const site = addressOf(booking.service_site_address);
  const stateName = site.state?.trim() ?? "";
  const { data: states } = await admin.from("operation_states").select("id, name, is_active");
  const stateRow = (states ?? []).find(
    (s) => s.is_active && s.name.trim().toLowerCase() === stateName.toLowerCase(),
  );

  let recipients: { email: string; full_name: string | null }[] = [];
  if (stateRow) {
    const { data: links } = await admin
      .from("user_operation_states")
      .select("user_id")
      .eq("state_id", stateRow.id);
    const ids = (links ?? []).map((row) => row.user_id).filter(Boolean);
    if (ids.length) {
      const { data: people } = await admin
        .from("users")
        .select("email, full_name, role, is_active")
        .in("id", ids)
        .eq("role", "state_ops")
        .eq("is_active", true);
      recipients = (people ?? [])
        .filter((person) => typeof person.email === "string" && person.email.includes("@"))
        .map((person) => ({ email: person.email as string, full_name: person.full_name }));
    }
  }

  const { data: account } = customer?.user_id
    ? await admin.from("users").select("full_name, phone, email").eq("id", customer.user_id).maybeSingle()
    : { data: null };
  let partner = "Not assigned yet — assign a partner from Bookings.";
  if (booking.vendor_id) {
    const { data: vendor } = await admin
      .from("vendors")
      .select("business_name")
      .eq("id", booking.vendor_id)
      .maybeSingle();
    partner = vendor?.business_name?.trim() || "Assigned partner";
  }

  const customerName = customer?.display_name?.trim() || account?.full_name?.trim() || "Customer";
  const lines = [
    `Reference: ${booking.reference_code ?? booking.id}`,
    `Status: ${booking.status}`,
    `When: ${formatWhen(booking.scheduled_start)} – ${formatWhen(booking.scheduled_end)} IST`,
    `Customer: ${customerName}`,
    `Phone: ${account?.phone ?? "—"}`,
    `Email: ${customer?.contact_email ?? account?.email ?? "—"}`,
    `Site: ${[site.formatted, site.line1, site.line2, site.city, site.state, site.pincode].filter(Boolean).join(", ") || "—"}`,
    `Partner: ${partner}`,
    `Estimate: ${inr(booking.estimated_price_cents)}`,
    booking.customer_notes?.trim() ? `Notes: ${booking.customer_notes.trim()}` : null,
    "",
    "Assign the partner in the operations desk. This visit is not offered to the partner network.",
  ].filter((line): line is string => line !== null);

  const subject = `New booking ${booking.reference_code ?? ""}`.trim() + (stateName ? ` — ${stateName}` : "");
  const text = lines.join("\n");

  if (!recipients.length) {
    return json({
      ok: true,
      sent: 0,
      reason: stateName ? "no_state_ops_for_state" : "booking_has_no_state",
      state: stateName || null,
    });
  }

  const apiKey = Deno.env.get("RESEND_API_KEY")?.trim();
  const from = Deno.env.get("RESEND_FROM_EMAIL")?.trim() || "OorjaMan <noreply@oorjaman.com>";
  if (!apiKey) {
    return json({ ok: true, sent: 0, reason: "email_not_configured", recipients: recipients.length });
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: recipients.map((person) => person.email),
      subject,
      text,
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    return json({ ok: false, error: "Email provider rejected the message", detail }, 502);
  }

  return json({ ok: true, sent: recipients.length, state: stateName });
});
