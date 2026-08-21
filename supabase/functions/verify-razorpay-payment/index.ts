/// <reference path="../supabase-edge.d.ts" />
/**
 * Frontend checkout callback → server-side HMAC verify + authoritative payment fetch.
 * Never treats client status as paid; only confirms after DB shows captured (webhook) or
 * after Razorpay API says payment is captured (then fulfills).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { createHmac } from "node:crypto";

import { corsHeaders as resolveCors } from "../_shared/cors.ts";
import { enforceEdgeRateLimit, subjectUserAndIp } from "../_shared/rate-limit.ts";

type Body = {
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
  oorjaman_payment_id?: string;
};

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

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
    functionName: "verify-razorpay-payment",
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

  const orderId = body.razorpay_order_id?.trim() ?? "";
  const paymentId = body.razorpay_payment_id?.trim() ?? "";
  const signature = body.razorpay_signature?.trim() ?? "";
  if (!orderId || !paymentId || !signature) {
    return json({ ok: false, error: "Missing order_id, payment_id, or signature" }, 400);
  }

  const expected = createHmac("sha256", razorpayKeySecret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  if (!timingSafeEqual(expected, signature)) {
    return json({ ok: false, error: "Invalid payment signature" }, 401);
  }

  const { data: customer } = await adminClient
    .from("customers")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!customer?.id) return json({ ok: false, error: "Customer not found" }, 404);

  const { data: payRow, error: payErr } = await adminClient
    .from("payments")
    .select("*")
    .eq("razorpay_order_id", orderId)
    .eq("customer_id", customer.id)
    .maybeSingle();
  if (payErr || !payRow) {
    return json({ ok: false, error: "Payment not found for this order" }, 404);
  }

  // Already captured via webhook — race-safe success.
  if (payRow.status === "success" || payRow.status === "partially_refunded") {
    return json({
      ok: true,
      status: payRow.status,
      payment_id: payRow.id,
      verified: true,
      source: "database",
    });
  }

  // Fetch authoritative payment from Razorpay
  const rzRes = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
    headers: { Authorization: basicAuthHeader(razorpayKeyId, razorpayKeySecret) },
  });
  const rzJson = (await rzRes.json()) as {
    status?: string;
    order_id?: string;
    amount?: number;
    method?: string;
    error_code?: string;
    error_description?: string;
    error_reason?: string;
  };
  if (!rzRes.ok) {
    return json({ ok: false, error: "Could not verify payment with Razorpay", details: rzJson }, 502);
  }
  if (rzJson.order_id && rzJson.order_id !== orderId) {
    return json({ ok: false, error: "Order mismatch" }, 400);
  }

  const rzStatus = (rzJson.status ?? "").toLowerCase();
  if (rzStatus === "captured") {
    const { data, error } = await adminClient.rpc("fulfill_razorpay_payment", {
      p_razorpay_order_id: orderId,
      p_razorpay_payment_id: paymentId,
      p_payment_method: rzJson.method ? rzJson.method.toUpperCase() : "Razorpay",
      p_razorpay_payment_status: "captured",
      p_amount_paise: typeof rzJson.amount === "number" ? rzJson.amount : null,
      p_method_type: rzJson.method ?? null,
    });
    if (error) return json({ ok: false, error: error.message }, 500);
    return json({
      ok: true,
      status: "success",
      payment_id: payRow.id,
      verified: true,
      source: "razorpay_api",
      result: data,
    });
  }

  if (rzStatus === "authorized") {
    await adminClient.rpc("fulfill_razorpay_payment", {
      p_razorpay_order_id: orderId,
      p_razorpay_payment_id: paymentId,
      p_payment_method: rzJson.method ? rzJson.method.toUpperCase() : null,
      p_razorpay_payment_status: "authorized",
      p_amount_paise: typeof rzJson.amount === "number" ? rzJson.amount : null,
      p_method_type: rzJson.method ?? null,
    });
    return json({
      ok: true,
      status: "authorized",
      payment_id: payRow.id,
      verified: true,
      message: "Payment authorized; waiting for capture confirmation.",
    });
  }

  if (rzStatus === "failed") {
    await adminClient.rpc("record_razorpay_payment_failure", {
      p_razorpay_order_id: orderId,
      p_razorpay_payment_id: paymentId,
      p_status: "failed",
      p_error_code: rzJson.error_code ?? null,
      p_error_description: rzJson.error_description ?? null,
      p_error_reason: rzJson.error_reason ?? "payment_failed",
      p_customer_error_category: "UNKNOWN_PAYMENT_ERROR",
      p_customer_error_message: "Payment could not be completed. Please try again.",
    });
    return json({ ok: true, status: "failed", payment_id: payRow.id, verified: true });
  }

  return json({
    ok: true,
    status: rzStatus || payRow.status,
    payment_id: payRow.id,
    verified: true,
    message: "Payment not yet captured; continue polling.",
  });
});
