/// <reference path="../supabase-edge.d.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

import { corsHeaders as resolveCors } from "../_shared/cors.ts";
import {
  enforceEdgeRateLimit,
  subjectDispatch,
  subjectIp,
} from "../_shared/rate-limit.ts";

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

  if (!isAuthorized(req)) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) {
    return json({ ok: false, error: "Missing Supabase env" }, 500);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const rateLimited = await enforceEdgeRateLimit({
    admin: supabase,
    req,
    functionName: "scan-vendor-response-overdue",
    subject: `${subjectDispatch()}|${subjectIp(req)}`,
    cors,
  });
  if (rateLimited) return rateLimited;

  let limit = 200;
  try {
    const body = await req.json().catch(() => ({}));
    if (typeof body?.limit === "number" && Number.isFinite(body.limit)) {
      limit = Math.min(Math.max(Math.round(body.limit), 1), 500);
    }
  } catch {
    /* empty body ok */
  }

  const { data, error } = await supabase.rpc("notify_overdue_vendor_responses_batch", {
    p_limit: limit,
  });

  if (error) {
    return json({ ok: false, error: error.message }, 500);
  }

  return json({ ok: true, result: data });
});
