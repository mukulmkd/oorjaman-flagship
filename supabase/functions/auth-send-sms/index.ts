/// <reference path="../supabase-edge.d.ts" />
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

/**
 * Supabase Auth "Send SMS" hook.
 *
 * Auth creates the OTP; this hook only delivers it through MSG91 Flow (SMS channel).
 * Do not use MSG91's OTP product — verification stays in Supabase Auth.
 *
 * Secrets (Edge Function):
 * - SEND_SMS_HOOK_SECRET — same `v1,whsec_…` value configured on Auth → Hooks → Send SMS
 * - MSG91_AUTHKEY — MSG91 Authkey (IP security off)
 * - MSG91_TEMPLATE_ID — MSG91 Flow / template ID (not the Airtel DLT template ID)
 * - MSG91_OTP_VAR — optional; defaults to `otp` (must match ##otp## in the MSG91 template)
 */

type AuthSmsPayload = {
  user?: { phone?: string };
  sms?: { otp?: string };
};

function hookSecret(): string | null {
  const raw = Deno.env.get("SEND_SMS_HOOK_SECRET")?.trim() ?? "";
  if (!raw) return null;
  return raw.replace(/^v1,whsec_/, "");
}

/** MSG91 expects digits with country code, no `+`. */
function msg91Mobile(phone: string): string {
  return phone.replace(/\D/g, "");
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: { message: "Method not allowed" } }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const secret = hookSecret();
  if (!secret) {
    return new Response(JSON.stringify({ error: { message: "SMS hook is not configured" } }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);
  let event: AuthSmsPayload;
  try {
    event = new Webhook(secret).verify(payload, headers) as AuthSmsPayload;
  } catch {
    return new Response(JSON.stringify({ error: { message: "Invalid webhook signature" } }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const phone = event.user?.phone?.trim() ?? "";
  const otp = event.sms?.otp?.trim() ?? "";
  if (!phone || !otp) {
    return new Response(JSON.stringify({ error: { message: "Incomplete SMS payload" } }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const authkey = Deno.env.get("MSG91_AUTHKEY")?.trim() ?? "";
  const templateId = Deno.env.get("MSG91_TEMPLATE_ID")?.trim() ?? "";
  const otpVar = Deno.env.get("MSG91_OTP_VAR")?.trim() || "otp";
  if (!authkey || !templateId) {
    return new Response(JSON.stringify({ error: { message: "SMS provider is not configured" } }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const mobiles = msg91Mobile(phone);
  if (!mobiles) {
    return new Response(JSON.stringify({ error: { message: "Invalid phone number" } }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const res = await fetch("https://control.msg91.com/api/v5/flow/", {
    method: "POST",
    headers: {
      authkey,
      "Content-Type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      template_id: templateId,
      short_url: "0",
      recipients: [
        {
          mobiles,
          [otpVar]: otp,
        },
      ],
    }),
  });

  let body: { type?: string; message?: string } = {};
  try {
    body = (await res.json()) as { type?: string; message?: string };
  } catch {
    body = {};
  }

  if (!res.ok || body.type === "error") {
    console.error("msg91_flow_failed", {
      status: res.status,
      type: body.type ?? null,
      message: body.message ?? null,
    });
    return new Response(
      JSON.stringify({
        error: { message: "SMS provider rejected the message", http_code: 502 },
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json", "retry-after": "true" },
      },
    );
  }

  return new Response(JSON.stringify({}), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
