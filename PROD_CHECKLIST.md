# OorjaMan — Production Launch Checklist (single source of truth)

The **one** place to track everything required to take OorjaMan live. This file owns the **checklist, order, and status**. It does **not** duplicate step-by-step procedures — those stay in the deep runbooks under `project-docs/` and `docs/`, linked inline. When a task's status changes, update it **here**; when you need the "how", follow the linked doc.

**Last updated:** 2026-08-09
**Legend:** `[ ]` todo · `[~]` in progress / partial · `[x]` done

> **Golden rule (never break):** every DB/RLS/function change is a **new** migration, applied **UAT first → validate → PROD**. Never edit an applied migration; never hand-edit prod SQL in the dashboard. (`project-docs/SUPABASE-UAT-PROD.md`)

---

## 0. Status at a glance

| Area | Status | Note |
|---|---|---|
| Security remediation (code/RLS) | `[x]` | All findings fixed in repo — [SECURITY_REVIEW.md](SECURITY_REVIEW.md). Deploy/verify to prod pending (§3–§4). |
| UAT ↔ PROD RLS parity | `[x]` | `npm run db:policy-diff` = 0 diff (175=175), 2026-08-08. |
| Prod Supabase project | `[ ]` | Not created — UAT (`caearbriteguqjvnbrcg`) currently doubles as prod. Decide §1. |
| Prod env values | `[~]` | Placeholders present; real values pending prod project (§2). |
| Edge functions on prod | `[ ]` | Not deployed to a prod project (§4). |
| Auth / OTP / email templates | `[ ]` | Real SMS/OTP + prod email templates pending (§5). |
| Email addresses & provider | `[~]` | Public mailboxes live; prod decisions pending (§6). |
| Marketing site (oorjaman.com) | `[ ]` | Built for UAT on Vercel; prod host + SEO-on pending (§7). |
| Portal hosting (admin/vendor/support) | `[ ]` | On Vercel UAT; prod-domain decision + security headers pending (§8). |
| Mobile release prep | `[ ]` | EAS creds/secrets, Google Maps key, push per-project pending (§9). |
| App store enrollment | `[~]` | Apple + Google verification in progress (§10). |
| Legal / GSTIN / Razorpay | `[~]` | Drafts live; counsel + KYC pending (§11). |

---

## 1. Prod database topology  ⚠️ blocks most of the rest

Runbook: `project-docs/SUPABASE-UAT-PROD.md`

- [ ] Decide **separate PROD Supabase project** (recommended) vs. keep current project as both UAT+prod.
  - Separate: create **OorjaMan Prod** (Dashboard → New project); save URL / ref / anon / service_role.
  - Shared (interim): acceptable only for soft launch — dummy data + UAT testing hit the same DB.
- [ ] Record refs in root `.env.uat.local` (gitignored): `SUPABASE_UAT_PROJECT_REF`, `SUPABASE_PROD_PROJECT_REF`.

---

## 2. Production env values (`.env.production.local`, gitignored)

Runbook: `project-docs/ENVIRONMENT.md`, `project-docs/DEPLOYMENT.md`. Prefer **EAS Secrets** for mobile store builds.

Supabase-backed apps — swap `YOUR_PROD_PROJECT_REF` + `your_prod_anon_key` (**anon only**, never service_role):

- [ ] `apps/customer-app/.env.production.local`
- [ ] `apps/technician-app/.env.production.local`
- [ ] `apps/admin-web/.env.production.local`
- [ ] `apps/vendor-web/.env.production.local`
- [ ] `apps/support-web/.env.production.local`

Marketing (`apps/oorjaman-web/.env.production.local`, no Supabase):

- [ ] `NEXT_PUBLIC_SITE_URL=https://oorjaman.com`, `NEXT_PUBLIC_VENDOR_PORTAL_URL=https://vendor.oorjaman.com`
- [ ] Confirm real `NEXT_PUBLIC_COMPANY_GSTIN` (currently `18AAKFO2664E1Z5`)
- [ ] Store URLs when live: `NEXT_PUBLIC_APP_STORE_URL`, `NEXT_PUBLIC_PLAY_STORE_URL`; optional `NEXT_PUBLIC_GA_ID`

---

## 3. Apply migrations to PROD

Runbook: `project-docs/SUPABASE-UAT-PROD.md`

- [ ] Link PROD → `npm run db:push:yes` (incl. security batch `20260808120000`→`124000`)
- [ ] Brand-new prod project? Bootstrap base schema first (core tables predate migration history).
- [ ] `npx supabase migration list` identical on UAT and PROD.
- [ ] RLS drift check: export `supabase/baseline/export-rls-policies.sql` from both → `npm run db:policy-diff` = 0.
- [ ] C1 escalation test: signed-in dummy customer calls `supabase.auth.updateUser({ data: { role:'admin' } })` → `public.users.role` stays `customer`.

---

## 4. Deploy edge functions to PROD (not covered by `db:push`)

Link PROD, then `npm run functions:deploy -- <name>`:

- [ ] `delete-customer-account` (store-mandatory)
- [ ] `approve-vendor-intake`
- [ ] `scan-vendor-response-overdue`
- [ ] `send-customer-expo-push`
- [ ] `send-technician-expo-push`
- [ ] `process-notification-events`
- [ ] Prod dashboard secrets: `PUSH_DISPATCH_SECRET`, cron dispatch secret, service-role (as used), **`CORS_ALLOWED_ORIGINS`** (SECURITY_REVIEW L2 — pin to real portal origins; unset = `*`).
- [ ] Smoke: throwaway UAT account deletion end-to-end before prod.

---

## 5. Auth, OTP/SMS & email templates (prod project)

Runbook: `project-docs/DEPLOYMENT.md` §Auth, `project-docs/SECURITY-VERCEL.md`, `project-docs/EMAILS.md`

- [ ] Auth → URL config: production redirect URLs (`https://oorjaman.com`, portal subdomains) + Vercel UAT if still used.
- [ ] **Real SMS/OTP provider** configured with prod credentials + rate limits (no dummy).
- [ ] Verify dummy auth OFF in prod (hard-disabled in code by `resolveDummyAuthSettings()` when `DEPLOY_ENV=production` — SECURITY_REVIEW H1 — but confirm env).
- [ ] **Supabase Auth email templates (prod)** — branded, no dummy domain.
- [ ] Do **not** run `npm run seed:dummy-users` against prod.

---

## 6. Email addresses & notification provider

Runbook: `project-docs/EMAILS.md`

- [ ] Decide/create `noreply@`, `billing@`, `partners@` before prod cutover (public `support@/privacy@/legal@/info@` already live).
- [ ] Notification provider From / Reply-To set per environment (UAT vs prod).
- [ ] Align seed script staff emails to `@oorjaman.com` if desired.
- [ ] Store/listing contact emails match this doc.

---

## 7. Marketing site → oorjaman.com (SEO ON)

Runbook: `project-docs/LAUNCH.md`, `project-docs/SEO.md`

- [ ] DNS `A`/`CNAME` for `oorjaman.com` + `www`; HTTPS; `www`→apex redirect.
- [ ] Prod env `NEXT_PUBLIC_DEPLOY_ENV=production` (turns SEO/indexing **on**; UAT/local stay off).
- [ ] Build `npm run build:godaddy -w oorjaman-web` → upload `apps/oorjaman-web/out/` → `public_html`.
- [ ] Smoke: `/`, `/download`, `/pricing`, `/contact`, `/legal/privacy-policy`, `/legal/account-deletion`, `/legal/terms` (+ trailing slash).
- [ ] Google Search Console → property `https://oorjaman.com` → submit `sitemap.xml`.
- [ ] Optional: Bing Webmaster Tools (same sitemap).

---

## 8. Portal hosting — admin / vendor / support (prod)

Runbook: `project-docs/DEPLOYMENT.md`, `project-docs/VERCEL.md`, `project-docs/SECURITY-VERCEL.md`

- [ ] **Decide prod host:** keep on **Vercel with custom domains** (`admin/vendor/support.oorjaman.com`) **or** move to **GoDaddy** 8-host layout.
- [ ] DNS/SSL for the three subdomains; SPA routing (`vercel.json` rewrites on Vercel, or `.htaccess` on GoDaddy).
- [ ] Rebuild with prod `VITE_*` (prod Supabase URL + anon; `VITE_*_PORTAL_URL` → real subdomains; **no** dummy-auth vars).
- [ ] **Host security headers** present in prod (the `vercel.json` header set, or GoDaddy `.htaccess` equivalent) — SECURITY-VERCEL.md.
- [ ] Optional: Vercel Deployment Protection if any portal should not be public.

---

## 9. Mobile release prep (EAS / stores)

Runbook: `project-docs/DEPLOYMENT.md` §Mobile + §Google Maps, `docs/customer-push-setup.md`, `docs/technician-push-setup.md`

- [ ] **EAS setup:** `eas init` (both apps) → `EXPO_PUBLIC_EAS_PROJECT_ID`; `eas credentials` (APNs + FCM) for **prod** bundle IDs `com.oorjaman.customer` / `com.oorjaman.technician`.
- [ ] **EAS production secrets:** `EXPO_PUBLIC_SUPABASE_URL` (prod), `EXPO_PUBLIC_SUPABASE_ANON_KEY` (prod), `EXPO_PUBLIC_SITE_URL=https://oorjaman.com`, `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`, `EXPO_PUBLIC_EAS_PROJECT_ID`. **No** dummy-auth vars.
- [ ] **Google Maps key:** GCP project → **enable billing** → enable Maps SDK iOS/Android + Static API → create key → restrict to prod bundle IDs (+ Android release **SHA-1**) → store as EAS secret → **native rebuild** (not OTA).
- [ ] **Push per Supabase project:** deploy push functions (see §4) **and** set Postgres `app.*_push_function_url` settings + `PUSH_DISPATCH_SECRET` on the **prod** project; register FCM/APNs creds for prod bundle IDs.
- [ ] Prod builds: `eas build --profile production --platform all` (both apps) → `eas submit`.

---

## 10. App stores

Runbook: `project-docs/LAUNCH.md`, `project-docs/SEO.md`, `docs/ios-qa-distribution.md`

- [ ] Apple Developer Program verified (org + D-U-N-S).
- [ ] Google Play Console org identity verified.
- [ ] Listings: Privacy, Terms, **Account deletion** URLs → oorjaman.com paths; support email `support@oorjaman.com`.
- [ ] After listings live: set `NEXT_PUBLIC_APP_STORE_URL` / `NEXT_PUBLIC_PLAY_STORE_URL` on marketing + redeploy `/download`.

---

## 11. Legal, company & payments

- [ ] Counsel review of all `/legal/*` (drafts, lastUpdated 2026-08-08).
- [ ] Confirm entity **OORJA MAN LLP**, GSTIN, registered office address across About / Contact / legal.
- [ ] Razorpay KYC complete (Power of Attorney for LLP) + live keys as secrets (never in client bundle).

---

## 12. Deferred / follow-up hardening (not launch-blocking)

- [ ] **H3 (DR completeness):** full base-table DDL via `npm run db:baseline` (needs Docker) for one-command DR bootstrap. Security-auditability already closed.
- [ ] **Deps:** 28 remaining `npm audit` items are dev/build-time transitive (`uuid` via Expo tooling); clear on next Expo SDK bump, then re-scan.
- [ ] **CSP tighten:** portal CSP `'unsafe-inline'` → hashes/nonces (SECURITY_REVIEW M4).
- [ ] **Monitoring:** error tracking (Sentry), Supabase log drains/alerts, uptime checks.
- [ ] **Backups:** confirm prod Supabase PITR / retention.

---

## 13. Non-blocking quality backlog (do not gate launch)

Source: `project-docs/TODO.md`

- [ ] **Admin-web duplicate API calls** — 11 open items (query-key unification, promote label lookups to React Query, invalidate/refetch audit). Correctness is fine; this is request-volume optimization.

---

## 14. Go-live gate (final sign-off)

- [ ] §1–§11 all `[x]`.
- [ ] `migration list` identical UAT ↔ PROD; `db:policy-diff` = 0.
- [ ] C1 escalation test passes on PROD.
- [ ] Account-deletion function verified on PROD.
- [ ] Marketing smoke pass on real domain with SEO on.
- [ ] Apps signed, submitted, approved.

---

## Related runbooks (the "how" — keep these)
- [SECURITY_REVIEW.md](SECURITY_REVIEW.md) — findings + remediation status
- `project-docs/SUPABASE-UAT-PROD.md` — two-project workflow, migrations, functions
- `project-docs/DEPLOYMENT.md` — 8-host + mobile/EAS + Google Maps matrix
- `project-docs/LAUNCH.md` · `project-docs/SEO.md` — marketing + store launch
- `project-docs/EMAILS.md` — mailboxes + templates
- `project-docs/VERCEL.md` · `project-docs/SECURITY-VERCEL.md` — portal hosting + prod hardening
- `project-docs/ENVIRONMENT.md` · `project-docs/BILLING.md` — env vars + costs
- `docs/customer-push-setup.md` · `docs/technician-push-setup.md` · `docs/ios-qa-distribution.md` · `docs/android-local-apk.md`
