# Rate limiting & Auth attack protection

How OorjaMan limits abuse across Auth, Edge Functions, and (optionally) Vercel.

**Related:** [PROD_CHECKLIST.md](../PROD_CHECKLIST.md) §4–§5 · [SECURITY-VERCEL.md](SECURITY-VERCEL.md)

---

## What the repo implements

### Edge Functions (code + migration)

- Migration: `supabase/migrations/20260813120000_edge_function_rate_limits.sql`
  - Table `public.edge_rate_limit_buckets` (service_role only)
  - RPC `public.consume_edge_rate_limit(bucket, max, window_seconds)` → `{ allowed, remaining, retry_after_seconds, … }`
- Shared helper: `supabase/functions/_shared/rate-limit.ts`
- Wired into all six functions. Over limit → **HTTP 429** + `Retry-After`.

| Function | Default limit | Subject |
|---|---|---|
| `delete-customer-account` | 5 / hour | user + IP |
| `approve-vendor-intake` | 60 / min | admin user + IP |
| `process-notification-events` | 60 / min | admin user + IP |
| `send-customer-expo-push` | 120 / min | dispatch + IP |
| `send-technician-expo-push` | 120 / min | dispatch + IP |
| `scan-vendor-response-overdue` | 30 / min | dispatch + IP |

Override without code change (Edge secrets), e.g.:

- `RATE_LIMIT_DELETE_CUSTOMER_ACCOUNT_MAX=3`
- `RATE_LIMIT_DELETE_CUSTOMER_ACCOUNT_WINDOW_SECONDS=3600`

If the migration is not applied yet, the helper **fails open** (logs `rate_limit_rpc_error`) so deploys don’t brick UAT. **Always `db:push` before or with function deploy.**

### Auth (dashboard — not fully controllable from repo)

`supabase/config.toml` `[auth.rate_limit]` applies mainly to **local** `supabase start`. Hosted UAT/PROD limits are managed in the dashboard (see below).

---

## Your actions (UAT → PROD)

### A. Apply DB + redeploy functions

```bash
# UAT first
npm run db:push          # includes 20260813120000_edge_function_rate_limits
npm run functions:deploy -- delete-customer-account
npm run functions:deploy -- approve-vendor-intake
npm run functions:deploy -- process-notification-events
npm run functions:deploy -- send-customer-expo-push
npm run functions:deploy -- send-technician-expo-push
npm run functions:deploy -- scan-vendor-response-overdue
```

Repeat against PROD when ready (same order).

Smoke: call a function repeatedly past the limit → expect `429` JSON `{ "ok": false, "error": "Too many requests..." }`.

### B. Supabase Auth dashboard (hosted UAT / PROD)

Supabase splits these — they are **different** menu items under **Authentication**:

| Dashboard section | What to do now |
|---|---|
| **Authentication → Rate Limits** | Review / tighten OTP send & verify, sign-ins, token refresh. Do this on UAT and again on PROD. |
| **Authentication → Attack Protection** (Bot and Abuse / CAPTCHA) | **CAPTCHA: leave OFF** while dummy OTP/auth is in use on UAT/local. Enabling CAPTCHA without apps sending `captchaToken` will break login. Enable only at prod cutover after real SMS + app wiring (see PROD_CHECKLIST §5 CAPTCHA). |

`supabase/config.toml` `[auth.rate_limit]` mainly affects local `supabase start`; hosted projects use the **Rate Limits** UI above.

**Applied via Management API (2026-09-09) on PROD + UAT:**

| Key | Value |
|---|---|
| `rate_limit_email_sent` | 30 / hour |
| `rate_limit_otp` | 20 / hour |
| `rate_limit_verify` | 15 / 5 min (IP) |
| `rate_limit_token_refresh` | 150 / 5 min |
| `rate_limit_sms_sent` | 20 / hour |
| `rate_limit_anonymous_users` | 1 / hour |
| `rate_limit_web3` | 5 / 5 min |
| Anonymous sign-ins | OFF |
| CAPTCHA | OFF (until apps send `captchaToken`) |
| `security_sb_forwarded_for_enabled` | ON (already) |

### C. Vercel Firewall (recommended, portals + marketing)

On Pro+: Team → Firewall — rate-limit anonymous traffic to login/OTP-ish paths and block obvious scanners. See [SECURITY-VERCEL.md](SECURITY-VERCEL.md).

### D. What we are **not** doing in v1 / while dummy auth is on

- Enabling CAPTCHA in the dashboard on UAT
- Per-row PostgREST rate limits (rely on RLS + Auth Rate Limits + Edge limits)
- CAPTCHA UI in mobile OTP (follow-up when Turnstile keys + real OTP exist)

---

## Verify Edge rate-limit RPC (SQL editor)

1. Open the **UAT** project → **SQL Editor** → New query.
2. Confirm the migration is applied (`npm run db:push` already done). If the function is missing you’ll get `function public.consume_edge_rate_limit(...) does not exist`.
3. Paste and **Run** this as one script (uses a unique smoke key so you don’t collide with real traffic):

```sql
-- Expect: allowed=true, remaining=1
select public.consume_edge_rate_limit('edge:test:smoke', 2, 60) as call_1;

-- Expect: allowed=true, remaining=0
select public.consume_edge_rate_limit('edge:test:smoke', 2, 60) as call_2;

-- Expect: allowed=false, retry_after_seconds >= 1
select public.consume_edge_rate_limit('edge:test:smoke', 2, 60) as call_3;
```

4. Read the JSON in each result row:
   - `call_1` / `call_2`: `"allowed": true`
   - `call_3`: `"allowed": false` and a positive `retry_after_seconds`

Optional cleanup (not required):

```sql
delete from public.edge_rate_limit_buckets where bucket_key = 'edge:test:smoke';
```

Note: the SQL Editor runs with elevated DB privileges, so this works even though the RPC is revoked from `anon` / `authenticated` (Edge Functions call it with the **service_role** key).