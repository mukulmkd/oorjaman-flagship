# Security Review — OorjaMan Platform

**Status:** Remediation complete for all code/RLS findings (2026-08-08). **Fixed:** C1, H1, H2, M1, M2, M3, M4, L1, L2, L3, L4, L5 + deps (`audit fix`, 34→28). **H3** = RLS baseline captured (`supabase/baseline/prod_baseline_2026-08-08_policies.sql`, 176 policies incl. base owners); optional full-table DDL via `npm run db:baseline` (Docker). Reproducibility/DR only — not an active vuln. Migrations land on `db:push` (UAT → prod); apps take effect on rebuild.
**Date:** 2026-08-08

> **Dummy auth is intentionally retained for local + UAT** and force-disabled in production (see H1 fix). Fixes are landed as migrations/code but only take effect after `npm run db:push` (UAT → prod) and app rebuilds.
**Scope:** customer-app, technician-app, admin-web, vendor-web, support-web, oorjaman-web (marketing), `packages/api`, all Supabase edge functions, Supabase RLS (109 migrations + generated snapshots), dependency scan.

> This is a point-in-time review. Line numbers reference the state of the repo on the date above and may drift as code changes. Re-verify before fixing.

---

## Executive summary

Overall the platform has **strong security fundamentals**:

- No secrets committed to git; `.gitignore` correctly excludes all `.env*` (only `*.example` tracked).
- Frontend Supabase client uses the **anon key only** — no `service_role` in any client bundle.
- All 6 edge functions verify the caller JWT server-side (`auth.getUser`) and re-check privileged roles against `public.users` (not client metadata).
- RLS helper functions (`is_admin`, `is_approved_vendor_user`, `my_customer_id`, …) are `SECURITY DEFINER` and derive authority from server-side tables.
- No hardcoded live credentials, backdoor accounts, or secret/OTP logging in app code.

**However, there is one CRITICAL launch-blocker (C1)** that defeats the entire RLS model, plus one HIGH auth-integrity gap (H1). These must be fixed before any public launch.

### Priority order for fixing
1. **C1** — role privilege escalation via user metadata (Critical).
2. **H1** — dummy-auth OTP bypass has no production guard (High).
3. **H2** — `job-photos` storage bucket is public (High).
4. **H3** — core-table RLS not captured in tracked migrations (High, reproducibility/DR).
5. **M1–M4**, then **Low/hygiene**, then **dependencies**.

---

## 🔴 CRITICAL

### C1 — Privilege escalation: any authenticated user can self-promote to `admin`

> **✅ FIXED (2026-08-08)** — `supabase/migrations/20260808120000_harden_user_role_sync.sql`. Role is no longer sourced from metadata on UPDATE (`role = public.users.role` preserved), and a new `auth_user_signup_role_from_metadata()` strips `admin`/`support` so they can never arrive via metadata. Self-service signup roles (`customer`/`technician`/`vendor`) are honored only on the initial INSERT. Requires `db:push` to take effect.

**What:** UI/route guards and RLS both read the role from `public.users.role` (correct pattern). But that column is (re)populated from the **client-controllable** `auth.users.raw_user_meta_data->>'role'` on every auth update, through a `SECURITY DEFINER` path that any authenticated user can trigger.

**Evidence:**

- Role is read straight from user metadata:

```62:76:supabase/migrations/20260723120000_auth_user_verification_sync.sql
create or replace function public.auth_user_role_from_metadata(au auth.users)
...
  raw := nullif(trim(coalesce(au.raw_user_meta_data->>'role', '')), '');
  if raw is null then return null; end if;
  return public.coerce_user_role(raw);
```

- `coerce_user_role` maps the raw string to any role including `admin`/`support` (`supabase/migrations/20260726120000_support_desk_phase3_and_support_role.sql:11-18`).

- The sync overwrites `public.users.role` from metadata on conflict (latest version):

```56:63:supabase/migrations/20260742000000_auth_sync_preserve_display_email.sql
  on conflict (id) do update set
    ...
    role = coalesce(v_role, public.users.role),
```

- Triggered on every `auth.users` UPDATE, and exposed to all authenticated users via RPC:

```172:175:supabase/migrations/20260723120000_auth_user_verification_sync.sql
create trigger on_auth_user_updated
after update on auth.users
for each row execute function public.handle_auth_user_updated();
```

```214:215:supabase/migrations/20260723120000_auth_user_verification_sync.sql
revoke all on function public.sync_my_user_from_auth() from public;
grant execute on function public.sync_my_user_from_auth() to authenticated;
```

**Attack:** A signed-in customer (anon key only) calls the standard client API:

```ts
await supabase.auth.updateUser({ data: { role: "admin" } });
```

`user_metadata` (`raw_user_meta_data`) is user-writable. The `on_auth_user_updated` trigger fires → `apply_auth_user_to_public_users` sets `public.users.role = 'admin'` → `is_admin()` returns true → full read/write to every table (customers, payments, subscriptions, vendor bank/PAN/Aadhaar, etc.) and all admin-gated actions.

**Impact:** Complete compromise of the RLS authorization model. Any user can read/modify all PII and financial data and perform admin operations.

**Fix (proposed):**
- Never source `role` from `raw_user_meta_data` on UPDATE. On conflict, preserve the existing DB role (`role = public.users.role`).
- On initial INSERT, only allow non-privileged self-service roles (e.g. `customer`, and `technician` only if that's the intended signup path); never accept `admin`/`support`/`vendor` from metadata.
- Assign privileged roles exclusively via server-side/service-role flows (as `supabase/functions/approve-vendor-intake/index.ts` already does for vendors).
- Deliver as a new migration; then verify against prod `pg_policies` / a manual escalation test.

---

## 🟠 HIGH

### H1 — Dummy-auth (OTP bypass) can ship to production; no code guard; default secrets in bundle

> **✅ FIXED (2026-08-08)** — `packages/api/src/env.ts`. `resolveDummyAuthSettings()` now AND-gates the flag with `isProductionDeploy()` (`EXPO_PUBLIC_DEPLOY_ENV` / `VITE_DEPLOY_ENV` === `production`), so dummy auth is **impossible in production** yet fully retained for local + UAT. The baked-in default OTP/password (L4) are intentionally kept for local/UAT convenience — they are now unreachable in production because `enabled` is false there.

**What:** `resolveDummyAuthSettings` enables the OTP-bypass purely from an env flag and never consults deploy tier. Default OTP `123456` and password `TestOtp123!` are compiled into the shipped bundle.

**Evidence:**

```75:90:packages/api/src/env.ts
export function resolveDummyAuthSettings(
  frameworkEnv?: Record<string, string | boolean | undefined>,
): DummyAuthSettings {
  const enabled =
    expoPublicEnv("EXPO_PUBLIC_USE_DUMMY_AUTH") === "true" ||
    String(frameworkEnv?.VITE_USE_DUMMY_AUTH ?? "") === "true";
  const otpCode = (
    expoPublicEnv("EXPO_PUBLIC_DUMMY_OTP_CODE") ??
    String(frameworkEnv?.VITE_DUMMY_OTP_CODE ?? "123456")
  ).trim();
  const password = (
    expoPublicEnv("EXPO_PUBLIC_DUMMY_AUTH_PASSWORD") ??
    String(frameworkEnv?.VITE_DUMMY_AUTH_PASSWORD ?? "TestOtp123!")
  ).trim();
  return { enabled, otpCode, password };
}
```

Bypass path: `packages/api/src/auth/auth-api.ts:87-96`. A `parseDeployEnvironment()` helper exists (`packages/config/src/deploy-env.ts`) but is never used here. Enforcement today is documentation-only (`project-docs/SECURITY-VERCEL.md`, `project-docs/ENVIRONMENT.md`).

**Impact:** A single misconfigured env var in Vercel/EAS silently disables authentication integrity in production. Combined with C1, a public UAT with dummy auth enabled = trivial admin takeover.

**Fix (proposed):** Force `enabled = false` when `parseDeployEnvironment() === "production"`; remove the hardcoded default OTP/password fallbacks (require explicit env).

### H2 — `job-photos` storage bucket is PUBLIC with unrestricted read

> **✅ FIXED (2026-08-08)** — `supabase/migrations/20260808120500_job_photos_private_bucket.sql` makes the bucket private and replaces the open read policy with `job_photos_scoped_read` (admin, or the booking's assigned technician / customer / vendor). App now stores storage **paths** and displays via short-lived signed URLs (`createSignedJobEvidenceUrl` / `…UrlMap` in `packages/api`, consumed by the technician execute screen). Legacy public-URL rows are handled transparently by `jobEvidenceStoragePath`. Requires `db:push`; re-seed local/UAT job evidence.

**What:** Before/after site photos and the start-of-visit selfie (customer rooftops/premises) are stored in a public bucket, read-granted to `public`.

**Evidence:**

```5:24:supabase/migrations/20260744200000_job_photos_storage_bucket.sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'job-photos',
  'job-photos',
  true,
  ...
create policy job_photos_public_read
on storage.objects for select
using (bucket_id = 'job-photos');
```

Confidentiality relies solely on the object path containing a `booking_id` UUID (security-by-obscurity). Any URL leak (support tickets, logs, referrer headers) exposes customer premises photos permanently. Insert is correctly restricted to the assigned technician/admin.

**Fix (proposed):** Make the bucket private and serve via signed URLs, or scope the SELECT policy to the booking's customer/technician/vendor/admin.

### H3 — Core-table RLS not captured in tracked migrations (reproducibility / DR gap)

**What:** The generated `supabase/schema.sql` and `supabase/policies.sql` do not contain the base owner-scoped RLS policies for the seven most sensitive tables: `users`, `customers`, `vendors`, `technicians`, `subscriptions`, `bookings`, `job_reports`. Snapshots begin with `ALTER` on already-existing objects; `policies.sql` drops base `users` policies but never recreates them.

**Evidence:** `supabase/schema.sql:13-32`, `supabase/policies.sql:138-140`. Repo-wide search finds no `CREATE POLICY users_select_self_or_admin`, `bookings_insert_own`, `customers_insert_own`, etc.

**Impact:** The live apps work, so prod has these policies — but a fresh `db push` may not reproduce prod RLS, and owner-scoping on all PII/money tables is un-auditable and prone to drift.

**Fix (proposed):** Capture base tables + their owner-scoped RLS in a migration; diff against prod `pg_policies` to confirm parity.

> **⏳ TOOLING READY — one command to capture (operator run, 2026-08-08).** Confirmed the base tables (`public.users/customers/vendors/technicians/subscriptions/bookings/job_reports`) and their owner-scoped policies exist in **no** tracked migration (and `supabase/policies-base.sql` only *drops* the base `users` policies without recreating them) — the initial baseline was applied out-of-band. **Do not hand-reconstruct these policies:** if the guessed version differs from prod, a `db:push` would silently alter prod's security posture. Capture from the live DB instead — a turnkey script now exists:
>
> ```bash
> npm run db:baseline                       # dumps linked project schema+policies → supabase/baseline/prod_baseline_<date>.sql
> # or non-interactively:
> SUPABASE_DB_PASSWORD='<db-password>' npm run db:baseline
> ```
>
> The dump is schema-only and includes every `CREATE POLICY` / `ENABLE ROW LEVEL SECURITY`, so it is the authoritative DR baseline (UAT is schema-identical to prod). It is **not auto-applied** — to bootstrap a brand-new environment, apply the baseline first, then `npm run db:push`. Reproducibility/DR only, **not an active vulnerability** — the live apps prove prod already enforces these policies. (Script: `scripts/dump-db-baseline.mjs`.)
>
> **`npm run db:baseline` requires Docker** (the CLI runs `pg_dump` in a container to match the server version) — start Docker Desktop first. **No Docker?** Use the Docker-free RLS-only fallback: run `supabase/baseline/export-rls-policies.sql` in the Supabase SQL editor and export the result — it regenerates every public policy as apply-ready `CREATE POLICY` DDL (covers the security-relevant part of H3; full base-table DDL still needs the `pg_dump` path).

---

## 🟡 MEDIUM

### M1 — `notification_events` insert is wide open (`with check (true)`)

> **✅ FIXED (2026-08-08)** — `supabase/migrations/20260808123000_scope_notification_events_insert.sql`. The open insert policy is replaced with `notification_events_insert_scoped`, gating inserts to: `is_admin()`; a booking participant (new `is_booking_participant()` SECURITY DEFINER helper); an approved vendor emitting an **admin-audience** booking event (covers the reassignment flow, which clears `vendor_id` before emit and never targets another vendor's inbox); or the single customer AMC "awaiting partner" admin ping (`booking_id null`). No app-code changes — every existing real + dummy emit maps to a branch (verified across booking lifecycle, marketplace, AMC, low-rating, renewal nudges). Requires `db:push`; smoke-test notification-producing flows on UAT.

```788:792:supabase/policies.sql
create policy notification_events_insert_authenticated
on public.notification_events for insert to authenticated
with check (true);
```

Any authenticated user can insert arbitrary notification events (spoof/spam, target other vendors). Constrain to the actor's scope or move to a `SECURITY DEFINER` RPC.

### M2 — `platform_settings` readable by every authenticated user (`using (true)`)

> **✅ FIXED (2026-08-08)** — `supabase/migrations/20260808122000_restrict_platform_settings_read.sql`. Direct table SELECT is now admin-only (`platform_settings_select_admin`); non-admin clients read the three booking-routing fields via the `SECURITY DEFINER` RPC `public.get_booking_routing_defaults()` (granted to `authenticated`). The three read sites in `packages/api` (`getVendorPlatformFeePercent`, `getBookingRoutingDefaults`, `fetchCustomerLateCancelFeePaise`) were refactored to the RPC. Requires `db:push` + the app bundle carrying the RPC reads (pre-launch, so no stale clients).

```265:269:supabase/policies.sql
create policy platform_settings_select_authenticated
on public.platform_settings for select to authenticated
using (true);
```

Exposes operational config (fee %, default fallback vendor, fee windows) to all customers/vendors/technicians. Writes are correctly admin-gated. Restrict read to admin or a narrow whitelist.

### M3 — `vendor-intake` storage writable by `anon`, guarded only by draft-status + intake UUID

```684:714:supabase/policies.sql
create policy vendor_intake_insert_draft on storage.objects for insert to anon, authenticated
with check (
    bucket_id = 'vendor-intake'
    and public.vendor_intake_allows_storage_upload (name)
);
```

The helper only checks the path's first segment is a `vendor_registration_intake` id in `draft` status (`supabase/migrations/20260610120000_vendor_registration_intake.sql:326-335`). Someone who guesses a draft UUID could INSERT/overwrite files in another applicant's folder. Read is admin-only. Bind uploads to the intake's edit token rather than existence-of-draft alone.

### M4 — Web session tokens stored in `localStorage` (XSS token theft)

> **✅ MITIGATED (2026-08-08)** — a Content-Security-Policy `<meta>` was added to all three portals (`apps/{admin,vendor,support}-web/index.html`). `connect-src` is pinned to `'self'` + `https://*.supabase.co` + `wss://*.supabase.co`, so an injected script cannot exfiltrate a stolen `localStorage` session to an attacker origin; `object-src 'none'` and `base-uri 'self'` are locked. Inline script/style are still allowed so the Vite/React SPAs render — tighten to hashes/nonces later to also block inline-script injection. (Supabase-js `localStorage` default is unchanged.)

```17:24:packages/api/src/client.ts
export function createSupabaseClient(creds: SupabaseCredentials): SupabaseClient<Database> {
  return createClient<Database>(creds.url, creds.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}
```

All three Vite portals persist Supabase access + refresh tokens in `localStorage` (supabase-js default). Any XSS in these origins exfiltrates the full session. This is Supabase's default behavior; mitigate with a strict Content-Security-Policy and treat XSS impact as elevated for the admin/support/vendor portals.

---

## 🟢 LOW / hygiene

- **L1 — JsonLd `dangerouslySetInnerHTML` with `JSON.stringify`** (`apps/oorjaman-web/components/JsonLd.tsx:5`). Data is developer-authored, but a `</script>` sequence in any field could break out of the script tag. Harden by escaping `<` before injecting.
- **L2 — Edge functions use wildcard CORS (`Access-Control-Allow-Origin: *`).** ✅ **FIXED (2026-08-08)** — a shared `supabase/functions/_shared/cors.ts` now reflects the caller `Origin` only if it's on the `CORS_ALLOWED_ORIGINS` allowlist (comma-separated secret); when unset it preserves the previous `*` so nothing breaks. All 6 functions use request-scoped headers. Set the secret to the portal origins to pin.
- **L3 — Client-only gates are not security boundaries.** ✅ **AUDITED (2026-08-08)** — every vendor-facing policy in `supabase/policies.sql` gates on `public.is_approved_vendor_user()` (which requires `approval_status = 'approved'`) **and** row-scopes with `vendor_id = public.my_vendor_id()` (or `recipient_vendor_id`/booking joins). No policy authorizes a vendor action by `role = 'vendor'` alone — a zero-match search confirms the raw role is never used as an authorization predicate. `RequireApprovedVendor` remains UI-only but is correctly backed by RLS. No change required.
- **L4 — Hardcoded dummy default OTP/password compiled into bundles** (`packages/api/src/env.ts:83,87`). Inert unless dummy auth is enabled (coupled to H1); remove alongside the H1 fix.
- **L5 — Example `.env` files normalize enabling dummy auth on public hosts** (`.env.example`, `apps/admin-web/.env.uat.example`, `project-docs/VERCEL.md`). Combined with C1, a public UAT with dummy auth could be trivially taken over. Consider adding a warning banner or removing `VITE_USE_DUMMY_AUTH=true` from public-UAT docs once C1/H1 are fixed.

---

## 📦 Dependency scan (`npm audit --omit=dev`)

**Totals:** 0 critical, 26 high, 8 moderate (34 total). Most are **build tooling**, not runtime-shipped, and several high-profile CVEs do **not apply** to how OorjaMan ships:

| Package | CVE class | Applicability to us |
|---------|-----------|---------------------|
| `next` | SSRF/DoS in Server Actions, image optimizer SVG DoS, server-function disclosure | **Marketing site is a static export** (`output: export`) — these server-side paths do not run. Bump to latest 15.x anyway. |
| `react-router` / `react-router-dom` | CSRF bypass in **RSC mode** | Portals use SPA `BrowserRouter`, **not RSC** — not affected. Update anyway. |
| Expo / Metro / `@react-native/*` / `sharp` / `postcss` / `image-size` / `js-yaml` / `brace-expansion` / `shell-quote` / `nanoid` | Mostly DoS in dev/build tooling | Low real-world risk; addressed by keeping Expo SDK current. |
| `react-native`, `react-native-reanimated`, `react-native-screens`, `react-native-maps`, `react-native-view-shot` | Transitive via RN | Ships in mobile apps; upgrade via Expo SDK. |

**Recommended actions:** run `npm audit fix`, bump `next` to the latest 15.x patch, and keep the Expo SDK current (recently moved to Expo 56). Re-scan after upgrades.

> **✅ PARTIALLY ADDRESSED (2026-08-08)** — `npm audit fix` (non-breaking) applied: **34 → 28** (cleared 6 highs incl. `shell-quote` quadratic-DoS). `next` is already on the latest 15.x (`^15.5.2`). The remaining **28** (8 moderate, 20 high) are all reachable only via `npm audit fix --force`, which would **downgrade Expo to SDK 53 (breaking)** — declined. They are dev/build-time transitive deps (`uuid` v3/v5/v6 buffer-bounds via `xcode` → `@expo/config-plugins` → `@expo/prebuild-config`/`expo-splash-screen`), not exploitable in shipped runtime paths. Clear them by advancing the Expo SDK when the next release ships the patched `xcode`/`uuid`, then re-scan. `@oorjaman/api` typecheck re-verified green after the fix.

---

## What was reviewed and found OK

- No tracked secrets; `.gitignore` covers all `.env*`.
- No `service_role` / admin keys, JWTs, or private keys in `apps/**` or `packages/**`.
- API client uses the **anon key** only; mobile client disables `detectSessionInUrl` and defers auto-refresh via a session guard.
- All edge functions: JWT verified server-side; admin actions re-check `role === 'admin'` against `public.users`; cron/dispatch functions require a shared secret or the service-role bearer.
- RLS role helpers are `SECURITY DEFINER` reading DB role (not the JWT claim); no policy predicate trusts `user_metadata.role`.
- Private buckets `vendor-documents`, `technician-documents`, `customer-site-photos`, `support-attachments` are owner/desk/participant-scoped.
- `payments`, `subscriptions`, `vendor_settlements`, wallet/credit tables scope reads to owner/admin/related-vendor and gate mutations.
- No secret/OTP/token logging to console in app code.

---

## Remediation checklist (to action later)

- [x] **C1** — migration: stop sourcing `public.users.role` from `raw_user_meta_data` on update; assign privileged roles server-side only. *(20260808120000)*
- [x] **H1** — gate dummy auth off when deploy env is production; kept for local/UAT. *(env.ts; default OTP/password retained intentionally for non-prod)*
- [x] **H2** — make `job-photos` private + signed URLs, scoped SELECT to booking parties. *(20260808120500 + api signing helpers)*
- [x] **H3 (RLS captured)** — `supabase/baseline/prod_baseline_2026-08-08_policies.sql` now version-controls all **176** public-schema policies incl. the previously-untracked base owners (`users_select_self_or_admin`, `bookings_insert_customer`, `customers_insert_self_or_admin`, `subscriptions_insert_customer_or_admin`, `job_reports_insert_technician_or_admin`, `technicians_insert_self_or_admin`, …). Full base-table `CREATE TABLE` DDL still wants a `pg_dump` (`npm run db:baseline`, needs Docker) for a complete DR bootstrap, but the security-auditability gap is closed. Not an active vuln.
  - **Drift found (2026-08-08):** comparing the UAT capture vs a live PROD export surfaced **bidirectional** RLS drift (10 policies) — UAT behind on support-desk (`is_support_agent()`/`participant_audience`/`is_support_desk_user()`), PROD behind on `notification_events_select_scope` (missing the `recipient_audience='vendor'` tightening). Root cause: migrations edited **after** being marked applied, so `db:push` skips them (same class as the earlier `auth_user_email_for_public_sync` miss). Surgical reconcilers generated toward the repo/prod-intended state: `supabase/baseline/reconcile-uat-to-repo.sql` (run on UAT) + `reconcile-prod-to-repo.sql` (run on PROD). **Going forward: never edit an applied migration — add a new one.**
  - **Drift resolved + folded into version control (2026-08-08):** both reconcilers were applied to UAT + PROD; a fresh `db:policy-diff` of the two live exports is now **0 differing policies (175 = 175)**. The manual reconcile is captured as an idempotent re-assert migration `supabase/migrations/20260808124000_reassert_rls_drift_reconcile.sql`, so any environment converges from `db:push` alone (no SQL-editor step). New guardrail: `npm run db:policy-diff` compares two SQL-editor exports (`export-rls-policies.sql`) and exits non-zero on drift — run it after every promotion.
- [x] **M1** — `notification_events` insert scoped to actor (admin / booking participant / approved-vendor admin-audience event / customer AMC ping) via `notification_events_insert_scoped` + `is_booking_participant()`. No app change; RLS-only. *(20260808123000 — smoke-test notification flows on UAT)*
- [x] **M2** — restrict `platform_settings` read: the 3 booking fields now come from `get_booking_routing_defaults()` (SECURITY DEFINER); table SELECT is admin-only. *(20260808122000 + `packages/api` read-site refactor)*
- [x] **M3** — vendor-intake uploads already require the secret **draft edit token** in the path (`{intake_id}/{draft_access_token}/…`) and anon table access is revoked (`20260613120000`). Resolved; original finding referenced the superseded `20260610` helper.
- [x] **M4** — CSP `<meta>` added to all three portals; `connect-src` pinned to `'self'` + Supabase HTTPS/`wss:`, `object-src 'none'`, `base-uri 'self'`. *(inline script/style still allowed — tighten to hashes later)*
- [x] **L1** — escape `<` in `JsonLd` (`apps/oorjaman-web/components/JsonLd.tsx`). Done.
- [x] **L2** — edge-function CORS now uses a shared env-driven allowlist (`_shared/cors.ts`, `CORS_ALLOWED_ORIGINS`); defaults to `*` when unset. *(set the secret to pin)*
- [x] **L3** — audited: all vendor-facing policies gate on `is_approved_vendor_user()` + `vendor_id = my_vendor_id()`; raw `role='vendor'` is never an authorization predicate. No change required.
- [x] **L4** — dummy default OTP/password: now inert in production via the H1 gate; retained intentionally for local/UAT. Resolved.
- [x] **L5** — example env docs: prod example already forbids the dummy flag, UAT keeps it intentionally, and H1 hard-disables it in production. Clarifying note added. Resolved.
- [x] **Deps** — `npm audit fix` applied (34 → 28); Next already latest 15.x. Remaining 28 need a breaking Expo SDK 53 downgrade (declined) — dev/build-time transitive `uuid`; clear via next Expo SDK bump.
