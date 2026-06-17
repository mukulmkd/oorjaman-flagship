# OorjaMan — billing & paid services

Living checklist of third-party services that require billing accounts, API keys, or usage-based fees. Add a new dated entry when we onboard another provider.

**Do not commit real API keys or secrets to this file.** Store keys in gitignored `.env*.local` files (local) or your secret manager (Vercel, EAS, CI, GoDaddy build machine).

For **environment placement** (which file gets which key): [**ENVIRONMENT.md**](ENVIRONMENT.md).  
For **PROD vs UAT deployment** (Vercel, GoDaddy, EAS): [**DEPLOYMENT.md**](DEPLOYMENT.md).

---

## How to add an entry

Copy this template for each new service:

```markdown
### [Service name] — [short purpose]

- **Status:** not started | in setup | active | optional
- **Used by:** apps/packages affected
- **Env var(s):** `NAME=description`
- **Console:** link
- **APIs / products to enable:**
- **Requires billing account:** yes/no
- **Typical cost notes:**
- **Setup steps:**
- **Key restrictions (recommended):**
- **Deploy / rebuild notes:**
- **What works without it:**
- **Added:** YYYY-MM-DD
- **Last reviewed:** YYYY-MM-DD
- **Notes:**
```

---

## Current stack summary (2026-05-20)

| Service | Tier today | Billed? | Notes |
| ------- | ---------- | ------- | ----- |
| **Supabase** | UAT project active; Prod project planned | Free tier OK for UAT; Prod needs paid plan for production traffic | Two projects — see [SUPABASE-UAT-PROD.md](SUPABASE-UAT-PROD.md) |
| **Vercel** | UAT admin / vendor / support portals | Hobby/free OK for internal QA | Production GoDaddy later — see [VERCEL.md](VERCEL.md) |
| **Expo / EAS** | UAT + local APK builds | Free tier + build minutes | Store release needs Apple + Google accounts |
| **Google Maps Platform** | Optional until maps QA | Yes when enabled | Customer app native maps only |
| **GoDaddy** | Planned for marketing + prod/UAT web | Hosting + domain renewal | Not used for portals yet (Vercel UAT first) |
| **Supabase Auth SMS/email** | Off on UAT (dummy auth) | Per-message when live | Required for GoDaddy prod + real OTP |

---

## Entries

### Supabase — app backend (Postgres, Auth, Realtime, Storage, Edge Functions)

- **Status:** active (UAT); Prod project not yet live
- **Used by:** All apps (`customer-app`, `technician-app`, `admin-web`, `vendor-web`, `support-web`, `oorjaman-web`); scripts (`seed:dummy-users`, `db:push`)
- **Env var(s):**
  - Client: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (mobile); `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (web)
  - Server/scripts only: `SUPABASE_SERVICE_ROLE_KEY` (root `.env.uat.local` / `.env.production.local` — **never** in Vercel or mobile builds)
- **Console:** https://supabase.com/dashboard
- **APIs / products to enable:** Project per environment; Auth (Email + Phone when leaving dummy auth); Storage buckets per migrations; Edge Functions for push + notifications
- **Requires billing account:** no for UAT/dev on free tier; **yes** for production scale (compute, egress, auth volume)
- **Typical cost notes:** Free tier for UAT QA; monitor Auth SMS, Storage egress, and Edge invocations before prod launch. Two projects (UAT + Prod) = two bills when both are active.
- **Setup steps:**
  1. Rename existing project → **OorjaMan UAT**; note project ref, URL, anon, service_role.
  2. Create **OorjaMan Prod** when ready for GoDaddy production.
  3. Apply migrations: `npm run db:push` on **each** project (UAT first).
  4. Deploy edge functions per project: `npm run functions:deploy -- <name>`.
  5. Point Vercel / local / EAS env at **UAT** URL + anon only.
- **Key restrictions (recommended):** Never expose `service_role` in client builds. Rotate if leaked.
- **Deploy / rebuild notes:** Schema changes = migration + `db:push`; no portal/mobile rebuild required unless env URLs change.
- **What works without it:** Nothing — all apps need Supabase.
- **Added:** 2026-05-20
- **Last reviewed:** 2026-05-20
- **Notes:** UAT is the single backend for local dev, Vercel portals, and UAT mobile builds today.

---

### Vercel — UAT hosting for admin / vendor / support portals

- **Status:** active (UAT QA)
- **Used by:** `admin-web`, `vendor-web`, `support-web` (static Vite SPAs)
- **Env var(s):** All `VITE_*` set in **Vercel Dashboard → Environment Variables** (Production + Preview). Same names as local `.env.uat.local` — see [VERCEL.md](VERCEL.md).
- **Console:** https://vercel.com
- **APIs / products to enable:** Three projects from one GitHub repo (monorepo root, `npm run build:uat -w <portal>`)
- **Requires billing account:** no for Hobby/internal testing; Pro if you need team features or higher limits
- **Typical cost notes:** Static hosting is usually free/low on Hobby; build minutes count toward quota. Preview deploys on every PR if enabled.
- **Setup steps:** Full runbook in [VERCEL.md](VERCEL.md). Summary:
  1. Three projects: `oorjaman-admin`, `oorjaman-vendor`, `oorjaman-support`.
  2. Build: `npm run build:uat -w admin-web` (etc.); output `apps/<portal>/dist`.
  3. Root [`vercel.json`](vercel.json) for SPA rewrites + security headers.
  4. UAT Supabase + dummy auth optional + cross-link URLs → **live Vercel URLs** (not localhost).
- **Key restrictions (recommended):** Deployment Protection for internal QA; never add `service_role` to Vercel env.
- **Deploy / rebuild notes:** Any `VITE_*` change requires **Redeploy** (values are baked at build time).
- **What works without it:** Local portals on `localhost:5173–5175`; GoDaddy UAT hosts when you migrate off Vercel.
- **Added:** 2026-05-20
- **Last reviewed:** 2026-05-20
- **Notes:** Current stable UAT URLs (assign custom domains in Vercel if desired):
  - Admin: https://oorjaman-admin.vercel.app
  - Vendor: https://oorjaman-vendor.vercel.app
  - Support: https://oorjaman-support.vercel.app

---

### Expo Application Services (EAS) — mobile builds & push credentials

- **Status:** in setup (UAT Android builds); production store not yet live
- **Used by:** `customer-app`, `technician-app` — `eas.json` profiles `development`, `uat`, `production`
- **Env var(s):** `EXPO_PUBLIC_EAS_PROJECT_ID`; build-time secrets via EAS Environment Variables / `eas env:create`
- **Console:** https://expo.dev
- **APIs / products to enable:** EAS Build; EAS Submit (store); optional EAS Update
- **Requires billing account:** free tier includes limited build minutes; paid plans for more concurrency/minutes
- **Typical cost notes:** UAT internal builds (`eas build --profile uat`) consume minutes. Separate credentials per bundle ID (prod vs `*.uat`).
- **Setup steps:**
  1. `npx eas init` per app; register iOS/Android credentials (`npx eas credentials`).
  2. Set UAT vs prod Supabase + `EXPO_PUBLIC_DEPLOY_ENV` in EAS secrets per profile.
  3. UAT: `npm run eas:android:uat:customer` / `technician` from repo root, or `eas build --profile uat`.
  4. Local APK without EAS cloud: `npm run android:apk:uat:customer` — see [docs/android-local-apk.md](docs/android-local-apk.md).
- **Key restrictions (recommended):** Do not set dummy auth on production store builds.
- **Deploy / rebuild notes:** Any `EXPO_PUBLIC_*` or native config change → new build (OTA alone is not enough for env/native changes).
- **What works without it:** Metro + Expo Go for limited UI dev; not enough for push, maps, or production-like native modules.
- **Added:** 2026-05-20
- **Last reviewed:** 2026-05-20
- **Notes:** Optional `EXPO_ACCESS_TOKEN` on Supabase edge functions for higher Expo push rate limits — see ENVIRONMENT.md push sections.

---

### Apple Developer Program — iOS distribution & APNs

- **Status:** not started (required before App Store / TestFlight prod)
- **Used by:** `customer-app`, `technician-app` iOS builds via EAS
- **Env var(s):** None in repo — credentials managed in EAS (`eas credentials`)
- **Console:** https://developer.apple.com
- **Requires billing account:** yes — **$99 USD / year** (organization or individual)
- **Typical cost notes:** Annual renewal; TestFlight internal testing included.
- **Setup steps:** Enroll → configure App IDs for prod and `*.uat` bundle IDs → APNs key in EAS.
- **Deploy / rebuild notes:** New bundle ID or push capability → update credentials + rebuild.
- **What works without it:** Android-only UAT; iOS Simulator with dev client only.
- **Added:** 2026-05-20
- **Last reviewed:** 2026-05-20

---

### Google Play Console — Android store distribution

- **Status:** not started (required before Play Store prod)
- **Used by:** `customer-app`, `technician-app` Android release builds
- **Console:** https://play.google.com/console
- **Requires billing account:** yes — **one-time $25 USD** registration fee
- **Typical cost notes:** No recurring Play Console fee; SHA-1 from release keystore needed for Maps key restrictions.
- **Setup steps:** Create app listings → upload AAB from `eas submit` → link privacy/support URLs to **production** marketing site only.
- **What works without it:** Internal APK / EAS internal distribution for UAT.
- **Added:** 2026-05-20
- **Last reviewed:** 2026-05-20

---

### GoDaddy — production & UAT web hosting (marketing + portals)

- **Status:** planned (portals on Vercel UAT today)
- **Used by:** `oorjaman-web` (Next static export), future hosting of `admin-web`, `vendor-web`, `support-web` on `*.oorjaman.com` / `dev-*.oorjaman.com`
- **Env var(s):** `NEXT_PUBLIC_*` / `VITE_*` injected at **build time** on your machine or CI — not stored on GoDaddy
- **Console:** GoDaddy cPanel / DNS
- **Requires billing account:** yes — domain + hosting plan
- **Typical cost notes:** Eight web document roots in the target layout (4 prod + 4 UAT) — see [DEPLOYMENT.md](DEPLOYMENT.md).
- **Setup steps:** DNS subdomains → upload `out/` / `dist/` → `.htaccess` SPA rules for Vite portals.
- **Deploy / rebuild notes:** When moving portals from Vercel to GoDaddy UAT, rebuild with `apps/*/.env.uat.local` using `dev-*.oorjaman.com` cross-links instead of Vercel URLs.
- **What works without it:** Vercel for portal UAT; local dev for everything else.
- **Added:** 2026-05-20
- **Last reviewed:** 2026-05-20

---

### Supabase Auth providers (Phone / Email) — real OTP in production

- **Status:** optional on UAT (dummy auth enabled); required for production
- **Used by:** All apps when `*_USE_DUMMY_AUTH` is off
- **Env var(s):** Configured in Supabase Dashboard (Twilio/etc. for SMS if using Phone provider)
- **Console:** Supabase → Authentication → Providers
- **Requires billing account:** depends on SMS vendor (Supabase may bundle or you bring Twilio)
- **Typical cost notes:** Per SMS/email; dummy auth avoids this on UAT/Vercel QA.
- **Setup steps:** Enable Phone and/or Email → configure provider → turn off `VITE_USE_DUMMY_AUTH` / `EXPO_PUBLIC_USE_DUMMY_AUTH` on prod builds only.
- **What works without it:** Dummy auth + `npm run seed:dummy-users` on UAT.
- **Added:** 2026-05-20
- **Last reviewed:** 2026-05-20

---

### Google Maps Platform — in-app maps & site photo stamps

- **Status:** optional for browser links; **required** for Google map tiles in the customer app (iOS/Android)
- **Used by:** `apps/customer-app` — site photo stamp (`SitePhotoMapSnapshot`), booking track, activity map preview; `app.config.ts` native SDK config; `lib/google-maps.ts` static map fallback
- **Env var(s):** `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` in `apps/customer-app/.env.development.local` / EAS secrets
- **Console:** https://console.cloud.google.com/
- **APIs / products to enable:**
  - Maps SDK for Android
  - Maps SDK for iOS
  - Maps Static API (fallback when native map snapshot fails on site photos)
- **Requires billing account:** yes (Google Cloud billing must be enabled; Maps Platform includes monthly free credit — see current pricing on Google’s site)
- **Typical cost notes:** Usage-based (map loads, static map requests). Monitor in Cloud Console → Billing → Reports. Set budget alerts. Use **separate keys** for UAT (`*.customer.uat`) vs prod bundle IDs.
- **Setup steps:**
  1. Create or select a Google Cloud project (e.g. OorjaMan).
  2. Enable billing on the project.
  3. **APIs & Services → Library** — enable the three APIs listed above.
  4. **APIs & Services → Credentials → Create credentials → API key**.
  5. Add to `apps/customer-app/.env.development.local` or EAS env (not plain `.env`).
  6. **Rebuild the native customer app** (`npx expo run:ios` / `npx expo run:android` or EAS build). Hot reload is not enough — the key is baked into native config at build time.
- **Key restrictions (recommended):**
  - **Application restrictions:** iOS bundle `com.oorjaman.customer` / `com.oorjaman.customer.uat`; Android package same pattern (add SHA-1 for release keystores).
  - **API restrictions:** limit to Maps SDK for Android, Maps SDK for iOS, and Maps Static API only.
- **Deploy / rebuild notes:** Any change to this key or to `app.config.ts` maps config requires a new native build for store/dev clients.
- **What works without it:**
  - Tapping GPS coordinates on Profile still opens Google Maps in the browser (`https://www.google.com/maps?q=lat,lng`) — no API key needed.
  - **Site photo map stamp:** without a key, the app downloads **OpenStreetMap** static/tile imagery for the stamp (debug and UAT). This is not Google-branded.
  - On iOS without a key, native map snapshot may use **Apple Maps** when the Google provider is not configured.
  - A **solid blue** box on the stamp means no map image loaded — take a new photo after network/key/rebuild fixes ([RUNNING-APPS.md — Site photos](RUNNING-APPS.md#customer-app--site-photos-camera-gps-stamp-upload)).
- **Added:** 2026-05-16
- **Last reviewed:** 2026-05-20
- **Notes:** Defer until UAT/prod EAS builds need maps; see [DEPLOYMENT.md](DEPLOYMENT.md#google-maps-customer-app--configure-before-store-release).

---

## Quick reference — env vars by surface

| Variable | Service | Surfaces | Required |
| -------- | ------- | -------- | -------- |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Supabase | Admin, vendor, support web | Yes |
| `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase | Customer, partner mobile | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase | Scripts, edge functions only | Yes (server) |
| `VITE_USE_DUMMY_AUTH` + dummy OTP/password | Supabase Auth (QA) | Web UAT / Vercel | Optional on UAT |
| `EXPO_PUBLIC_USE_DUMMY_AUTH` + dummy OTP/password | Supabase Auth (QA) | Mobile UAT | Optional on UAT |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Maps Platform | Customer app maps | Optional until maps QA |
| `EXPO_PUBLIC_EAS_PROJECT_ID` | Expo | Mobile push | When testing remote push |
| `PUSH_DISPATCH_SECRET` | Supabase Edge | Push functions | When remote push enabled |

Add rows to this table as new billed services are documented above.
