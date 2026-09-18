# OorjaMan Universal Web

Operational documentation for the **locked** Universal Web program: Expo React Native Web (CSR/static) for Customer and Technician, with public SEO remaining on Next.js.

**Authoritative plans (do not contradict):**

- [`ORJ_WEB_UNIVERSAL_ARCHITECTURE_FINAL_REVIEW.md`](../ORJ_WEB_UNIVERSAL_ARCHITECTURE_FINAL_REVIEW.md)
- [`ORJ_WEB_UNIVERSAL_IMPLEMENTATION_PLAN.md`](../ORJ_WEB_UNIVERSAL_IMPLEMENTATION_PLAN.md)

---

## Phase status

| Field | Value |
| ----- | ----- |
| **Architecture** | **LOCKED** |
| **Implementation** | **UAT + PROD Vercel projects live** (`*-web-uat` / `*-web-prod`) |
| **Current task** | GoDaddy CNAMEs + Supabase Auth redirects + Maps/Razorpay env cutover |

Later phases (web boot, adapters, parity, Vercel deploy) are described in the implementation plan. **Do not implement them from this doc alone.**

---

## 1. Locked hosts

| Host | Purpose |
| ---- | ------- |
| [https://oorjaman.com](https://oorjaman.com) | Public marketing / SEO website |
| [https://app.oorjaman.com](https://app.oorjaman.com) | Authenticated **Customer** Expo Web (CSR SPA) |
| [https://partner.oorjaman.com](https://partner.oorjaman.com) | Authenticated **Technician (Partner)** Expo Web (CSR SPA) |

`www` should continue to redirect to the apex marketing host per [SEO.md](SEO.md).

---

## 2. Architecture

```
oorjaman.com
  → apps/oorjaman-web (Next.js SSR/SSG)
  → public SEO / marketing only

app.oorjaman.com
  → apps/customer-app
  → Expo Router + React Native Web
  → CSR static SPA (Vercel)

partner.oorjaman.com
  → apps/technician-app
  → Expo Router + React Native Web
  → CSR static SPA (Vercel)
```

**Rules:**

- Customer and Technician remain **separate** Expo apps (do not merge).
- Shared domain layer: `@oorjaman/api`, `@oorjaman/config`, `@oorjaman/utils` (and `@oorjaman/ui` where appropriate).
- Platform I/O uses `.web.ts` / `.native.ts` adapters (implemented in later phases).
- **No Expo SSR.** Authenticated product web is client-rendered.
- **No** CRA/Vite clones of the product apps; **no** Express BFF for this program; **no** Cloudflare for this program.
- Language: **TypeScript only** (no JS migration / parallel JS architecture).
- Existing Vite portals (`admin-web`, `vendor-web`, `support-web`) are **out of scope** and remain as today.

Backend remains Supabase: browser/Expo clients use **anon key + RLS**; privileged payment verification and webhooks stay in **Edge Functions**.

---

## 3. Vercel projects (Expo Web)

Suggested Vercel project names for the static Expo Web exports:

| Vercel project | App | Domain intent | Default URL |
| -------------- | --- | ------------- | ----------- |
| `oorjaman-customer-web-uat` | `apps/customer-app` | UAT → later `app.oorjaman.com` | `https://oorjaman-customer-web-uat.vercel.app` |
| `oorjaman-technician-web-uat` | `apps/technician-app` | UAT → later `partner.oorjaman.com` | `https://oorjaman-technician-web-uat.vercel.app` |
| `oorjaman-customer-web-prod` | `apps/customer-app` | Prod (`app.oorjaman.com`) | `https://oorjaman-customer-web-prod.vercel.app` + custom domain |
| `oorjaman-technician-web-prod` | `apps/technician-app` | Prod (`partner.oorjaman.com`) | `https://oorjaman-technician-web-prod.vercel.app` + custom domain |

Same suffix pattern as live portals: `oorjaman-admin-uat` / `oorjaman-vendor-uat` / `oorjaman-support-uat` (and `*-prod`).

### GoDaddy DNS (PROD custom domains)

Nameservers stay on GoDaddy (`ns21` / `ns22.domaincontrol.com`). Add **CNAME** records (same pattern as `admin.oorjaman.com` → Vercel):

| Type | Name | Value (prefer project-specific) | Fallback |
|------|------|----------------------------------|----------|
| CNAME | `app` | `75af7f8dfbda515b.vercel-dns-017.com` | `cname.vercel-dns.com` |
| CNAME | `partner` | `052774ec0e7ee15f.vercel-dns-017.com` | `cname.vercel-dns.com` |

After DNS propagates, Vercel issues SSL automatically. Until then use the `*.vercel.app` URLs.

### PROD Supabase Auth redirect URLs

On **OorjaMan PROD** → Authentication → URL Configuration, add:

```
https://app.oorjaman.com/**
https://partner.oorjaman.com/**
https://oorjaman-customer-web-prod.vercel.app/**
https://oorjaman-technician-web-prod.vercel.app/**
```

### UAT project settings (create in Dashboard)

Import the same GitHub repo **twice**. For each project:

| Setting | Customer | Technician |
|---------|----------|------------|
| **Root Directory** | `apps/customer-app` | `apps/technician-app` |
| **Framework Preset** | Other | Other |
| **Install Command** | from `vercel.json` (`cd ../.. && npm install`) | same |
| **Build Command** | from `vercel.json` (`npx expo export -p web`) | same |
| **Output Directory** | `dist` | `dist` |
| **Node.js** | 22.x | 22.x |
| **Production Branch** | `develop` | `develop` |
| **Ignored Build Step** | `node ../../scripts/vercel-should-build.mjs customer-app --branch develop` | `… technician-app --branch develop` |

> Ignored Build Step runs with Root Directory = the app folder, so the script path is `../../scripts/…` (repo root).

### UAT environment variables (Production + Preview)

```env
EXPO_PUBLIC_DEPLOY_ENV=uat
EXPO_PUBLIC_SUPABASE_URL=https://caearbriteguqjvnbrcg.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<UAT anon key>
EXPO_PUBLIC_SITE_URL=https://oorjaman.com
EXPO_PUBLIC_WEB_ORIGIN=https://oorjaman-customer-web-uat.vercel.app
EXPO_PUBLIC_WEB_PAYMENTS=0
EXPO_PUBLIC_USE_DUMMY_AUTH=true
EXPO_PUBLIC_DUMMY_OTP_CODE=123456
EXPO_PUBLIC_DUMMY_AUTH_PASSWORD=TestOtp123!
# Customer only (optional for UAT map):
# EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=
# EXPO_PUBLIC_RAZORPAY_KEY_ID=rzp_test_…
```

Technician: same, but `EXPO_PUBLIC_WEB_ORIGIN=https://oorjaman-technician-web-uat.vercel.app`.

**Never** set `SUPABASE_SERVICE_ROLE_KEY` on these projects.

Local smoke export (embeds `.env.uat.local`):

```bash
npm run build:uat:web -w customer-app
npm run build:uat:web -w technician-app
```

Marketing (`oorjaman.com`) and ops portals continue on their existing deploy paths ([SEO.md](SEO.md), [VERCEL.md](VERCEL.md), [DEPLOYMENT.md](DEPLOYMENT.md)).

---

## 4. Supabase Auth allowlist checklist (human / manual)

**Do not automate this from the repo.** An operator must update the Supabase project(s) in the Dashboard before production Expo Web login works with redirects.

### Production / UAT project(s)

In **Supabase Dashboard → Authentication → URL configuration** (exact UI labels may vary):

1. **Site URL** — keep marketing or primary app policy as already used for the project; do not blindly overwrite without checking existing mobile/deep-link needs.
2. **Redirect URLs / Additional Redirect URLs** — add (or ensure present):
   - `https://app.oorjaman.com/**`
   - `https://partner.oorjaman.com/**`
   - **UAT Vercel (add when projects exist):**
     - `https://oorjaman-customer-web-uat.vercel.app/**`
     - `https://oorjaman-technician-web-uat.vercel.app/**`
     - `https://*.vercel.app/**` (optional catch-all for previews)
3. **Vercel Preview URLs** — when preview deployments are enabled, add the project preview patterns, for example:
   - `https://oorjaman-customer-web-uat-*.vercel.app/**`
   - `https://oorjaman-technician-web-uat-*.vercel.app/**`
   - Or add specific preview URLs as they appear in Vercel until a wildcard policy is confirmed for your Supabase plan/UI.
4. Save and smoke-test OTP / session flows on a preview host before production cutover.
5. Repeat for **UAT and Prod** Supabase projects if you maintain dual projects ([SUPABASE-UAT-PROD.md](SUPABASE-UAT-PROD.md)).

**This checklist does not modify Supabase.** It is an ops prerequisite for later phases.

---

## 5. Security rule — anon vs service-role

| Credential | Expo Web (Customer / Technician) | Allowed elsewhere |
| ---------- | -------------------------------- | ----------------- |
| Supabase **anon** key (`EXPO_PUBLIC_SUPABASE_ANON_KEY`) | **Allowed** (build-time public; protected by **RLS**) | Mobile, Vite portals, Next public as today |
| Supabase **`SUPABASE_SERVICE_ROLE_KEY` / service_role** | **NEVER** | Edge Functions, trusted server scripts only |

Additional rules:

- Never put service-role in Vercel env for `oorjaman-customer-web-uat` / `oorjaman-technician-web-uat` (or `*-prod`).
- Payment secrets and webhook secrets remain Edge-only ([RAZORPAY.md](RAZORPAY.md)).
- Authenticated app hosts must not become crawlable SEO landing pages (see §9).

---

## 6. Web environment placeholders (documentation only)

These will be added to app `.env.example` files in **P0-T2**. Meanings:

| Variable | Purpose |
| -------- | ------- |
| `EXPO_PUBLIC_WEB_ORIGIN` | Canonical web origin for this build (e.g. `https://app.oorjaman.com` or `https://partner.oorjaman.com`). Used for absolute links / origin-aware web behavior in later phases. |
| `EXPO_PUBLIC_WEB_PAYMENTS` | Feature flag for enabling Razorpay **web** checkout (`1` / `true` when verified). Must stay off until Edge verify is proven for Checkout.js. |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | Browser Maps JavaScript API key for **Customer** live tracking on web. Restrict by HTTP referrer to `app.oorjaman.com` (and preview hosts) in Google Cloud. Native may continue to use platform-specific keys where configured. |
| `EXPO_PUBLIC_RAZORPAY_KEY_ID` | Public Razorpay **key id** for checkout (never the secret). Same key-id pattern as mobile; web uses Checkout.js / hosted checkout via adapters in later phases. |

Also required for any Expo client (already documented in [ENVIRONMENT.md](ENVIRONMENT.md)): `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_DEPLOY_ENV`, `EXPO_PUBLIC_SITE_URL` (legal/marketing links → `https://oorjaman.com`).

---

## 7. Native safety (store review freeze)

Native Customer and Technician apps are treated as **FROZEN** relative to Universal Web work unless a later task explicitly allows a scoped change.

**Must not change for Universal Web:**

- iOS bundle identifiers  
- Android package names  
- URL schemes (`oorjaman-customer`, `oorjaman-technician`, and UAT variants)  
- EAS project IDs  
- EAS store/submit identity configuration that would invalidate review builds  
- Native release trains vs Expo Web deploy pipelines (independent)

**Baseline identities (recorded at P0-T1; do not “fix” these in web phases):**

### Customer (`apps/customer-app`)

| Field | Production | UAT (`EXPO_PUBLIC_DEPLOY_ENV=uat` / `staging`) |
| ----- | ---------- | ----------------------------------------------- |
| iOS `bundleIdentifier` | `com.oorjaman.customer` | `com.oorjaman.customer.uat` |
| Android `package` | `com.oorjaman.customer` | `com.oorjaman.customer.uat` |
| Scheme | `oorjaman-customer` | `oorjaman-customer-uat` |
| EAS `projectId` (fallback in `app.config.ts`) | `7677ff40-7214-431a-a372-3059f6e6c91d` | Same project; env may override via `EXPO_PUBLIC_EAS_PROJECT_ID` |

EAS build profiles (`eas.json`): `development`, `uat`, `production` (+ `submit.production`).

### Technician (`apps/technician-app`)

| Field | Production | UAT |
| ----- | ---------- | --- |
| iOS `bundleIdentifier` | `com.oorjaman.technician` | `com.oorjaman.technician.uat` |
| Android `package` | `com.oorjaman.technician` | `com.oorjaman.technician.uat` |
| Scheme | `oorjaman-technician` | `oorjaman-technician-uat` |
| EAS `projectId` (fallback in `app.config.ts`) | `a89deab7-9f4e-4411-a533-061002c8b049` | Same; overridable via `EXPO_PUBLIC_EAS_PROJECT_ID` |

EAS build profiles (`eas.json`): `development`, `uat`, `production` (+ `submit.production`).

Expo Web deployment must not rewrite these values.

---

## 8. Deployment intent (Expo Web → Vercel static)

### Build & host

| App | Vercel project (suggested) | Domain | Config |
| --- | -------------------------- | ------ | ------ |
| `apps/customer-app` | `oorjaman-customer-web-uat` (→ `-prod` later) | `app.oorjaman.com` | `apps/customer-app/vercel.json` |
| `apps/technician-app` | `oorjaman-technician-web-uat` (→ `-prod` later) | `partner.oorjaman.com` | `apps/technician-app/vercel.json` |

1. Root Directory = the app folder (`apps/customer-app` or `apps/technician-app`).  
2. Build: `npx expo export -p web` (see each app’s `vercel.json` `buildCommand`).  
3. Output: `dist` (`app.config.ts` → `web.output: "single"`).  
4. SPA fallback: rewrite `/(.*)` → `/index.html`.  
5. **Never** set `SUPABASE_SERVICE_ROLE_KEY` (or any secret) on these Vercel projects — anon key + Edge Functions only.

### Env (Expo public only)

- `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`  
- `EXPO_PUBLIC_WEB_ORIGIN` (`https://app.oorjaman.com` or `https://partner.oorjaman.com`)  
- `EXPO_PUBLIC_RAZORPAY_KEY_ID` + `EXPO_PUBLIC_WEB_PAYMENTS` (customer; keep payments off until verify proven)  
- `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` (Maps JavaScript API; referrer-restrict to the web host + Vercel previews)  
- Optional dummy-auth flags for UAT only  

### SEO / noindex

- `public/robots.txt` → `Disallow: /` (copied into `expo export` output)  
- Vercel `X-Robots-Tag: noindex, nofollow` on all routes  
- Root layout `<meta name="robots" content="noindex, nofollow" />` via `expo-router/head` (client)  
- Marketing SEO stays on `apps/oorjaman-web` @ `oorjaman.com` only  

### Marketing CTAs (`apps/oorjaman-web`)

| Env | Use |
| --- | --- |
| `NEXT_PUBLIC_CUSTOMER_WEB_URL` | e.g. `https://app.oorjaman.com` — hero / header / download “Open web app” |
| `NEXT_PUBLIC_PARTNER_WEB_URL` | e.g. `https://partner.oorjaman.com` — partners page technician web login |
| `NEXT_PUBLIC_VENDOR_PORTAL_URL` | Vendor Vite portal (unchanged) |

### Rollback

- Unset custom domain or point DNS back; redeploy previous Vercel deployment.  
- Feature flags: turn off `EXPO_PUBLIC_WEB_PAYMENTS`; Maps fails closed without a key.  
- Native store builds are independent (EAS profiles untouched).

---

## 9. SEO boundary

| Surface | SEO role |
| ------- | -------- |
| `apps/oorjaman-web` @ `oorjaman.com` | **Sole** public SEO / marketing authority (metadata, canonical, OG, sitemap, robots, structured data) |
| `app.oorjaman.com` / `partner.oorjaman.com` | Authenticated product shells — **not** SEO landing pages; use `noindex` / robots Disallow (later phases) |

Do **not** duplicate marketing/service/city/blog pages inside Expo Router.

Parity contracts for authenticated product features are binding and live in the architecture final review / implementation plan — not in marketing SEO.

---

## 10. Related docs

| Doc | Role |
| --- | ---- |
| [ENVIRONMENT.md](ENVIRONMENT.md) | Full env matrix (local / UAT / production) |
| [SEO.md](SEO.md) | Marketing SEO & GoDaddy |
| [VERCEL.md](VERCEL.md) | Existing Vite portal Vercel setup |
| [DEPLOYMENT.md](DEPLOYMENT.md) | PROD vs UAT matrix |
| [RAZORPAY.md](RAZORPAY.md) | Payments / Edge secrets |
| [SUPABASE-UAT-PROD.md](SUPABASE-UAT-PROD.md) | Dual Supabase projects |

---

## Approved degrade / defer (reminder)

Only these are approved as non-parity or deferred for web MVP:

- **Web Push** — deferred; native push unchanged  
- **Background-style GPS tracker** — foreground / best-effort on web; **En Route still blocks** if geolocation is denied  

Live map, Razorpay web checkout, and binding parity flows are **not** “degraded stubs” for production.
