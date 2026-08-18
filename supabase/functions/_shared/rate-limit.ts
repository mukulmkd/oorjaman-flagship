/// <reference path="../supabase-edge.d.ts" />

/**
 * Shared rate limiting for Edge Functions.
 *
 * Uses public.consume_edge_rate_limit (service_role) so limits are durable across
 * Deno isolates. Fail-open if the RPC is unavailable (migration not yet pushed) so
 * UAT/local don't hard-break before db:push — but log via response note isn't possible;
 * callers should still deploy the migration with the functions.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export type RateLimitProfile = {
  /** Max requests allowed in the window. */
  max: number;
  /** Window length in seconds. */
  windowSeconds: number;
};

/** Sensible defaults per function class. Override via env when needed. */
export const RATE_LIMIT_PROFILES = {
  /** Customer self-delete — very strict. */
  "delete-customer-account": { max: 5, windowSeconds: 3600 } satisfies RateLimitProfile,
  /** Admin vendor intake approval. */
  "approve-vendor-intake": { max: 60, windowSeconds: 60 } satisfies RateLimitProfile,
  /** Cron / push dispatchers — higher, still capped if secret leaks. */
  "send-customer-expo-push": { max: 120, windowSeconds: 60 } satisfies RateLimitProfile,
  "send-technician-expo-push": { max: 120, windowSeconds: 60 } satisfies RateLimitProfile,
  "scan-vendor-response-overdue": { max: 30, windowSeconds: 60 } satisfies RateLimitProfile,
  "process-notification-events": { max: 60, windowSeconds: 60 } satisfies RateLimitProfile,
} as const;

export type EdgeFunctionName = keyof typeof RATE_LIMIT_PROFILES;

export function clientIp(req: Request): string {
  const cf = req.headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real;
  const xff = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (xff) return xff;
  return "unknown";
}

function profileFor(functionName: EdgeFunctionName): RateLimitProfile {
  const base = RATE_LIMIT_PROFILES[functionName];
  const maxEnv = Deno.env.get(`RATE_LIMIT_${functionName.replace(/-/g, "_").toUpperCase()}_MAX`);
  const winEnv = Deno.env.get(
    `RATE_LIMIT_${functionName.replace(/-/g, "_").toUpperCase()}_WINDOW_SECONDS`,
  );
  const max = maxEnv ? Math.max(1, Math.round(Number(maxEnv))) : base.max;
  const windowSeconds = winEnv
    ? Math.max(1, Math.round(Number(winEnv)))
    : base.windowSeconds;
  return {
    max: Number.isFinite(max) ? max : base.max,
    windowSeconds: Number.isFinite(windowSeconds) ? windowSeconds : base.windowSeconds,
  };
}

type ConsumeResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retry_after_seconds: number;
  window_seconds: number;
};

/**
 * Enforce rate limit. Returns a 429 Response when blocked, or null when allowed.
 * `subject` should identify the caller (e.g. `user:<uuid>`, `ip:<addr>`, `dispatch`).
 */
export async function enforceEdgeRateLimit(options: {
  admin: SupabaseClient;
  req: Request;
  functionName: EdgeFunctionName;
  subject: string;
  cors: Record<string, string>;
}): Promise<Response | null> {
  const { admin, functionName, subject, cors } = options;
  const profile = profileFor(functionName);
  const bucketKey = `edge:${functionName}:${subject}`;

  try {
    const { data, error } = await admin.rpc("consume_edge_rate_limit", {
      p_bucket_key: bucketKey,
      p_max_requests: profile.max,
      p_window_seconds: profile.windowSeconds,
    });

    if (error) {
      // Fail open if migration not applied yet — do not brick UAT mid-deploy.
      console.error("rate_limit_rpc_error", error.message);
      return null;
    }

    const result = (data ?? {}) as ConsumeResult;
    if (result.allowed !== false) {
      return null;
    }

    const retryAfter = Math.max(1, Number(result.retry_after_seconds) || profile.windowSeconds);
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Too many requests. Please try again later.",
        retry_after_seconds: retryAfter,
      }),
      {
        status: 429,
        headers: {
          ...cors,
          "Content-Type": "application/json",
          "Retry-After": String(retryAfter),
          "X-RateLimit-Limit": String(result.limit ?? profile.max),
          "X-RateLimit-Remaining": "0",
        },
      },
    );
  } catch (e) {
    console.error("rate_limit_exception", e instanceof Error ? e.message : String(e));
    return null;
  }
}

/** Convenience subject builders. */
export function subjectUser(userId: string): string {
  return `user:${userId}`;
}

export function subjectIp(req: Request): string {
  return `ip:${clientIp(req)}`;
}

export function subjectDispatch(): string {
  return "dispatch";
}

export function subjectUserAndIp(userId: string, req: Request): string {
  return `user:${userId}|ip:${clientIp(req)}`;
}
