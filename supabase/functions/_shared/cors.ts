/// <reference path="../supabase-edge.d.ts" />

/**
 * Shared CORS for edge functions (SECURITY_REVIEW L2).
 *
 * These endpoints are token-authenticated and set no cookies, so `*` is low-risk — but we
 * still support pinning to an allowlist via the `CORS_ALLOWED_ORIGINS` secret (comma-separated
 * origins). When set, we reflect the caller's `Origin` if it's on the list (falling back to the
 * first entry); when unset, we preserve the previous permissive `*` so nothing breaks.
 *
 * Native mobile callers send no `Origin` and are unaffected by CORS either way.
 */
// Superset across all functions (cron/push senders add their dispatch-secret headers). Extra
// entries are harmless for functions that don't use them; browser preflight only.
const ALLOW_HEADERS =
  "authorization, x-client-info, apikey, content-type, x-cron-dispatch-secret, x-push-dispatch-secret";
const ALLOW_METHODS = "POST, OPTIONS";

function allowlist(): string[] {
  // Accept comma- and newline-separated entries. A multiline secret must never become a single
  // Access-Control-Allow-Origin value (newlines are illegal in HTTP headers → OPTIONS 500).
  return (Deno.env.get("CORS_ALLOWED_ORIGINS") ?? "")
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((s) => Boolean(s) && !/[\r\n]/.test(s));
}

export function corsHeaders(req: Request): Record<string, string> {
  const list = allowlist();
  const origin = req.headers.get("Origin") ?? "";
  const isLoopback =
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin) ||
    /^https?:\/\/\[::1\](:\d+)?$/i.test(origin);
  // When an allowlist is set, still reflect local Vite origins so admin/vendor portals
  // work on localhost (token-authenticated endpoints; production browsers never send these Origins).
  const allowOrigin =
    list.length === 0
      ? "*"
      : list.includes(origin)
        ? origin
        : isLoopback
          ? origin
          : list[0]!;

  const headers: Record<string, string> = {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": ALLOW_HEADERS,
    "Access-Control-Allow-Methods": ALLOW_METHODS,
  };
  if (list.length > 0 || isLoopback) headers["Vary"] = "Origin";
  return headers;
}
