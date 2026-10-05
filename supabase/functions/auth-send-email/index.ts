/// <reference path="../supabase-edge.d.ts" />
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

/**
 * Supabase Auth "Send Email" hook.
 *
 * The Magic Link template has no clock, and a sign-in request does not update
 * metadata on an existing account before that template is rendered. This hook
 * sends the message itself so each sign-in subject can include the request
 * time in India, down to the second.
 *
 * Auth calls this with a Standard Webhooks signature, not a user JWT.
 */

type AuthEmailData = {
  token?: string;
  token_hash?: string;
  redirect_to?: string;
  email_action_type?: string;
  site_url?: string;
  token_new?: string;
  token_hash_new?: string;
};

type AuthEmailPayload = {
  user?: { email?: string };
  email_data?: AuthEmailData;
};

function hookSecret(): string | null {
  const raw = Deno.env.get("SEND_EMAIL_HOOK_SECRET")?.trim() ?? "";
  if (!raw) return null;
  return raw.replace(/^v1,whsec_/, "");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Clock time in India, e.g. "12:45:34 PM". */
function signInRequestedAt(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).formatToParts(now);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${pick("hour")}:${pick("minute")}:${pick("second")} ${pick("dayPeriod").toUpperCase()}`;
}

function isSignInCode(action: string): boolean {
  return action === "magiclink" || action === "email";
}

function subjectFor(action: string, requestedAt: string): string {
  if (isSignInCode(action)) {
    return `Your OorjaMan sign-in code requested at ${requestedAt}`;
  }
  switch (action) {
    case "signup":
      return "Confirm your OorjaMan email";
    case "recovery":
      return "Reset your OorjaMan password";
    case "invite":
      return "You have been invited to OorjaMan";
    case "email_change":
    case "email_change_new":
    case "email_change_current":
      return "Confirm your new OorjaMan email";
    case "reauthentication":
      return `Your OorjaMan verification code requested at ${requestedAt}`;
    default:
      return `Your OorjaMan code requested at ${requestedAt}`;
  }
}

function verifyUrl(data: AuthEmailData): string | null {
  const site = data.site_url?.trim();
  const tokenHash = data.token_hash?.trim();
  const action = data.email_action_type?.trim();
  if (!site || !tokenHash || !action || isSignInCode(action)) return null;
  const redirect = data.redirect_to?.trim() ?? "";
  const url = new URL("/auth/v1/verify", site.endsWith("/") ? site : `${site}/`);
  url.searchParams.set("token", tokenHash);
  url.searchParams.set("type", action);
  if (redirect) url.searchParams.set("redirect_to", redirect);
  return url.toString();
}

function messageCopy(action: string, token: string, link: string | null): { text: string; html: string } {
  const safeToken = escapeHtml(token);
  const heading = isSignInCode(action) ? "Your sign-in code" : "Your code";
  const lead = isSignInCode(action)
    ? "Enter this code in the app. It expires shortly."
    : "Use this code to continue. It expires shortly.";
  const linkText = link ? `\n\n${link}\n` : "\n";
  const text = [
    "OorjaMan",
    "",
    heading.toUpperCase(),
    "",
    lead,
    "",
    token,
    linkText.trimEnd(),
    "",
    "If you didn’t request this, you can ignore this email.",
  ].join("\n");
  const linkHtml = link
    ? `<p style="margin:0 0 24px;font-size:14px;line-height:1.5;"><a href="${escapeHtml(link)}" style="color:#1f8660;">Continue</a></p>`
    : "";
  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#0f2938;background:#f6faf9;">
  <div style="background:#ffffff;border-radius:16px;padding:32px 24px;border:1px solid #c5d9d4;">
    <img src="https://www.oorjaman.com/logo-icon.png" width="56" height="56" alt="OorjaMan" style="display:block;width:56px;height:56px;margin:0 0 20px;border:0;outline:none;text-decoration:none;" />
    <h1 style="margin:0 0 12px;font-size:22px;color:#0f2938;">${escapeHtml(heading)}</h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;color:#516a7b;">${escapeHtml(lead)}</p>
    <p style="margin:0 0 24px;font-size:32px;letter-spacing:8px;font-weight:700;color:#1f8660;">${safeToken}</p>
    ${linkHtml}
    <p style="margin:0;font-size:12px;color:#9B9B9B;">If you didn’t request this, you can ignore this email.</p>
  </div>
</div>`;
  return { text, html };
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
    return new Response(JSON.stringify({ error: { message: "Email hook is not configured" } }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);
  let event: AuthEmailPayload;
  try {
    event = new Webhook(secret).verify(payload, headers) as AuthEmailPayload;
  } catch {
    return new Response(JSON.stringify({ error: { message: "Invalid webhook signature" } }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const email = event.user?.email?.trim() ?? "";
  const data = event.email_data ?? {};
  const token = data.token?.trim() ?? "";
  const action = data.email_action_type?.trim() ?? "";
  if (!email || !token || !action) {
    return new Response(JSON.stringify({ error: { message: "Incomplete email payload" } }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const requestedAt = signInRequestedAt();
  const copy = messageCopy(action, token, verifyUrl(data));
  const apiKey = Deno.env.get("RESEND_API_KEY")?.trim();
  if (!apiKey) {
    return new Response(JSON.stringify({ error: { message: "Email provider is not configured" } }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const from = Deno.env.get("RESEND_FROM_EMAIL")?.trim() || "OorjaMan <noreply@oorjaman.com>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: subjectFor(action, requestedAt),
      text: copy.text,
      html: copy.html,
    }),
  });
  if (!res.ok) {
    return new Response(JSON.stringify({ error: { message: "Email provider rejected the message" } }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({}), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
