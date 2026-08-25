/// <reference path="../supabase-edge.d.ts" />
/**
 * Initiate a Razorpay refund for a captured payment.
 * Source of truth remains webhooks (`apply_razorpay_refund`); this function creates the refund
 * at Razorpay and optimistically marks payment as refund_pending.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

import { corsHeaders as resolveCors } from "../_shared/cors.ts";
import { enforceEdgeRateLimit, subjectUserAndIp } from "../_shared/rate-limit.ts";

type Body = {
  payment_id?: string;
  amount_paise?: number;
  reason?: string;
  idempotency_key?: string;
};

function basicAuthHeader(keyId: string, keySecret: string): string {
  return `Basic ${btoa(`${keyId}:${keySecret}`)}`;
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
  const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID")?.trim();
  const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET")?.trim();

  if (!supabaseUrl || !serviceKey || !anonKey) {
    return json({ ok: false, error: "Server configuration error" }, 500);
  }
  if (!razorpayKeyId || !razorpayKeySecret) {
    return json({ ok: false, error: "Razorpay is not configured" }, 503);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ ok: false, error: "Unauthorized" }, 401);
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

  const adminClient = createClient(supabaseUrl, serviceKey);
  const rateLimited = await enforceEdgeRateLimit({
    admin: adminClient,
    req,
    functionName: "create-razorpay-refund",
    subject: subjectUserAndIp(user.id, req),
    cors,
  });
  if (rateLimited) return rateLimited;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }

  const paymentId = body.payment_id?.trim() ?? "";
  if (!paymentId) return json({ ok: false, error: "payment_id is required" }, 400);

  const { data: payRow, error: payErr } = await adminClient
    .from("payments")
    .select("*")
    .eq("id", paymentId)
    .maybeSingle();
  if (payErr || !payRow) {
    return json({ ok: false, error: "Payment not found" }, 404);
  }

  // Authorize: admin, owning customer, or vendor of linked booking.
  const { data: userRow } = await adminClient.from("users").select("role").eq("id", user.id).maybeSingle();
  const isAdmin = userRow?.role === "admin";

  let allowed = isAdmin;
  if (!allowed) {
    const { data: customer } = await adminClient
      .from("customers")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (customer?.id && customer.id === payRow.customer_id) allowed = true;
  }
  if (!allowed && payRow.booking_id) {
    const { data: vendor } = await adminClient
      .from("vendors")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (vendor?.id) {
      const { data: booking } = await adminClient
        .from("bookings")
        .select("vendor_id")
        .eq("id", payRow.booking_id)
        .maybeSingle();
      if (booking?.vendor_id === vendor.id) allowed = true;
    }
  }
  if (!allowed) return json({ ok: false, error: "Forbidden" }, 403);

  if (payRow.provider !== "razorpay") {
    return json({ ok: false, error: "Only Razorpay payments can be refunded here" }, 400);
  }
  if (payRow.status !== "success" && payRow.status !== "partially_refunded") {
    return json(
      {
        ok: false,
        error: `Payment status ${payRow.status} is not refundable`,
        payment_status: payRow.status,
      },
      409,
    );
  }

  const rzpPaymentId = typeof payRow.razorpay_payment_id === "string"
    ? payRow.razorpay_payment_id.trim()
    : "";
  if (!rzpPaymentId) {
    return json({ ok: false, error: "Payment has no Razorpay payment id" }, 400);
  }

  const amountTotal = Math.max(0, Math.round(Number(payRow.amount) || 0));
  const alreadyRefunded = Math.max(0, Math.round(Number(payRow.amount_refunded) || 0));
  const remaining = Math.max(0, amountTotal - alreadyRefunded);
  if (remaining <= 0) {
    return json({
      ok: true,
      already_refunded: true,
      payment_id: payRow.id,
      amount_paise: 0,
      payment_status: payRow.status,
    });
  }

  let amountPaise =
    body.amount_paise != null ? Math.max(0, Math.round(Number(body.amount_paise))) : remaining;
  if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
    return json({ ok: false, error: "amount_paise must be a positive integer" }, 400);
  }
  if (amountPaise > remaining) {
    return json(
      {
        ok: false,
        error: `Refund amount exceeds remaining (max ${remaining} paise)`,
        remaining_paise: remaining,
      },
      400,
    );
  }

  const reason = (body.reason?.trim() || "OorjaMan booking cancellation").slice(0, 500);
  const idempotencyKey = body.idempotency_key?.trim().slice(0, 64) || undefined;

  // Idempotency: if a pending/processed refund already exists for this amount + key in notes, reuse.
  if (idempotencyKey) {
    const { data: existingRefunds } = await adminClient
      .from("payment_refunds")
      .select("id, razorpay_refund_id, amount_paise, status, reason")
      .eq("payment_id", paymentId)
      .in("status", ["pending", "processed"])
      .order("created_at", { ascending: false })
      .limit(20);
    const hit = (existingRefunds ?? []).find(
      (r) =>
        r.amount_paise === amountPaise &&
        typeof r.reason === "string" &&
        r.reason.includes(`idem:${idempotencyKey}`),
    );
    if (hit) {
      return json({
        ok: true,
        already_initiated: true,
        payment_id: payRow.id,
        refund_id: hit.id,
        razorpay_refund_id: hit.razorpay_refund_id,
        amount_paise: hit.amount_paise,
        payment_status: payRow.status,
      });
    }
  }

  const rzBody: Record<string, unknown> = {
    amount: amountPaise,
    notes: {
      oorjaman_payment_id: payRow.id,
      oorjaman_booking_id: payRow.booking_id ?? "",
      reason,
      ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
    },
  };

  const rzHeaders: Record<string, string> = {
    Authorization: basicAuthHeader(razorpayKeyId, razorpayKeySecret),
    "Content-Type": "application/json",
  };
  if (idempotencyKey) {
    rzHeaders["X-Razorpay-Idempotency-Key"] = idempotencyKey;
  }

  const rzRes = await fetch(`https://api.razorpay.com/v1/payments/${rzpPaymentId}/refund`, {
    method: "POST",
    headers: rzHeaders,
    body: JSON.stringify(rzBody),
  });
  const rzText = await rzRes.text();
  let rzJson: Record<string, unknown> = {};
  try {
    rzJson = JSON.parse(rzText) as Record<string, unknown>;
  } catch {
    /* non-JSON */
  }

  if (!rzRes.ok) {
    const errMsg =
      typeof rzJson.error === "object" &&
      rzJson.error &&
      typeof (rzJson.error as { description?: unknown }).description === "string"
        ? (rzJson.error as { description: string }).description
        : rzText.slice(0, 200) || "Razorpay refund failed";
    return json({ ok: false, error: errMsg, razorpay_status: rzRes.status }, 502);
  }

  const razorpayRefundId =
    typeof rzJson.id === "string" ? rzJson.id.trim() : "";
  if (!razorpayRefundId) {
    return json({ ok: false, error: "Razorpay refund missing id" }, 502);
  }

  const rzStatusRaw = typeof rzJson.status === "string" ? rzJson.status.toLowerCase() : "pending";
  const applyStatus =
    rzStatusRaw === "processed" || rzStatusRaw === "completed"
      ? "processed"
      : rzStatusRaw === "failed"
        ? "failed"
        : "pending";

  const storedReason = idempotencyKey ? `${reason} | idem:${idempotencyKey}` : reason;

  const { data: applyResult, error: applyErr } = await adminClient.rpc("apply_razorpay_refund", {
    p_razorpay_payment_id: rzpPaymentId,
    p_razorpay_refund_id: razorpayRefundId,
    p_amount_paise: amountPaise,
    p_refund_status: applyStatus,
    p_reason: storedReason,
  });
  if (applyErr) {
    console.error("apply_razorpay_refund", applyErr.message);
    // Refund already created at Razorpay — webhook should still reconcile.
    return json({
      ok: true,
      payment_id: payRow.id,
      razorpay_refund_id: razorpayRefundId,
      amount_paise: amountPaise,
      apply_warning: applyErr.message,
    });
  }

  return json({
    ok: true,
    payment_id: payRow.id,
    razorpay_refund_id: razorpayRefundId,
    amount_paise: amountPaise,
    result: applyResult,
  });
});
