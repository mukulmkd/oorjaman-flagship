# OorjaMan — Production Launch Checklist (single source of truth)

The **one** place to track everything required to take OorjaMan live. This file owns the **checklist, order, and status**. It does **not** duplicate step-by-step procedures — those stay in the deep runbooks under `project-docs/` and `docs/`, linked inline. When a task's status changes, update it **here**; when you need the "how", follow the linked doc.

**Last updated:** 2026-08-22
**Legend:** `[ ]` todo · `[~]` in progress / partial · `[x]` done

> **Golden rule (never break):** every DB/RLS/function change is a **new** migration, applied **UAT first → validate → PROD**. Never edit an applied migration; never hand-edit prod SQL in the dashboard. (`project-docs/SUPABASE-UAT-PROD.md`)

---

## 0. Status at a glance

| Area | Status | Note |
|---|---|---|
| Security remediation (code/RLS) | `[x]` | All findings fixed in repo — [SECURITY_REVIEW.md](SECURITY_REVIEW.md). Deploy/verify to prod pending (§3–§4). |
| UAT ↔ PROD RLS parity | `[x]` | `npm run db:policy-diff` = 0 diff (175=175), 2026-08-08. |
| Prod Supabase project | `[x]` | **OorjaMan PROD** created — ref `nppfpegqnmclbcmmogux`, region `ap-south-1` (Mumbai). |
| Prod env values | `[x]` | Locals updated with Mumbai URL + anon/service_role keys (§2). |
| Edge functions on prod | `[~]` | 6 non-Razorpay functions deployed; Razorpay Live trio still pending (§4). |
| Auth / OTP / email templates | `[ ]` | Real SMS/OTP + prod email templates pending (§5). |
| Email addresses & provider | `[~]` | Public mailboxes live; prod decisions pending (§6). |
| Marketing site (oorjaman.com) | `[ ]` | Built for UAT on Vercel; prod host + SEO-on pending (§7). |
| Portal hosting (admin/vendor/support) | `[ ]` | On Vercel UAT; prod-domain decision + security headers pending (§8). |
| Mobile release prep | `[ ]` | EAS creds/secrets, Maps + Directions keys (prod), push per-project pending (§9). |
| App store enrollment | `[~]` | Apple + Google verification in progress (§10). |
| Legal / GSTIN / Razorpay | `[~]` | UAT Test Mode done; Live KYC + Prod secrets/functions/webhook pending (§11 / §11a). |

---

## 1. Prod database topology  ⚠️ blocks most of the rest

Runbook: `project-docs/SUPABASE-UAT-PROD.md`

- [x] Decide **separate PROD Supabase project** (recommended) vs. keep current project as both UAT+prod.
  - Separate: **OorjaMan PROD** created — ref `nppfpegqnmclbcmmogux`, URL `https://nppfpegqnmclbcmmogux.supabase.co`, region `ap-south-1` (Mumbai). UAT remains `caearbriteguqjvnbrcg` (Singapore).
  - Shared (interim): no longer needed.
- [x] Record refs in root `.env.uat.local` (gitignored): `SUPABASE_UAT_PROJECT_REF`, `SUPABASE_PROD_PROJECT_REF` (+ `SUPABASE_PROD_URL`).

---

## 2. Production env values (`.env.production.local`, gitignored)

Runbook: `project-docs/ENVIRONMENT.md`, `project-docs/DEPLOYMENT.md`. Prefer **EAS Secrets** for mobile store builds.

Supabase-backed apps — Mumbai prod URL `https://nppfpegqnmclbcmmogux.supabase.co` + anon key (**anon only**, never service_role):

- [x] `apps/customer-app/.env.production.local` (Mumbai URL/anon set; **`EXPO_PUBLIC_RAZORPAY_KEY_ID=rzp_live_…`** still placeholder until Live KYC)
- [x] `apps/technician-app/.env.production.local`
- [x] `apps/admin-web/.env.production.local`
- [x] `apps/vendor-web/.env.production.local`
- [x] `apps/support-web/.env.production.local`

Marketing (`apps/oorjaman-web/.env.production.local`, no Supabase):

- [ ] `NEXT_PUBLIC_SITE_URL=https://oorjaman.com`, `NEXT_PUBLIC_VENDOR_PORTAL_URL=https://vendor.oorjaman.com`
- [ ] Confirm real `NEXT_PUBLIC_COMPANY_GSTIN` (currently `18AAKFO2664E1Z5`)
- [ ] Store URLs when live: `NEXT_PUBLIC_APP_STORE_URL`, `NEXT_PUBLIC_PLAY_STORE_URL`; optional `NEXT_PUBLIC_GA_ID`

---

## 3. Apply migrations to PROD

Runbook: `project-docs/SUPABASE-UAT-PROD.md`

- [ ] Link PROD → `npm run db:push:yes` (incl. security batch `20260808120000`→`124000`)
- [ ] Brand-new prod project? Bootstrap base schema first (core tables predate migration history).
- [ ] Confirm Razorpay + postpaid migrations applied on PROD (same as UAT):
  - `20260821200000_razorpay_payments_uat.sql`
  - `20260821210000_razorpay_payment_production.sql` (enum only)
  - `20260821211000_razorpay_payment_production_body.sql`
  - `20260821220000_postpaid_one_time.sql`
- [ ] `npx supabase migration list` identical on UAT and PROD.
- [ ] RLS drift check: export `supabase/baseline/export-rls-policies.sql` from both → `npm run db:policy-diff` = 0.
- [ ] C1 escalation test: signed-in dummy customer calls `supabase.auth.updateUser({ data: { role:'admin' } })` → `public.users.role` stays `customer`.

---

## 4. Deploy edge functions to PROD (not covered by `db:push`)

Link PROD, then `npm run functions:deploy -- <name>`:

- [x] `delete-customer-account` (store-mandatory)
- [x] `approve-vendor-intake`
- [x] `scan-vendor-response-overdue`
- [x] `send-customer-expo-push`
- [x] `send-technician-expo-push`
- [x] `process-notification-events`
- [ ] **Razorpay (Live):** `create-razorpay-order`
- [ ] **Razorpay (Live):** `verify-razorpay-payment`
- [ ] **Razorpay (Live):** `create-razorpay-refund`
- [ ] **Razorpay (Live):** `razorpay-webhook` with **`--no-verify-jwt`** (Razorpay cannot send Supabase JWT)
- [ ] Prod dashboard secrets: `PUSH_DISPATCH_SECRET`, cron dispatch secret, service-role (as used), **`CORS_ALLOWED_ORIGINS`** (SECURITY_REVIEW L2 — pin to real portal origins; unset = `*`).
- [ ] Prod Razorpay Edge secrets (see §11a): `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` (**live** values — never Test keys on Prod).
- [x] **Rate limiting (Edge):** migration `20260813120000_edge_function_rate_limits` applied + all six functions redeployed on UAT and PROD (2026-08-13). Optional: SQL/429 smoke — `project-docs/RATE-LIMITING.md`. Redeploy Razorpay functions after rate-limit shared code if not already included.
- [ ] Smoke: throwaway UAT account deletion end-to-end before prod.

---

## 5. Auth, OTP/SMS & email templates (prod project)

Runbook: `project-docs/DEPLOYMENT.md` §Auth, `project-docs/SECURITY-VERCEL.md`, `project-docs/EMAILS.md`, `project-docs/RATE-LIMITING.md`

- [ ] Auth → URL config: production redirect URLs (`https://oorjaman.com`, portal subdomains) + Vercel UAT if still used.
- [ ] **Real SMS/OTP provider** configured with prod credentials + rate limits (no dummy).
  - **Local/UAT:** `EXPO_PUBLIC_USE_DUMMY_AUTH=true` / `VITE_USE_DUMMY_AUTH=true` → Email + Mobile tabs; both accept dummy OTP **123456** (no SMS/email sent). Seeded users: `npm run seed:dummy-users` (Auth email = display email, e.g. `priya.sharma@oorjaman.in`).
  - **Prod (customer + technician apps, admin / vendor / support portals):** dummy hard-disabled → **Email OTP only** (Resend/custom SMTP); **Mobile OTP Coming soon**.
- [x] **Auth → Rate Limits** reviewed on UAT (defaults kept; IP forwarding Off). Re-check PROD when real SMS OTP goes live — `project-docs/RATE-LIMITING.md` §B.
- [ ] Verify dummy auth OFF in prod (hard-disabled in code by `resolveDummyAuthSettings()` when `DEPLOY_ENV=production` — SECURITY_REVIEW H1 — but confirm env).
- [ ] **Supabase Auth email templates (prod)** — Magic Link template must include `{{ .Token }}` for Email OTP; branded sender via custom SMTP when ready.
- [ ] Do **not** run `npm run seed:dummy-users` against prod.
- [ ] **Portal staff accounts (prod):** create real Auth users with emails for admin / support / vendor; Email OTP must land in those inboxes.

### CAPTCHA — defer until real OTP (do **not** enable while dummy auth is in use)

Leave CAPTCHA **off** on UAT/local while `EXPO_PUBLIC_USE_DUMMY_AUTH` / dummy OTP is active. Enabling it in the dashboard without app `captchaToken` wiring breaks login. Track for prod cutover:

- [ ] Create Cloudflare Turnstile (or hCaptcha) sitekey + secret.
- [ ] Wire `captchaToken` into customer/technician OTP flows (code — ask agent when keys ready).
- [ ] Enable CAPTCHA in prod Auth dashboard **only after** app wiring + real SMS OTP are live.
- [ ] Confirm UAT CAPTCHA stays **off** while dummy auth remains.

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
- [ ] Smoke: `/`, `/download`, `/pricing`, `/contact`, `/legal/`, `/legal/privacy-policy/`, `/legal/terms-of-service/`, `/legal/grievance-redressal/`, `/legal/account-deletion/`, `/legal/refund-cancellation/`, `/legal/app-permissions/`, `/legal/service-disclaimers/`.
- [ ] Google Search Console → property `https://oorjaman.com` → submit `sitemap.xml`.
- [ ] After indexing: search **OorjaMan** (brand query). Separate page hits are normal; sitelinks under the homepage (Razorpay-style) appear only when Google trusts the brand — not configurable in code.
- [ ] Confirm homepage title/description and Organization JSON-LD in Rich Results / URL Inspection when live.

### 7a. Marketing legal / compliance prerequisites (must exist before public launch)

Copy lives in `apps/oorjaman-web/lib/legal-docs.ts`; footer links via `SiteFooter`. Counsel should review before treating as final.

| # | Prerequisite | Status / URL |
|---|---|---|
| 1 | Customer Terms & Conditions | `[x]` `/legal/terms-of-service` (title: Customer Terms & Conditions) |
| 2 | Privacy & Data Protection Policy | `[x]` `/legal/privacy-policy` |
| 3 | DPDP Act/Rules 2025 (collection, consent, storage, processing) | `[x]` Privacy + `/legal/data-processing` (counsel review still advised) |
| 4 | Grievance Officer / complaints | `[x]` `/legal/grievance-redressal` + Contact card — **you must** create mailbox `grievance@oorjaman.com` and set `NEXT_PUBLIC_GRIEVANCE_OFFICER_NAME` |
| 5 | Marketplace / vendor information | `[x]` `/legal/vendor-partner-agreement` + `/partners` |
| 6 | Cancellation + refund | `[x]` `/legal/refund-cancellation` |
| 7 | Website legal footer | `[x]` Privacy, Terms, Refunds, Grievance, Permissions, Disclaimers, Account deletion, Cookies |
| 8 | Marketplace / platform wording (not in-house crew) | `[x]` Terms, About, footer — spot-check other pages before launch |
| 9 | App permissions consent (Location, Camera, Photos, Notifications; no Contacts) | `[x]` `/legal/app-permissions` |
| 10 | Service terms / solar safety disclaimers | `[x]` `/legal/service-disclaimers` + `/safety` |
| 11 | Transparent pricing | `[x]` `/pricing` |
| 12 | Account deletion (store compliance) | `[x]` `/legal/account-deletion` + in-app flow |

Your remaining actions for §7a:

- [ ] Create / forward **`grievance@oorjaman.com`** (and monitor it). Dummy officer name is **Priya Sharma** in marketing env - replace with the real name.
- [ ] Replace dummy **`NEXT_PUBLIC_GRIEVANCE_OFFICER_NAME`**, **`NEXT_PUBLIC_COMPANY_ADDRESS`**, **`NEXT_PUBLIC_SUPPORT_PHONE`**, and **`NEXT_PUBLIC_COMPANY_GSTIN`** in `apps/oorjaman-web/.env.production.local`.
- [ ] Legal counsel sign-off on Privacy, Terms, Grievance, Refunds, DPDP wording (including jurisdiction in Guwahati, Assam).

### 7b. Marketing redesign (Phase A–D) - assets from you

**Phase A (done in code):** scroll reveals, rotating hero, proof strip, how-it-works, why-us mock, audience cards (testimonials auto-show when real quotes exist).

**Phase B (done in code):** `/stories` visit journeys + home strip, enriched panel-cleaning / AMC pages, sticky support call chip sitewide, Stories in header/footer/sitemap.

**Phase C (done in code):** optional photo/video slots (`public/marketing/`), city FAQs, business callback form, support hours, Instagram, testimonials gate via `placeholder: false`.

**Phase D (done in code):** MarketingPage media hero + wide body; visual upgrades for services, how-it-works, homeowners/businesses, download, cities, partners, safety, about, pricing chips, stories polish. App screenshot slots under `public/marketing/screenshots/`.

- [ ] Replace stock Unsplash/Mixkit files in `apps/oorjaman-web/public/marketing/` with brand-owned media before launch (see `ATTRIBUTION.md`). Dummy preview files are already in place.
- [ ] Replace dummy app screenshots `booking.png` / `tracking.png` / `evidence.png` in `public/marketing/screenshots/` with real customer-app captures.
- [ ] Replace dummy home quotes in `lib/home-content.ts` with **3–6 real permissioned customer quotes**.
- [ ] Replace dummy **`NEXT_PUBLIC_SUPPORT_PHONE`** with the live support number.
- [ ] Confirm **`NEXT_PUBLIC_SUPPORT_HOURS`** if different from dummy Mon-Sat 9:00 AM - 6:00 PM IST.
- [ ] Confirm or change trust strip copy in `lib/home-content.ts` (`trustItems`).
- [ ] Optional: replace sample visit stories in `lib/visit-stories.ts` with permissioned real case studies + photos.
- [ ] Optional: Bing Webmaster Tools (same sitemap).

---

## 8. Portal hosting — admin / vendor / support (prod)

Runbook: `project-docs/DEPLOYMENT.md`, `project-docs/VERCEL.md`, `project-docs/SECURITY-VERCEL.md`

- [x] **Decide prod host:** **GoDaddy** 8-host layout (`admin` / `vendor` / `support.oorjaman.com`). UAT stays on Vercel for now.
- [ ] DNS/SSL for the three subdomains; SPA routing via `apps/*/public/.htaccess` (copied into `dist/` on build).
- [ ] Rebuild with prod `VITE_*` (prod Supabase URL + anon; `VITE_*_PORTAL_URL` → real subdomains; **no** dummy-auth vars). Upload zips from `dist-godaddy/` (gitignored).
- [ ] **Host security headers** present in prod (`.htaccess` mirrors `vercel.json`: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`) — SECURITY-VERCEL.md.
- [ ] Optional: Vercel Deployment Protection if any UAT portal should not be public.

---

## 9. Mobile release prep (EAS / stores)

Runbook: `project-docs/DEPLOYMENT.md` §Mobile + §Google Maps, `docs/customer-push-setup.md`, `docs/technician-push-setup.md`

- [ ] **EAS setup:** `eas init` (both apps) → `EXPO_PUBLIC_EAS_PROJECT_ID`; `eas credentials` (APNs + FCM) for **prod** bundle IDs `com.oorjaman.customer` / `com.oorjaman.technician`.
- [ ] **EAS production secrets:** `EXPO_PUBLIC_SUPABASE_URL` (prod), `EXPO_PUBLIC_SUPABASE_ANON_KEY` (prod), `EXPO_PUBLIC_SITE_URL=https://oorjaman.com`, `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` (and/or `_IOS` / `_ANDROID`), `EXPO_PUBLIC_GOOGLE_MAPS_DIRECTIONS_API_KEY`, `EXPO_PUBLIC_EAS_PROJECT_ID`, **`EXPO_PUBLIC_RAZORPAY_KEY_ID=rzp_live_…`** (public key id only). **No** dummy-auth vars; **never** Razorpay key secret in the app.
- [ ] **Google Maps (tiles):** GCP → billing on → enable Maps SDK iOS/Android + Static API → **app-restricted** key for prod bundle IDs (+ Android release **SHA-1**) → EAS secret → **native rebuild** (not OTA).
- [ ] **Google Directions (live tracking road route):** enable **Directions API** → create a **separate Directions-only** key (**no** iOS/Android app restriction; API restriction = Directions only) → set `EXPO_PUBLIC_GOOGLE_MAPS_DIRECTIONS_API_KEY` on **prod** EAS env (UAT alone is not enough) → rebuild customer app. Without this key, tracking falls back to OSRM / straight line. Details: `project-docs/DEPLOYMENT.md` §Google Maps.
- [ ] **Push per Supabase project:** deploy push functions (see §4) + `PUSH_DISPATCH_SECRET` + cron jobs on PROD (see [PROD_MOBILE_ANDROID_LAUNCH.md](PROD_MOBILE_ANDROID_LAUNCH.md)); register FCM/APNs creds for prod bundle IDs.
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
- [ ] Confirm entity **OORJA MAN LLP**, GSTIN, registered office address (Guwahati placeholder today) across About / Contact / legal.
- [x] Razorpay **UAT Test Mode** wired (Orders + webhook + verify + customer checkout + postpaid) — [project-docs/RAZORPAY.md](project-docs/RAZORPAY.md), [project-docs/RAZORPAY-UAT-MATRIX.md](project-docs/RAZORPAY-UAT-MATRIX.md), E2E guide §4a.
- [ ] Razorpay **Live** account: KYC complete (Power of Attorney for LLP) + settlement bank details approved.
- [ ] Live Mode activated in Razorpay Dashboard (not Test Mode for customer-facing prod apps).

### 11a. Razorpay PROD cutover (mirror of UAT setup — Live keys)

Runbook: [project-docs/RAZORPAY.md](project-docs/RAZORPAY.md). Do **not** reuse Test (`rzp_test_`) secrets on Prod.

#### Account & Dashboard (Live)

- [ ] Complete / confirm **Razorpay KYC** + LLP Power of Attorney.
- [ ] Confirm **Live** API Keys generated (Key Id + Key Secret).
- [ ] Confirm payment methods needed in Live (Cards, UPI, Netbanking, wallets as required).
- [ ] Confirm **Payment Links** available in Live (used for technician postpaid QR / share link — Standard Payment Links; not UPI-only Test links).
- [ ] Review Live **capture settings** (auto-capture vs authorize-then-capture). OorjaMan only treats **captured** as paid (`payments.status = success`).
- [ ] Note Live fee / settlement schedule for finance ops.

#### Database (PROD Supabase)

- [ ] Razorpay + postpaid migrations on PROD (§3 list) — same four files as UAT.
- [ ] Smoke SQL: `payments`, `payment_attempts`, `payment_refunds`, `razorpay_webhook_events` exist; RLS prevents clients setting Razorpay rows to `success`.

#### Edge secrets (PROD project only)

| Secret | Prod value |
|--------|------------|
| `RAZORPAY_KEY_ID` | Live key id (`rzp_live_…`) |
| `RAZORPAY_KEY_SECRET` | Live key secret |
| `RAZORPAY_WEBHOOK_SECRET` | From **Live** webhook endpoint (new secret — do not copy UAT Test webhook secret) |

- [ ] Set the three secrets above on the **PROD** Supabase project (Dashboard → Edge Functions → Secrets, or CLI).

#### Deploy Edge Functions (PROD)

```bash
# link PROD project first
npm run functions:deploy -- create-razorpay-order
npm run functions:deploy -- verify-razorpay-payment
npm run functions:deploy -- create-razorpay-refund
npm run functions:deploy -- razorpay-webhook --no-verify-jwt
```

- [ ] Deploy `create-razorpay-order` to PROD.
- [ ] Deploy `verify-razorpay-payment` to PROD.
- [ ] Deploy `create-razorpay-refund` to PROD.
- [ ] Deploy `razorpay-webhook` to PROD with **`--no-verify-jwt`**.

#### Webhook (Live Dashboard → PROD URL)

- [ ] Create webhook in Razorpay **Live** Mode (not Test).
- [ ] URL: `https://<SUPABASE_PROD_PROJECT_REF>.supabase.co/functions/v1/razorpay-webhook`
- [ ] Enable events: `payment.authorized`, `payment.captured`, `payment.failed`, `order.paid`, `refund.created`, `refund.processed`, `refund.failed`.
- [ ] Copy webhook signing secret → PROD `RAZORPAY_WEBHOOK_SECRET`.
- [ ] Send a Live test event / small real payment and confirm `razorpay_webhook_events` row + payment status update on PROD.

#### Client apps (public key id only)

- [ ] Set `EXPO_PUBLIC_RAZORPAY_KEY_ID=rzp_live_…` in customer app production env / EAS production secrets (§2 / §9).
- [ ] Confirm technician app does **not** need the key for QR (link comes from Edge); rebuild technician if collect UI is new since last store build.
- [ ] **Native rebuild** customer (and technician) production/store builds after Razorpay native module or env changes — OTA alone is not enough for Checkout SDK.
- [ ] Confirm **Simulate gateway** / dummy payment path is **off** when Live key is set (`DEPLOY_ENV=production` + Live key id present).

#### Admin / ops smoke (PROD)

- [ ] Admin → **Finance → Payments** loads against PROD.
- [ ] After a Live smoke payment: detail shows order id / payment id / status (no card PAN/CVV/secrets).
- [ ] Postpaid path: complete visit → technician **Collect payment** creates Payment Link / QR → customer pay → `success` + settlement fields correct; or **partner collected** path works.

#### Prod payment smoke (real ₹ — use minimal amounts)

- [ ] Prepaid one-time: Pay now → Checkout → capture → Confirming → Booking confirmed + How you paid.
- [ ] One deliberate Live failure / cancel → Try again; booking not wrongly confirmed.
- [ ] AMC pay (if AMC live at launch) with Live Checkout.
- [ ] Refund smoke: auto-refund on customer cancel (grace = full) + admin **Initiate refund** / **Cancel + refund**; payment moves to refund family statuses via webhook.
- [ ] Confirm authorized-only is **never** treated as paid until capture.

#### Security (must stay true on Prod)

- [ ] Key **secret** and webhook secret only in Edge / server — never in git, EAS public env beyond key **id**, or client bundles.
- [ ] Clients cannot mark Razorpay payments `success` via RLS.
- [ ] No logging of card numbers, CVV, OTP, or API secrets.

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

- [ ] §1–§11 / §11a all `[x]` (incl. Razorpay Live webhook + verify + Checkout smoke).
- [ ] `migration list` identical UAT ↔ PROD; `db:policy-diff` = 0.
- [ ] C1 escalation test passes on PROD.
- [ ] Account-deletion function verified on PROD.
- [ ] Razorpay Live smoke: prepaid success + one failure/cancel + (if shipping) postpaid collect.
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
- `project-docs/RAZORPAY.md` · `project-docs/RAZORPAY-UAT-MATRIX.md` — payments architecture, UAT cards, Prod cutover (§11a)
- `docs/customer-push-setup.md` · `docs/technician-push-setup.md` · `docs/ios-qa-distribution.md` · `docs/android-local-apk.md`
