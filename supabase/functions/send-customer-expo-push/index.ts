/// <reference path="../supabase-edge.d.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

type OutboxRow = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  status: string;
  attempt_count: number;
};

type PushTokenRow = {
  expo_push_token: string;
};

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-push-dispatch-secret",
};

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function backoffMinutes(attempt: number): number {
  if (attempt <= 1) return 2;
  if (attempt === 2) return 5;
  if (attempt === 3) return 15;
  return 60;
}

function isAuthorized(req: Request, dispatchSecret: string | undefined): boolean {
  if (dispatchSecret) {
    const header = req.headers.get("x-push-dispatch-secret");
    if (header === dispatchSecret) return true;
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) return false;
  return authHeader === `Bearer ${serviceKey}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  const dispatchSecret = Deno.env.get("PUSH_DISPATCH_SECRET");
  if (!isAuthorized(req, dispatchSecret)) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return json({ ok: false, error: "Server configuration error" }, 500);
  }

  let body: { outbox_id?: string; limit?: number } = {};
  try {
    body = (await req.json()) as { outbox_id?: string; limit?: number };
  } catch {
    body = {};
  }

  const limit = Math.max(1, Math.min(100, Math.round(Number(body.limit ?? 25))));
  const admin = createClient(supabaseUrl, serviceKey);
  const nowIso = new Date().toISOString();

  let query = admin
    .from("customer_push_outbox")
    .select("id, user_id, title, body, data, status, attempt_count")
    .eq("status", "queued")
    .lte("next_attempt_at", nowIso)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (body.outbox_id) {
    query = admin
      .from("customer_push_outbox")
      .select("id, user_id, title, body, data, status, attempt_count")
      .eq("id", body.outbox_id)
      .limit(1);
  }

  const { data: rows, error: fetchErr } = await query;
  if (fetchErr) return json({ ok: false, error: fetchErr.message }, 500);

  const expoAccessToken = Deno.env.get("EXPO_ACCESS_TOKEN");
  let sent = 0;
  let failed = 0;

  for (const row of (rows ?? []) as OutboxRow[]) {
    const attempt = (row.attempt_count ?? 0) + 1;

    const { data: tokensRaw, error: tokErr } = await admin
      .from("customer_push_tokens")
      .select("expo_push_token")
      .eq("user_id", row.user_id);

    if (tokErr) {
      failed += 1;
      await markFailed(admin, row.id, attempt, tokErr.message);
      continue;
    }

    const tokens = ((tokensRaw ?? []) as PushTokenRow[])
      .map((t) => t.expo_push_token?.trim())
      .filter((t): t is string => Boolean(t));

    if (tokens.length === 0) {
      await markSent(admin, row.id, attempt);
      sent += 1;
      continue;
    }

    const pushMessages = tokens.map((to) => ({
      to,
      title: row.title,
      body: row.body,
      data: row.data ?? {},
      sound: "chat_message.wav",
      channelId: "support-chat",
    }));

    try {
      const res = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(expoAccessToken ? { Authorization: `Bearer ${expoAccessToken}` } : {}),
        },
        body: JSON.stringify(pushMessages),
      });

      const payload = (await res.json()) as {
        data?: { status?: string; details?: { error?: string } }[];
        errors?: { message?: string }[];
      };

      if (!res.ok) {
        const errMsg =
          payload.errors?.[0]?.message ?? `Expo push HTTP ${res.status}`;
        failed += 1;
        await markFailed(admin, row.id, attempt, errMsg);
        continue;
      }

      const ticketErrors = (payload.data ?? [])
        .filter((t) => t.status === "error")
        .map((t) => t.details?.error ?? "ticket_error");

      if (ticketErrors.length === tokens.length) {
        failed += 1;
        await markFailed(admin, row.id, attempt, ticketErrors.join("; "));
        continue;
      }

      await markSent(admin, row.id, attempt);
      sent += 1;
    } catch (e) {
      failed += 1;
      await markFailed(admin, row.id, attempt, e instanceof Error ? e.message : "push_failed");
    }
  }

  return json({
    ok: true,
    processed: (rows ?? []).length,
    sent,
    failed,
  });
});

async function markSent(
  admin: ReturnType<typeof createClient>,
  id: string,
  attempt: number,
): Promise<void> {
  await admin
    .from("customer_push_outbox")
    .update({
      status: "sent",
      attempt_count: attempt,
      sent_at: new Date().toISOString(),
      last_error: null,
    })
    .eq("id", id);
}

async function markFailed(
  admin: ReturnType<typeof createClient>,
  id: string,
  attempt: number,
  message: string,
): Promise<void> {
  const terminal = attempt >= 5;
  const retryAt = new Date(Date.now() + backoffMinutes(attempt) * 60_000).toISOString();
  await admin
    .from("customer_push_outbox")
    .update({
      status: terminal ? "failed" : "queued",
      attempt_count: attempt,
      next_attempt_at: retryAt,
      last_error: message.slice(0, 500),
    })
    .eq("id", id);
}
