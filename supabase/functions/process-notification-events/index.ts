/// <reference path="../supabase-edge.d.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

type EventRow = {
  id: string;
  channels: unknown;
  event_type: string;
  status: "queued" | "sent" | "failed";
  payload: Record<string, unknown> | null;
  attempt_count: number;
};

type TemplateRow = {
  id: string;
  event_type: string;
  channel: "in_app" | "email" | "sms" | "whatsapp";
  subject: string | null;
  body: string;
};

type ChannelSettingRow = {
  event_type: string;
  channel: "in_app" | "email" | "sms" | "whatsapp";
  enabled_demo: boolean;
  enabled_live: boolean;
};

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function asChannels(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((x): x is string => typeof x === "string");
}

function backoffMinutes(attempt: number): number {
  if (attempt <= 1) return 2;
  if (attempt === 2) return 5;
  if (attempt === 3) return 15;
  return 60;
}

function renderTemplateText(text: string, context: Record<string, unknown>): string {
  return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    const value = context[key];
    return value == null ? "" : String(value);
  });
}

function templateContextFromPayload(payload: Record<string, unknown> | null): Record<string, unknown> {
  if (!payload) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null) {
      out[key] = value;
    }
  }
  return out;
}

type ChannelResult = {
  channel: string;
  ok: boolean;
  provider: string;
  detail: string;
  rendered_subject?: string | null;
  rendered_body?: string | null;
};

async function deliverChannelDemo(args: {
  channel: string;
  providerMode: string;
  template: TemplateRow | null;
  context: Record<string, unknown>;
}): Promise<ChannelResult> {
  const provider = args.providerMode === "demo" ? "demo" : `${args.channel}-adapter`;
  const renderedSubject = args.template?.subject
    ? renderTemplateText(args.template.subject, args.context)
    : null;
  const renderedBody = args.template?.body
    ? renderTemplateText(args.template.body, args.context)
    : null;
  const detail = args.template
    ? `template:${args.template.id}`
    : "template:fallback";
  return {
    channel: args.channel,
    ok: true,
    provider,
    detail,
    rendered_subject: renderedSubject,
    rendered_body: renderedBody,
  };
}

async function deliverInAppAdapter(args: {
  providerMode: string;
  template: TemplateRow | null;
  context: Record<string, unknown>;
}): Promise<ChannelResult> {
  return deliverChannelDemo({
    channel: "in_app",
    providerMode: args.providerMode,
    template: args.template,
    context: args.context,
  });
}

async function deliverEmailAdapter(args: {
  providerMode: string;
  template: TemplateRow | null;
  context: Record<string, unknown>;
}): Promise<ChannelResult> {
  return deliverChannelDemo({
    channel: "email",
    providerMode: args.providerMode,
    template: args.template,
    context: args.context,
  });
}

async function deliverSmsAdapter(args: {
  providerMode: string;
  template: TemplateRow | null;
  context: Record<string, unknown>;
}): Promise<ChannelResult> {
  return deliverChannelDemo({
    channel: "sms",
    providerMode: args.providerMode,
    template: args.template,
    context: args.context,
  });
}

async function deliverWhatsappAdapter(args: {
  providerMode: string;
  template: TemplateRow | null;
  context: Record<string, unknown>;
}): Promise<ChannelResult> {
  return deliverChannelDemo({
    channel: "whatsapp",
    providerMode: args.providerMode,
    template: args.template,
    context: args.context,
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !serviceKey || !anonKey) {
    return json({ ok: false, error: "Server configuration error" }, 500);
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
  const { data: adminRow } = await adminClient.from("users").select("role").eq("id", user.id).maybeSingle();
  if (!adminRow || adminRow.role !== "admin") return json({ ok: false, error: "Forbidden" }, 403);

  let body: { limit?: number; event_type?: string } = {};
  try {
    body = (await req.json()) as { limit?: number; event_type?: string };
  } catch {
    body = {};
  }
  const limit = Math.max(1, Math.min(200, Math.round(Number(body.limit ?? 50))));
  const eventTypeFilter =
    typeof body.event_type === "string" && body.event_type.trim() ? body.event_type.trim() : null;
  const providerMode = String(Deno.env.get("NOTIFICATION_DELIVERY_MODE") ?? "demo").toLowerCase();
  const failChannels = new Set(
    String(Deno.env.get("NOTIFICATION_DEMO_FAIL_CHANNELS") ?? "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean),
  );
  const failRate = Math.max(0, Math.min(1, Number(Deno.env.get("NOTIFICATION_DEMO_FAIL_RATE") ?? "0")));

  const { data: templatesRaw, error: tplErr } = await adminClient
    .from("notification_templates")
    .select("id, event_type, channel, subject, body")
    .eq("is_active", true);
  if (tplErr) return json({ ok: false, error: tplErr.message }, 500);
  const templateMap = new Map<string, TemplateRow>();
  for (const t of (templatesRaw ?? []) as TemplateRow[]) {
    templateMap.set(`${t.event_type}__${t.channel}`, t);
  }
  const { data: settingsRaw, error: setErr } = await adminClient
    .from("notification_channel_settings")
    .select("event_type, channel, enabled_demo, enabled_live");
  if (setErr) return json({ ok: false, error: setErr.message }, 500);
  const settingsMap = new Map<string, ChannelSettingRow>();
  for (const s of (settingsRaw ?? []) as ChannelSettingRow[]) {
    settingsMap.set(`${s.event_type}__${s.channel}`, s);
  }

  const nowIso = new Date().toISOString();
  let queueQuery = adminClient
    .from("notification_events")
    .select("id, channels, event_type, status, payload, attempt_count")
    .eq("status", "queued")
    .lte("next_attempt_at", nowIso)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (eventTypeFilter) {
    queueQuery = queueQuery.eq("event_type", eventTypeFilter);
  }
  const { data: rows, error: fetchErr } = await queueQuery;
  if (fetchErr) return json({ ok: false, error: fetchErr.message }, 500);

  let sent = 0;
  let failed = 0;
  const events = (rows ?? []) as EventRow[];
  for (const row of events) {
    const channels = asChannels(row.channels);
    const attempt = (row.attempt_count ?? 0) + 1;
    const templateContext = templateContextFromPayload(
      row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
        ? (row.payload as Record<string, unknown>)
        : null,
    );
    const channelResults = await Promise.all(
      channels.map(async (channel) => {
        const setting = settingsMap.get(`${row.event_type}__${channel}`);
        const enabled = providerMode === "demo" ? (setting?.enabled_demo ?? true) : (setting?.enabled_live ?? false);
        if (!enabled) {
          return {
            channel,
            ok: true,
            provider: "disabled-by-config",
            detail: "skipped",
          } satisfies ChannelResult;
        }
        const forceFail = failChannels.has(channel);
        const randomFail = failRate > 0 && Math.random() < failRate;
        if (forceFail || randomFail) {
          return {
            channel,
            ok: false,
            provider: "demo",
            detail: "simulated-failure",
          } satisfies ChannelResult;
        }
        const template = templateMap.get(`${row.event_type}__${channel}`) ?? null;
        if (channel === "in_app") return deliverInAppAdapter({ providerMode, template, context: templateContext });
        if (channel === "email") return deliverEmailAdapter({ providerMode, template, context: templateContext });
        if (channel === "sms") return deliverSmsAdapter({ providerMode, template, context: templateContext });
        if (channel === "whatsapp") return deliverWhatsappAdapter({ providerMode, template, context: templateContext });
        return {
          channel,
          ok: true,
          provider: "unknown-channel",
          detail: "skipped",
        } satisfies ChannelResult;
      }),
    );
    const deliveryOk = channelResults.every((r) => r.ok);

    if (deliveryOk) {
      const { error: upErr } = await adminClient
        .from("notification_events")
        .update({
          status: "sent",
          attempt_count: attempt,
          processed_at: new Date().toISOString(),
          last_error: null,
          payload: {
            ...(row.payload ?? {}),
            demo_mode: true,
            provider_mode: providerMode,
            delivery: {
              delivered_channels: channelResults.filter((r) => r.ok).map((r) => r.channel),
              channel_results: channelResults,
              delivered_at: new Date().toISOString(),
              provider: providerMode,
            },
          },
        })
        .eq("id", row.id);
      if (upErr) {
        failed += 1;
      } else {
        sent += 1;
      }
      continue;
    }

    const retryAt = new Date(Date.now() + backoffMinutes(attempt) * 60_000).toISOString();
    const isTerminal = attempt >= 5;
    const { error: failErr } = await adminClient
      .from("notification_events")
      .update({
        status: isTerminal ? "failed" : "queued",
        attempt_count: attempt,
        next_attempt_at: retryAt,
        processed_at: isTerminal ? new Date().toISOString() : null,
        last_error: "Demo delivery failed",
      })
      .eq("id", row.id);
    if (failErr) {
      failed += 1;
    } else {
      failed += 1;
    }
  }

  return json({
    ok: true,
    demo_mode: true,
    processed: events.length,
    sent,
    failed,
    queued: events.length - sent - failed,
  });
});
