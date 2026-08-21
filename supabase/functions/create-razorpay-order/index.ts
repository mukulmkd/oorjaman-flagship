/// <reference path="../supabase-edge.d.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

import { corsHeaders as resolveCors } from "../_shared/cors.ts";
import { enforceEdgeRateLimit, subjectUserAndIp } from "../_shared/rate-limit.ts";

type Purpose = "one_time" | "amc" | "postpaid_collect";

type Body = {
  purpose?: Purpose;
  booking_id?: string;
  subscription_id?: string;
  amount_paise?: number;
};

function basicAuthHeader(keyId: string, keySecret: string): string {
  const token = btoa(`${keyId}:${keySecret}`);
  return `Basic ${token}`;
}

Deno.serve(async (req: Request) => {
  const cors = resolveCors(req);
  const json = (body: Record<string, unknown>, status = 200): Response =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }
  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID")?.trim();
  const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET")?.trim();

  if (!supabaseUrl || !serviceKey || !anonKey) {
    return json({ ok: false, error: "Server configuration error" }, 500);
  }
  if (!razorpayKeyId || !razorpayKeySecret) {
    return json({ ok: false, error: "Razorpay is not configured on this environment" }, 503);
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
  if (userErr || !user) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  const adminClient = createClient(supabaseUrl, serviceKey);

  const rateLimited = await enforceEdgeRateLimit({
    admin: adminClient,
    req,
    functionName: "create-razorpay-order",
    subject: subjectUserAndIp(user.id, req),
    cors,
  });
  if (rateLimited) return rateLimited;

  const { data: customer, error: custErr } = await adminClient
    .from("customers")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (custErr) return json({ ok: false, error: custErr.message }, 500);

  const { data: technician } = await adminClient
    .from("technicians")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return json({ ok: false, error: "Invalid JSON body" }, 400);
  }

  const purpose = body.purpose;
  const amountPaise = Math.round(Number(body.amount_paise));
  if (purpose !== "one_time" && purpose !== "amc" && purpose !== "postpaid_collect") {
    return json({ ok: false, error: "purpose must be one_time, amc, or postpaid_collect" }, 400);
  }
  if (!Number.isFinite(amountPaise) || amountPaise < 100) {
    return json({ ok: false, error: "amount_paise must be at least 100 (₹1)" }, 400);
  }

  let bookingId: string | null = null;
  let subscriptionId: string | null = null;
  let paymentCustomerId: string | null = customer?.id ?? null;

  if (purpose === "one_time") {
    if (!customer?.id) return json({ ok: false, error: "Customer profile not found" }, 400);
    bookingId = body.booking_id?.trim() || null;
    if (!bookingId) return json({ ok: false, error: "booking_id required" }, 400);

    const { data: booking, error: bookErr } = await adminClient
      .from("bookings")
      .select("id, customer_id, status")
      .eq("id", bookingId)
      .maybeSingle();
    if (bookErr) return json({ ok: false, error: bookErr.message }, 500);
    if (!booking || booking.customer_id !== customer.id) {
      return json({ ok: false, error: "Booking not found" }, 404);
    }
    if (booking.status !== "pending_payment") {
      return json({ ok: false, error: "Booking is not awaiting payment" }, 400);
    }
  } else if (purpose === "postpaid_collect") {
    bookingId = body.booking_id?.trim() || null;
    if (!bookingId) return json({ ok: false, error: "booking_id required" }, 400);

    const { data: booking, error: bookErr } = await adminClient
      .from("bookings")
      .select("id, customer_id, status, payment_timing, technician_id, estimated_price_cents, final_price_cents")
      .eq("id", bookingId)
      .maybeSingle();
    if (bookErr) return json({ ok: false, error: bookErr.message }, 500);
    if (!booking) return json({ ok: false, error: "Booking not found" }, 404);
    if (booking.payment_timing !== "postpaid") {
      return json({ ok: false, error: "Booking is not postpaid" }, 400);
    }
    if (booking.status !== "completed") {
      return json({ ok: false, error: "Collect only after visit is completed" }, 400);
    }

    const isCustomer = customer?.id && booking.customer_id === customer.id;
    const isAssignedTech = technician?.id && booking.technician_id === technician.id;
    if (!isCustomer && !isAssignedTech) {
      return json({ ok: false, error: "Not authorized for this booking" }, 403);
    }

    paymentCustomerId = booking.customer_id;

    const { data: existingPaid } = await adminClient
      .from("payments")
      .select("id")
      .eq("booking_id", bookingId)
      .eq("status", "success")
      .limit(1)
      .maybeSingle();
    if (existingPaid?.id) {
      return json({ ok: false, error: "Booking is already paid" }, 400);
    }
  } else {
    if (!customer?.id) return json({ ok: false, error: "Customer profile not found" }, 400);
    subscriptionId = body.subscription_id?.trim() || null;
    if (!subscriptionId) return json({ ok: false, error: "subscription_id required" }, 400);

    const { data: sub, error: subErr } = await adminClient
      .from("subscriptions")
      .select("id, customer_id, status, amount_cents")
      .eq("id", subscriptionId)
      .maybeSingle();
    if (subErr) return json({ ok: false, error: subErr.message }, 500);
    if (!sub || sub.customer_id !== customer.id) {
      return json({ ok: false, error: "Subscription not found" }, 404);
    }
    if (sub.status !== "trialing") {
      return json({ ok: false, error: "Subscription is not awaiting AMC payment" }, 400);
    }
  }

  if (!paymentCustomerId) {
    return json({ ok: false, error: "Customer profile not found" }, 400);
  }

  const receiptKey = bookingId ?? subscriptionId ?? "x";
  const receipt = `om_${purpose === "amc" ? "s" : "b"}_${receiptKey.replace(/-/g, "").slice(0, 24)}`;
  const orderPayload = {
    amount: amountPaise,
    currency: "INR",
    receipt: receipt.slice(0, 40),
    notes: {
      purpose,
      customer_id: paymentCustomerId,
      booking_id: bookingId ?? "",
      subscription_id: subscriptionId ?? "",
    },
  };

  const rzRes = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(razorpayKeyId, razorpayKeySecret),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(orderPayload),
  });

  const rzText = await rzRes.text();
  let rzJson: Record<string, unknown> = {};
  try {
    rzJson = JSON.parse(rzText) as Record<string, unknown>;
  } catch {
    /* keep empty */
  }
  if (!rzRes.ok) {
    const msg =
      typeof rzJson.error === "object" && rzJson.error && "description" in (rzJson.error as object)
        ? String((rzJson.error as { description?: string }).description)
        : rzText.slice(0, 200) || "Razorpay order failed";
    return json({ ok: false, error: msg }, 502);
  }

  const orderId = typeof rzJson.id === "string" ? rzJson.id : null;
  if (!orderId) return json({ ok: false, error: "Razorpay order missing id" }, 502);

  let paymentLinkUrl: string | null = null;
  let paymentLinkId: string | null = null;

  // Postpaid: also create a Payment Link so technician can show QR / share UPI-friendly URL.
  if (purpose === "postpaid_collect" && bookingId) {
    const linkRes = await fetch("https://api.razorpay.com/v1/payment_links", {
      method: "POST",
      headers: {
        Authorization: basicAuthHeader(razorpayKeyId, razorpayKeySecret),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: "INR",
        accept_partial: false,
        description: "OorjaMan visit payment",
        reference_id: orderId.slice(0, 40),
        notes: {
          purpose: "postpaid_collect",
          booking_id: bookingId,
          customer_id: paymentCustomerId,
          razorpay_order_id: orderId,
        },
      }),
    });
    const linkText = await linkRes.text();
    try {
      const linkJson = JSON.parse(linkText) as {
        id?: string;
        short_url?: string;
        error?: { description?: string };
      };
      if (linkRes.ok) {
        paymentLinkId = typeof linkJson.id === "string" ? linkJson.id : null;
        paymentLinkUrl = typeof linkJson.short_url === "string" ? linkJson.short_url : null;
      } else {
        console.error("payment_link create failed", linkJson.error?.description ?? linkText.slice(0, 200));
      }
    } catch {
      console.error("payment_link parse failed", linkText.slice(0, 200));
    }
  }

  let attemptNumber = 1;
  if (bookingId) {
    const { count } = await adminClient
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("booking_id", bookingId)
      .eq("provider", "razorpay");
    attemptNumber = Math.max(1, (count ?? 0) + 1);
  } else if (subscriptionId) {
    const { count } = await adminClient
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("subscription_id", subscriptionId)
      .eq("provider", "razorpay");
    attemptNumber = Math.max(1, (count ?? 0) + 1);
  }

  const { data: payment, error: payErr } = await adminClient
    .from("payments")
    .insert({
      customer_id: paymentCustomerId,
      booking_id: bookingId,
      subscription_id: subscriptionId,
      amount: amountPaise,
      currency: "INR",
      status: "pending",
      provider: "razorpay",
      collection_channel: "oorjaman",
      razorpay_order_id: orderId,
      razorpay_order_status: "created",
      razorpay_payment_link_id: paymentLinkId,
      razorpay_payment_link_url: paymentLinkUrl,
      attempt_number: attemptNumber,
    })
    .select(
      "id, amount, razorpay_order_id, booking_id, subscription_id, status, provider, attempt_number, razorpay_payment_link_url",
    )
    .single();

  if (payErr || !payment) {
    return json({ ok: false, error: payErr?.message ?? "Could not create payment row" }, 500);
  }

  return json({
    ok: true,
    key_id: razorpayKeyId,
    order_id: orderId,
    amount: amountPaise,
    currency: "INR",
    payment_id: payment.id,
    booking_id: bookingId,
    subscription_id: subscriptionId,
    payment_link_url: paymentLinkUrl,
  });
});
