/// <reference path="../supabase-edge.d.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { createHmac } from "node:crypto";

type RazorpayEntity = {
  id?: string;
  order_id?: string;
  method?: string;
  status?: string;
  amount?: number;
  error_code?: string;
  error_description?: string;
  error_source?: string;
  error_step?: string;
  error_reason?: string;
  notes?: Record<string, string>;
};

type RefundEntity = {
  id?: string;
  payment_id?: string;
  amount?: number;
  status?: string;
  notes?: Record<string, string>;
};

type WebhookPayload = {
  event?: string;
  id?: string;
  payload?: {
    payment?: { entity?: RazorpayEntity };
    order?: { entity?: RazorpayEntity };
    refund?: { entity?: RefundEntity };
  };
};

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

/** Minimal reason → category map (keep in sync with packages/api razorpay-errors). */
function normalizeFailure(entity: RazorpayEntity | undefined): {
  status: "failed" | "cancelled" | "timeout";
  category: string;
  message: string;
  reason: string;
} {
  const reason = (entity?.error_reason ?? entity?.error_code ?? "payment_failed").toString().toLowerCase();
  if (reason.includes("cancel")) {
    return {
      status: "cancelled",
      category: "PAYMENT_CANCELLED",
      message: "Payment was cancelled.",
      reason,
    };
  }
  if (reason.includes("timeout") || reason.includes("timed_out")) {
    return {
      status: "timeout",
      category: "PAYMENT_TIMEOUT",
      message: "The payment timed out. Please try again.",
      reason,
    };
  }
  const map: Record<string, { category: string; message: string }> = {
    insufficient_funds: {
      category: "INSUFFICIENT_FUNDS",
      message: "Your bank could not complete the payment due to insufficient funds.",
    },
    insufficient_fund: {
      category: "INSUFFICIENT_FUNDS",
      message: "Your bank could not complete the payment due to insufficient funds.",
    },
    card_declined: {
      category: "BANK_DECLINED",
      message: "Your bank declined this payment. Please try another payment method.",
    },
    incorrect_cvv: {
      category: "CUSTOMER_ACTION_REQUIRED",
      message: "The CVV appears to be incorrect. Please check your card details.",
    },
    card_expired: {
      category: "CARD_INVALID",
      message: "This card has expired. Please use another card.",
    },
    payment_risk_check_failed: {
      category: "RISK_DECLINED",
      message: "Your payment was declined for security reasons. Please try another payment method.",
    },
    gateway_technical_error: {
      category: "GATEWAY_ERROR",
      message: "Payment service is temporarily unavailable. Please try again.",
    },
    bank_technical_error: {
      category: "BANK_UNAVAILABLE",
      message: "Your bank is temporarily unavailable. Please try again later.",
    },
  };
  const hit = map[reason];
  return {
    status: "failed",
    category: hit?.category ?? "UNKNOWN_PAYMENT_ERROR",
    message: hit?.message ?? "Payment could not be completed. Please try again.",
    reason,
  };
}

Deno.serve(async (req: Request) => {
  const json = (body: Record<string, unknown>, status = 200): Response =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const webhookSecret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET")?.trim();

  if (!supabaseUrl || !serviceKey) {
    return json({ ok: false, error: "Server configuration error" }, 500);
  }
  if (!webhookSecret) {
    return json({ ok: false, error: "Webhook secret not configured" }, 503);
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature")?.trim() ?? "";
  const expected = createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
  if (!signature || !timingSafeEqual(signature, expected)) {
    return json({ ok: false, error: "Invalid signature" }, 401);
  }

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(rawBody) as WebhookPayload;
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }

  const event = payload.event ?? "";
  const eventId = typeof payload.id === "string" ? payload.id : "";
  const paymentEntity = payload.payload?.payment?.entity;
  const orderEntity = payload.payload?.order?.entity;
  const refundEntity = payload.payload?.refund?.entity;

  const adminClient = createClient(supabaseUrl, serviceKey);

  if (eventId) {
    const { data: claimed, error: claimErr } = await adminClient.rpc("claim_razorpay_webhook_event", {
      p_event_id: eventId,
      p_event_type: event,
      p_payload: payload as unknown as Record<string, unknown>,
    });
    if (claimErr) {
      console.error("claim_razorpay_webhook_event", claimErr.message);
      return json({ ok: false, error: claimErr.message }, 500);
    }
    if (claimed === false) {
      return json({ ok: true, duplicate: true, event, event_id: eventId });
    }
  }

  // --- Captured / paid only (authorized is NOT paid) ---
  if (event === "payment.captured" || event === "order.paid") {
    const orderId =
      (event === "order.paid" ? orderEntity?.id : paymentEntity?.order_id)?.trim() || null;
    const razorpayPaymentId = paymentEntity?.id?.trim() || null;
    const method = paymentEntity?.method?.trim() || null;
    if (!orderId) return json({ ok: false, error: "Missing order_id in webhook" }, 400);

    const { data, error } = await adminClient.rpc("fulfill_razorpay_payment", {
      p_razorpay_order_id: orderId,
      p_razorpay_payment_id: razorpayPaymentId,
      p_payment_method: method ? method.toUpperCase() : "Razorpay",
      p_razorpay_payment_status: "captured",
      p_amount_paise: typeof paymentEntity?.amount === "number" ? paymentEntity.amount : null,
      p_method_type: method,
    });
    if (error) {
      console.error("fulfill_razorpay_payment", error.message);
      return json({ ok: false, error: error.message }, 500);
    }
    return json({ ok: true, event, result: data });
  }

  // Authorized: record only — never confirm booking / fund AMC
  if (event === "payment.authorized") {
    const orderId = paymentEntity?.order_id?.trim() || null;
    if (!orderId) return json({ ok: false, error: "Missing order_id" }, 400);
    const { data, error } = await adminClient.rpc("fulfill_razorpay_payment", {
      p_razorpay_order_id: orderId,
      p_razorpay_payment_id: paymentEntity?.id?.trim() || null,
      p_payment_method: paymentEntity?.method ? paymentEntity.method.toUpperCase() : null,
      p_razorpay_payment_status: "authorized",
      p_amount_paise: typeof paymentEntity?.amount === "number" ? paymentEntity.amount : null,
      p_method_type: paymentEntity?.method ?? null,
    });
    if (error) {
      console.error("authorized fulfill", error.message);
      return json({ ok: false, error: error.message }, 500);
    }
    return json({ ok: true, event, result: data });
  }

  if (event === "payment.failed") {
    const orderId = paymentEntity?.order_id?.trim() || null;
    if (!orderId) return json({ ok: false, error: "Missing order_id" }, 400);
    const norm = normalizeFailure(paymentEntity);
    const { data, error } = await adminClient.rpc("record_razorpay_payment_failure", {
      p_razorpay_order_id: orderId,
      p_razorpay_payment_id: paymentEntity?.id?.trim() || null,
      p_status: norm.status,
      p_error_code: paymentEntity?.error_code ?? null,
      p_error_description: paymentEntity?.error_description ?? null,
      p_error_source: paymentEntity?.error_source ?? null,
      p_error_step: paymentEntity?.error_step ?? null,
      p_error_reason: norm.reason,
      p_error_field: null,
      p_error_metadata: paymentEntity ?? null,
      p_customer_error_category: norm.category,
      p_customer_error_message: norm.message,
    });
    if (error) {
      console.error("record_razorpay_payment_failure", error.message);
      return json({ ok: false, error: error.message }, 500);
    }
    return json({ ok: true, event, result: data });
  }

  if (event === "refund.created" || event === "refund.processed" || event === "refund.failed") {
    const rid = refundEntity?.id?.trim();
    const pid = refundEntity?.payment_id?.trim();
    if (!rid || !pid) return json({ ok: false, error: "Missing refund/payment id" }, 400);
    const status =
      event === "refund.processed" ? "processed" : event === "refund.failed" ? "failed" : "pending";
    const { data, error } = await adminClient.rpc("apply_razorpay_refund", {
      p_razorpay_payment_id: pid,
      p_razorpay_refund_id: rid,
      p_amount_paise: typeof refundEntity?.amount === "number" ? refundEntity.amount : 0,
      p_refund_status: status,
      p_reason: null,
    });
    if (error) {
      console.error("apply_razorpay_refund", error.message);
      return json({ ok: false, error: error.message }, 500);
    }
    return json({ ok: true, event, result: data });
  }

  return json({ ok: true, ignored: true, event });
});
