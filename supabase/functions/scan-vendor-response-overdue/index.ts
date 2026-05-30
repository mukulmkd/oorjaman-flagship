/// <reference path="../supabase-edge.d.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-dispatch-secret, x-push-dispatch-secret",
};

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isAuthorized(req: Request): boolean {
  const cronSecret = Deno.env.get("CRON_DISPATCH_SECRET") ?? Deno.env.get("PUSH_DISPATCH_SECRET");
  if (cronSecret) {
    const h =
      req.headers.get("x-cron-dispatch-secret") ?? req.headers.get("x-push-dispatch-secret");
    if (h === cronSecret) return true;
  }

  const authHeader = req.headers.get("Authorization");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (authHeader?.startsWith("Bearer ") && serviceKey && authHeader === `Bearer ${serviceKey}`) {
    return true;
  }
  return false;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  if (!isAuthorized(req)) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) {
    return json({ ok: false, error: "Missing Supabase env" }, 500);
  }

  let limit = 200;
  try {
    const body = await req.json().catch(() => ({}));
    if (typeof body?.limit === "number" && Number.isFinite(body.limit)) {
      limit = Math.min(Math.max(Math.round(body.limit), 1), 500);
    }
  } catch {
    /* empty body ok */
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.rpc("notify_overdue_vendor_responses_batch", {
    p_limit: limit,
  });

  if (error) {
    return json({ ok: false, error: error.message }, 500);
  }

  return json({ ok: true, result: data });
});
