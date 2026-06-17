# Deployment — PROD vs UAT (8 web hosts + 4 mobile apps, 2 Supabase projects, Vercel UAT portals)

This runbook covers:

- **8 web URLs** on GoDaddy (4 production + 4 UAT) — **target** layout for marketing + long-term portal hosting
- **3 Vercel projects** — **current UAT** hosting for admin / vendor / support portals (see [VERCEL.md](VERCEL.md))
- **4 mobile installables** — Customer and Partner apps, each with a **PROD** (store) and **UAT** (internal QA) binary
- **2 Supabase projects** — UAT database vs production database (same schema, different data)

**Related docs:** [VERCEL.md](VERCEL.md) (UAT portals on Vercel — **live today**), [ENVIRONMENT.md](ENVIRONMENT.md) (all env vars), [SUPABASE-UAT-PROD.md](SUPABASE-UAT-PROD.md) (migrations), [SEO.md](SEO.md) (production marketing SEO only), [BILLING.md](BILLING.md) (Supabase, Vercel, EAS, Maps, store fees).

---

## At a glance

| Surface                      | PROD                               | UAT (today)                                                                 | UAT (GoDaddy, planned)                         |
| ---------------------------- | ---------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------- |
| Marketing web                | `oorjaman.com`                     | Local / not on Vercel yet                                                   | `dev-oorjaman.oorjaman.com` (noindex)          |
| Admin / vendor / support web | `admin.*`, `vendor.*`, `support.*` | **Vercel:** `oorjaman-admin/vendor/support.vercel.app` ([VERCEL.md](VERCEL.md)) | `dev-admin.*`, `dev-vendor.*`, `dev-support.*` |
| Customer app (iOS/Android)   | App Store / Play — **OorjaMan**    | Internal / TestFlight / APK — **OorjaMan (UAT)**                            | Same                                           |
| Partner app (iOS/Android)    | Store — **OorjaMan Partner**       | Internal — **OorjaMan Partner (UAT)**                                       | Same                                           |
| Supabase                     | `OorjaMan Prod` project            | **`OorjaMan UAT`** project (all dev + Vercel + UAT mobile)                  | Same UAT project                               |

### Web portal deployment path (admin / vendor / support)

```
Local dev          → localhost:5173–5175 + apps/*/.env.development.local
UAT (current)      → Vercel + VITE_* in Dashboard (or apps/*/.env.uat.local for local build:uat)
GoDaddy UAT        → dev-*.oorjaman.com + rebuild with dev host cross-links (when you leave Vercel)
GoDaddy PROD       → *.oorjaman.com + Prod Supabase + no dummy auth
```

**Live Vercel UAT URLs (2026-05-20):**

| Portal  | URL |
| ------- | --- |
| Admin   | https://oorjaman-admin.vercel.app |
| Vendor  | https://oorjaman-vendor.vercel.app |
| Support | https://oorjaman-support.vercel.app |

Assign custom domains in Vercel (e.g. `dev-admin.oorjaman.com`) when DNS is ready — update `VITE_*_PORTAL_URL` and redeploy all three projects so cross-links stay consistent.

---

## URL matrix (8 GoDaddy web hosts + 3 Vercel UAT portals)

### Vercel — UAT portals (current)

Static Vite SPAs; Supabase called from the browser with the **anon** key. Root [`vercel.json`](vercel.json) handles SPA rewrites.

| Portal  | Vercel project (example) | Build command | Output |
| ------- | ------------------------ | ------------- | ------ |
| Admin   | `oorjaman-admin`         | `npm run build:uat -w admin-web` | `apps/admin-web/dist` |
| Vendor  | `oorjaman-vendor`        | `npm run build:uat -w vendor-web` | `apps/vendor-web/dist` |
| Support | `oorjaman-support`       | `npm run build:uat -w support-web` | `apps/support-web/dist` |

Monorepo settings (each project): **Root Directory** = repo root; **Install** = `npm install`; **Node** = 20.x. Full steps: [VERCEL.md](VERCEL.md).

### GoDaddy — marketing + future portal hosting (target)

All GoDaddy hosts below use **HTTPS**. Replace `oorjaman.com` if your apex domain differs.

| Tier     | App       | Hostname                            | Build output             |
| -------- | --------- | ----------------------------------- | ------------------------ |
| **PROD** | Marketing | `https://oorjaman.com`              | `apps/oorjaman-web/out/` |
| **PROD** | Admin     | `https://admin.oorjaman.com`        | `apps/admin-web/dist/`   |
| **PROD** | Vendor    | `https://vendor.oorjaman.com`       | `apps/vendor-web/dist/`  |
| **PROD** | Support   | `https://support.oorjaman.com`      | `apps/support-web/dist/` |
| **UAT**  | Marketing | `https://dev-oorjaman.oorjaman.com` | `apps/oorjaman-web/out/` |
| **UAT**  | Admin     | `https://dev-admin.oorjaman.com`    | `apps/admin-web/dist/`   |
| **UAT**  | Vendor    | `https://dev-vendor.oorjaman.com`   | `apps/vendor-web/dist/`  |
| **UAT**  | Support   | `https://dev-support.oorjaman.com`  | `apps/support-web/dist/` |

**DNS naming:** UAT uses the `dev-*` subdomain prefix on the same registrant domain (e.g. `dev-admin.oorjaman.com`). The marketing UAT host is **`dev-oorjaman.oorjaman.com`** (subdomain `dev-oorjaman`), not the production apex.

**SEO:** Only **production** marketing (`oorjaman.com`) is indexable. UAT marketing sets `NEXT_PUBLIC_DEPLOY_ENV=uat` → `noindex`, empty sitemap, `robots.txt` disallows all. See [UAT marketing (non-SEO)](#uat-marketing-non-seo).

---

## Supabase - two projects (UAT + PROD)

Use **two separate Supabase projects** so UAT never writes to production data.

| Project                                                                      | Purpose                   | Used by                                                          |
| ---------------------------------------------------------------------------- | ------------------------- | ---------------------------------------------------------------- |
| **OorjaMan UAT** (rename your current **OorjaMan** project in the dashboard) | Staging / UAT             | Local dev, **Vercel portals**, UAT mobile, `npm run seed:dummy-users` |
| **OorjaMan Prod** (new project)                                              | Live customers & partners | All 4 PROD web builds, store mobile builds                       |

**Migrations, RLS, views, cron:** applied from `supabase/migrations/` via `npm run db:push` on **each** project (UAT first, then Prod). Full runbook: **[SUPABASE-UAT-PROD.md](SUPABASE-UAT-PROD.md)**.

### One-time: create the second project

1. [Supabase Dashboard](https://supabase.com/dashboard) → **New project** (e.g. `oorjaman-uat`).
2. Note **Project URL**, **anon key**, and **service_role** (server only).
3. Link CLI to each project when pushing schema:

   ```bash
   # From repo root - link to UAT, push migrations
   supabase link --project-ref <UAT_PROJECT_REF>
   npm run db:push

   # Link to PROD, push same migrations
   supabase link --project-ref <PROD_PROJECT_REF>
   npm run db:push
   ```

4. Deploy edge functions to **both** projects (secrets differ per project):

   ```bash
   supabase link --project-ref <UAT_REF>
   npm run functions:deploy -- send-customer-expo-push
   npm run functions:deploy -- send-technician-expo-push
   # repeat for other functions you use

   supabase link --project-ref <PROD_REF>
   npm run functions:deploy -- send-customer-expo-push
   # ...
   ```

### Copy production data into UAT (optional)

Schema comes from migrations (`db:push`). **Data** is not copied automatically.

| Approach              | When to use                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------------- |
| **Fresh UAT**         | Seed test users only: root `.env.uat.local` with UAT `SUPABASE_SERVICE_ROLE_KEY` → `npm run seed:dummy-users` |
| **pg_dump / restore** | You need a realistic copy of prod (PII - restrict access)                                           |

**pg_dump (advanced):**

1. Dashboard → PROD → **Database** → connection string (use pooler, SSL).
2. Dump schema+data (or data-only after UAT migrations applied):

   ```bash
   pg_dump "$PROD_DATABASE_URL" --no-owner --no-acl -Fc -f prod.dump
   pg_restore -d "$UAT_DATABASE_URL" --clean --if-exists prod.dump
   ```

3. Re-run seed or repair scripts if auth users are out of sync (`npm run repair:public-users`).

**Supabase backups:** On paid plans you can restore a backup into a **new** project from the dashboard - useful for a one-off UAT clone; then point UAT env vars at that project ref.

**Rules:**

- Never put **prod** `service_role` in client apps or Vite builds.
- Never point a **prod** web build at the UAT Supabase URL (and vice versa).
- Rotate keys if a UAT dump contained prod secrets.

### Auth redirect URLs (both projects)

In each project: **Authentication → URL configuration**

| Setting       | PROD project                                                                                                                    | UAT project                                                                                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Site URL      | `https://oorjaman.com`                                                                                                          | `https://oorjaman-admin.vercel.app` (or primary Vercel admin URL)                                                                                        |
| Redirect URLs | `https://oorjaman.com/**`, `https://admin.oorjaman.com/**`, `https://vendor.oorjaman.com/**`, `https://support.oorjaman.com/**` | **Vercel (required today):** `https://oorjaman-admin.vercel.app/**`, `https://oorjaman-vendor.vercel.app/**`, `https://oorjaman-support.vercel.app/**`, `https://*.vercel.app/**` |
|               |                                                                                                                                 | **GoDaddy UAT (when used):** `https://dev-oorjaman.oorjaman.com/**`, `https://dev-admin.oorjaman.com/**`, `https://dev-vendor.oorjaman.com/**`, `https://dev-support.oorjaman.com/**` |

> Normal portal login uses in-app OTP (`verifyOtp`) with dummy auth on UAT — redirect URLs matter for magic links and future OAuth. See [VERCEL.md](VERCEL.md#supabase-changes-uat-project).

---

## Environment files (per tier)

Copy templates from each app’s `*.example` files. Use **separate** gitignored `.local` copies per tier — do not commit real values.

### Vite portals — three env modes (`admin-web`, `vendor-web`, `support-web`)

| File | Vite mode | When loaded | Portal URLs | Supabase |
| ---- | --------- | ----------- | ----------- | -------- |
| `.env.development.local` | `development` | `npm run admin` / `vendor` / `support` | `http://localhost:5173–5175` | **UAT** |
| `.env.uat.local` | `uat` | `npm run build:uat -w <portal>` (local UAT build smoke test) | **Vercel** or `dev-*.oorjaman.com` | **UAT** |
| `.env.production.local` | `production` | `npm run build -w <portal>` (GoDaddy prod) | `https://admin/vendor/support.oorjaman.com` | **Prod** |

Templates: `apps/<portal>/.env.development.example`, `.env.uat.example`, `.env.production.example`.

**Vercel:** set the same `VITE_*` names in the Dashboard (Production + Preview scopes) — Vercel does **not** read your local `.env.uat.local`. See [VERCEL.md](VERCEL.md#step-3--environment-variables-per-vercel-project).

**Repo-root scripts only:** `.env.uat.local` (from [`.env.uat.local.example`](.env.uat.local.example)) — `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` for `npm run seed:dummy-users`, **not** used by Vite apps at runtime.

### Shared flags

| Variable                                     | PROD             | UAT                    |
| -------------------------------------------- | ---------------- | ---------------------- |
| `NEXT_PUBLIC_DEPLOY_ENV` / `VITE_DEPLOY_ENV` | `production`     | `uat`                  |
| `*_USE_DUMMY_AUTH`                           | **off**          | `true` optional for QA |
| Supabase URL / anon                          | **prod** project | **uat** project        |

### Marketing - `apps/oorjaman-web/.env.local`

**PROD build:**

```env
NEXT_PUBLIC_DEPLOY_ENV=production
NEXT_PUBLIC_SITE_URL=https://oorjaman.com
NEXT_PUBLIC_VENDOR_PORTAL_URL=https://vendor.oorjaman.com
```

**UAT build:**

```env
NEXT_PUBLIC_DEPLOY_ENV=uat
NEXT_PUBLIC_SITE_URL=https://dev-oorjaman.oorjaman.com
NEXT_PUBLIC_VENDOR_PORTAL_URL=https://dev-vendor.oorjaman.com
```

### Vite portals — example values

**Local development** (`apps/admin-web/.env.development.local` — same pattern for vendor/support):

```env
VITE_DEPLOY_ENV=uat
VITE_SUPABASE_URL=https://<UAT_REF>.supabase.co
VITE_SUPABASE_ANON_KEY=<uat_anon_key>
VITE_ADMIN_PORTAL_URL=http://localhost:5173
VITE_VENDOR_PORTAL_URL=http://localhost:5174
VITE_SUPPORT_PORTAL_URL=http://localhost:5175
VITE_USE_DUMMY_AUTH=true
VITE_DUMMY_OTP_CODE=123456
VITE_DUMMY_AUTH_PASSWORD=TestOtp123!
```

**UAT build for Vercel** (set in Vercel Dashboard **or** `apps/admin-web/.env.uat.local` for local `build:uat`):

```env
VITE_DEPLOY_ENV=uat
VITE_SUPABASE_URL=https://<UAT_REF>.supabase.co
VITE_SUPABASE_ANON_KEY=<uat_anon_key>
VITE_ADMIN_PORTAL_URL=https://oorjaman-admin.vercel.app
VITE_VENDOR_PORTAL_URL=https://oorjaman-vendor.vercel.app
VITE_SUPPORT_PORTAL_URL=https://oorjaman-support.vercel.app
VITE_USE_DUMMY_AUTH=true
VITE_DUMMY_OTP_CODE=123456
VITE_DUMMY_AUTH_PASSWORD=TestOtp123!
```

**GoDaddy UAT** (when migrating off Vercel — swap cross-links to `dev-*.oorjaman.com`):

```env
VITE_DEPLOY_ENV=uat
VITE_SUPABASE_URL=https://<UAT_REF>.supabase.co
VITE_SUPABASE_ANON_KEY=<uat_anon_key>
VITE_ADMIN_PORTAL_URL=https://dev-admin.oorjaman.com
VITE_VENDOR_PORTAL_URL=https://dev-vendor.oorjaman.com
VITE_SUPPORT_PORTAL_URL=https://dev-support.oorjaman.com
```

**PROD (GoDaddy — same Supabase pair in all three portal builds):**

```env
VITE_DEPLOY_ENV=production
VITE_SUPABASE_URL=https://<PROD_REF>.supabase.co
VITE_SUPABASE_ANON_KEY=<prod_anon_key>
VITE_ADMIN_PORTAL_URL=https://admin.oorjaman.com
VITE_VENDOR_PORTAL_URL=https://vendor.oorjaman.com
VITE_SUPPORT_PORTAL_URL=https://support.oorjaman.com
# Do not set VITE_USE_DUMMY_AUTH or VITE_DUMMY_* on prod
```

---

## Mobile apps - Customer & Partner (PROD vs UAT)

Expo apps do **not** use GoDaddy. They ship as **native binaries** via [EAS Build](https://docs.expo.dev/build/introduction/). PROD and UAT must be **different installable apps** (different bundle IDs) so QA can run both on one phone and the store never receives a UAT build.

### How distinction works

| Mechanism                                     | PROD                                                | UAT                                                         |
| --------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------- |
| `EXPO_PUBLIC_DEPLOY_ENV`                      | `production`                                        | `uat`                                                       |
| App display name                              | OorjaMan / OorjaMan Partner                      | OorjaMan **(UAT)** / OorjaMan Partner **(UAT)**          |
| iOS bundle ID                                 | `com.oorjaman.customer` / `com.oorjaman.technician` | `com.oorjaman.customer.uat` / `com.oorjaman.technician.uat` |
| Android package                               | same pattern                                        | `*.uat` suffix                                              |
| Deep link scheme                              | `oorjaman-customer` / `oorjaman-technician`         | `oorjaman-customer-uat` / `oorjaman-technician-uat`         |
| Supabase                                      | **prod** URL + anon key                             | **uat** URL + anon key                                      |
| `EXPO_PUBLIC_SITE_URL` (customer legal links) | `https://oorjaman.com`                              | `https://dev-oorjaman.oorjaman.com`                         |
| Distribution                                  | App Store + Google Play                             | **Internal** (EAS link, TestFlight, APK) - not public store |
| In-app banner                                 | none                                                | yellow **UAT - not production** strip                       |

Configured in `app.config.ts` (customer + technician) and `eas.json` profiles: `development`, `uat`, `production`.

### Environment files

Per-app **mode-specific** locals (gitignored). Do **not** put secrets in plain `.env` — use templates `*.example` → copy to `*.local`.

| File | When it loads |
| ---- | ------------- |
| `apps/customer-app/.env.development.local` | Local dev: `npm run customer`, `npx expo start`, `npx expo run:ios` |
| `apps/customer-app/.env.production.local` | Prod-mode smoke tests / local prod builds |
| `apps/technician-app/.env.development.local` | Same pattern for partner app |
| `apps/technician-app/.env.production.local` | Partner prod-mode local |
| [`.env.development.example`](apps/customer-app/.env.development.example) / [`.env.production.example`](apps/customer-app/.env.production.example) | Templates (customer) |
| [technician examples](apps/technician-app/.env.development.example) | Templates (partner) |

**UAT / local dev** (`apps/customer-app/.env.development.local`):

```env
EXPO_PUBLIC_DEPLOY_ENV=local
EXPO_PUBLIC_SUPABASE_URL=https://<UAT_REF>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<uat_anon>
EXPO_PUBLIC_SITE_URL=http://localhost:3000
EXPO_PUBLIC_USE_DUMMY_AUTH=true
EXPO_PUBLIC_DUMMY_OTP_CODE=123456
EXPO_PUBLIC_DUMMY_AUTH_PASSWORD=TestOtp123!
# EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=   # see Google Maps section below
```

**PROD** (`apps/customer-app/.env.production.local` — rare local prod smoke test; store builds use EAS secrets):

```env
EXPO_PUBLIC_DEPLOY_ENV=production
EXPO_PUBLIC_SUPABASE_URL=https://<PROD_REF>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<prod_anon>
EXPO_PUBLIC_SITE_URL=https://oorjaman.com
# NO dummy auth
# EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=   # prod-restricted key; see Google Maps section below
```

For **UAT EAS binaries** (`EXPO_PUBLIC_DEPLOY_ENV=uat`), set env via EAS secrets / `eas.json` — not only `.env.development.local`. See EAS secrets table below.

`EXPO_PUBLIC_*` values are **embedded at EAS build time**. Changing Supabase or site URL requires a **new build**, not an OTA content update alone (unless you adopt EAS Update with env-specific channels).

### EAS setup (once per app)

```bash
cd apps/customer-app
npx eas init                    # links Expo project → sets EXPO_PUBLIC_EAS_PROJECT_ID
npx eas credentials              # APNs + FCM per bundle ID (repeat for .uat IDs)

cd ../technician-app
npx eas init
npx eas credentials
```

Each app has `eas.json` with three build profiles:

| Profile       | Purpose                     | `EXPO_PUBLIC_DEPLOY_ENV` |
| ------------- | --------------------------- | ------------------------ |
| `development` | Dev client, local debugging | `local`                  |
| `uat`         | QA / UAT binaries           | `uat`                    |
| `production`  | Store release               | `production`             |

### EAS secrets (per app, per environment)

In [expo.dev](https://expo.dev) → your project → **Environment variables**, create **production** and **preview/uat** (or use EAS CLI `eas env:create`).

Set at least:

| Secret / variable                 | UAT builds                                 | PROD builds                             |
| --------------------------------- | ------------------------------------------ | --------------------------------------- |
| `EXPO_PUBLIC_SUPABASE_URL`        | UAT project                                | PROD project                            |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY`   | UAT anon                                   | PROD anon                               |
| `EXPO_PUBLIC_SITE_URL`            | `https://dev-oorjaman.oorjaman.com`        | `https://oorjaman.com`                  |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | key restricted to `*.uat` bundle / package | key restricted to prod bundle / package |
| `EXPO_PUBLIC_EAS_PROJECT_ID`      | app’s EAS UUID                             | same                                    |

Do **not** set `EXPO_PUBLIC_USE_DUMMY_AUTH` on production store builds.

### Build commands

**UAT (internal QA - install alongside prod app):**

```bash
cd apps/customer-app
eas build --profile uat --platform all

cd apps/technician-app
eas build --profile uat --platform all
```

Share the install link from the EAS dashboard with testers (or submit UAT iOS to TestFlight internal group).

**PROD (store):**

```bash
cd apps/customer-app
eas build --profile production --platform all
eas submit --profile production --platform ios    # after App Store Connect setup
eas submit --profile production --platform android

cd apps/technician-app
eas build --profile production --platform all
eas submit --profile production --platform all
```

**Local dev (Metro, Expo Go limited):**

```bash
npm run customer    # from repo root — loads apps/customer-app/.env.development.local
npm run technician
```

Use a **development** EAS build (`eas build --profile development`) for push notifications and full native modules - Expo Go is not enough for production-like testing ([ENVIRONMENT.md](ENVIRONMENT.md)).

### Mobile ↔ Supabase ↔ web alignment

| Test flow      | Customer app                | Backend         | Web consoles                                                                 |
| -------------- | --------------------------- | --------------- | ---------------------------------------------------------------------------- |
| UAT end-to-end | UAT build → UAT Supabase    | OorjaMan UAT    | **Vercel:** admin / vendor / support `.vercel.app` (or GoDaddy `dev-*` later) |
| Production     | Store build → PROD Supabase | OorjaMan Prod   | GoDaddy `admin`, `vendor`, `support`                                         |

A **UAT customer app must not** point at production Supabase (and vice versa). Seed UAT users with root `.env.uat.local` + `npm run seed:dummy-users` against the **UAT** service role key.

### Push notifications (both tiers)

Edge functions and Postgres `app.*_push_function_url` settings are **per Supabase project**. Deploy push functions to **both** UAT and PROD and use **separate** `PUSH_DISPATCH_SECRET` values if you want isolation.

UAT builds use the **`.uat` bundle IDs** - register separate FCM/APNs credentials in EAS for those IDs. See [docs/customer-push-setup.md](docs/customer-push-setup.md) and [docs/technician-push-setup.md](docs/technician-push-setup.md).

### Google Maps (customer app — configure before store release)

In-app maps (technician live tracking, activity map preview, site photo GPS stamps) use **Google Maps on iOS and Android** via `react-native-maps` + `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`. Opening coordinates in the browser (`https://www.google.com/maps?q=lat,lng`) does **not** need this key.

**Defer until release prep** — local dev can skip the key (site photo stamps use **OpenStreetMap** HTTP fallback; in-app Google tiles stay blank until configured). Complete this checklist before UAT/PROD EAS builds that need **Google-branded** map tiles.

#### 1. Create the key (Google Cloud Console)

1. [Google Cloud Console](https://console.cloud.google.com/) → create or select a project (e.g. **OorjaMan**).
2. **Billing** → enable billing on the project (Maps Platform requires it; monthly free credit applies — see [BILLING.md](BILLING.md)).
3. **APIs & Services → Library** → enable:
   - **Maps SDK for iOS**
   - **Maps SDK for Android**
   - **Maps Static API** (fallback when native map snapshot fails on site photos)
4. **APIs & Services → Credentials → Create credentials → API key**.

#### 2. Restrict the key

Use **separate keys** for UAT vs PROD (recommended), or one key with all bundle IDs listed.

| Tier | iOS bundle ID | Android package |
| ---- | ------------- | --------------- |
| **PROD** | `com.oorjaman.customer` | `com.oorjaman.customer` |
| **UAT** | `com.oorjaman.customer.uat` | `com.oorjaman.customer.uat` |

**Application restrictions:** add the iOS bundle IDs and Android package names for the tier(s) this key serves. For Android **release** builds, also add SHA-1 fingerprints from your signing keystore (EAS credentials / Play Console).

**API restrictions:** limit to Maps SDK for iOS, Maps SDK for Android, and Maps Static API only.

#### 3. Where to store the key

Do **not** use plain `apps/customer-app/.env`. Use mode-specific locals or EAS:

| Context | File / location | Key to use |
| ------- | --------------- | ---------- |
| Local dev (`npm run customer`, `expo run:ios`) | `apps/customer-app/.env.development.local` | Dev/UAT-restricted key (include `com.oorjaman.customer` if you build with `EXPO_PUBLIC_DEPLOY_ENV=local`) |
| Local prod smoke test | `apps/customer-app/.env.production.local` | PROD-restricted key |
| UAT EAS builds | EAS env / secret (`preview` or profile used by `uat`) | UAT-restricted key (`*.customer.uat`) |
| Store PROD builds | EAS env / secret (`production`) | PROD-restricted key |

```env
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=AIza...your_key_here
```

EAS CLI example (repeat per app / environment):

```bash
cd apps/customer-app
eas env:create --name EXPO_PUBLIC_GOOGLE_MAPS_API_KEY --value "..." --environment production
eas env:create --name EXPO_PUBLIC_GOOGLE_MAPS_API_KEY --value "..." --environment preview   # UAT
```

The key is read in `apps/customer-app/app.config.ts` and baked into **native** iOS/Android config at build time.

#### 4. Rebuild after adding or changing the key

Metro reload is **not** enough. Any change to `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` or `app.config.ts` maps config requires a **new native build**:

```bash
cd apps/customer-app
npx expo run:ios          # local dev client
# or
eas build --profile uat --platform all
eas build --profile production --platform all
```

#### 5. Verify

- Technician tracking and activity map preview show **Google** map tiles (not Apple Maps on iOS).
- Site photo stamps show Google tiles when GPS tagging runs.
- Cloud Console → **APIs & Services → Metrics** shows map load activity (set budget alerts).

**Cost / monitoring:** [BILLING.md](BILLING.md).

### App Store / Play listing URLs

Point store “Privacy policy” and “Support URL” to **production** web only:

- `https://oorjaman.com/legal/privacy-policy`
- `https://oorjaman.com/contact`

UAT legal pages on `dev-oorjaman.oorjaman.com` are for QA only.

---

## UAT marketing (non-SEO)

When `NEXT_PUBLIC_DEPLOY_ENV=uat` (or the site URL host starts with `dev-`):

- All pages: `robots: noindex, nofollow`
- `robots.txt`: `Disallow: /`
- `sitemap.xml`: empty
- JSON-LD organization/website blocks omitted
- Yellow **UAT** banner in the layout

Production marketing must set `NEXT_PUBLIC_DEPLOY_ENV=production` and `NEXT_PUBLIC_SITE_URL=https://oorjaman.com`.

---

## GoDaddy DNS (8 document roots)

In **cPanel → Subdomains** (or DNS + separate folders):

| Host                        | Suggested folder            |
| --------------------------- | --------------------------- |
| `oorjaman.com`              | `public_html/`              |
| `admin.oorjaman.com`        | `public_html/admin/`        |
| `vendor.oorjaman.com`       | `public_html/vendor/`       |
| `support.oorjaman.com`      | `public_html/support/`      |
| `dev-oorjaman.oorjaman.com` | `public_html/dev-oorjaman/` |
| `dev-admin.oorjaman.com`    | `public_html/dev-admin/`    |
| `dev-vendor.oorjaman.com`   | `public_html/dev-vendor/`   |
| `dev-support.oorjaman.com`  | `public_html/dev-support/`  |

Enable **SSL** on all eight. Redirect `www.oorjaman.com` → `https://oorjaman.com` (production only).

**SPA routing** (admin / vendor / support - all four Vite hosts): place `.htaccess` in each portal folder:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

---

## Build commands

From repo root after `npm install`:

### Vercel UAT (admin / vendor / support — current)

Push to GitHub → Vercel auto-builds, **or** build locally to verify:

```bash
npm run build:uat -w admin-web
npm run build:uat -w vendor-web
npm run build:uat -w support-web
```

Output: `apps/<portal>/dist/` (upload not needed when using Git-connected Vercel projects). Env: set `VITE_*` in Vercel Dashboard — see [VERCEL.md](VERCEL.md).

### GoDaddy — production

```bash
# Marketing
NEXT_PUBLIC_DEPLOY_ENV=production NEXT_PUBLIC_SITE_URL=https://oorjaman.com \
  npm run build:godaddy -w oorjaman-web

# Portals (with apps/*/env.production or exported VITE_*)
npm run build -w admin-web
npm run build -w vendor-web
npm run build -w support-web
```

Upload: `out/` → prod marketing folder; each `dist/` → matching prod subdomain folder.

### GoDaddy — UAT (when not using Vercel for portals)

```bash
NEXT_PUBLIC_DEPLOY_ENV=uat NEXT_PUBLIC_SITE_URL=https://dev-oorjaman.oorjaman.com \
  npm run build:godaddy -w oorjaman-web

# UAT VITE_* in each app .env.uat or shell exports
npm run build -w admin-web
npm run build -w vendor-web
npm run build -w support-web
```

NEXT_PUBLIC_DEPLOY_ENV=uat NEXT_PUBLIC_SITE_URL=https://dev-oorjaman.oorjaman.com \
  npm run build:godaddy -w oorjaman-web

# Portal UAT builds — use apps/*/.env.uat.local with dev-*.oorjaman.com cross-links
npm run build:uat -w admin-web
npm run build:uat -w vendor-web
npm run build:uat -w support-web
```

Upload to the four `dev-*` GoDaddy folders. **Portals:** skip this step while hosted on Vercel.

---

## Redeploy checklist

| Change                                           | Vercel UAT portals                              | GoDaddy web                                     | Mobile (customer / technician)                                     |
| ------------------------------------------------ | ----------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------ |
| UI code only                                     | Push → auto redeploy (or manual Redeploy)       | Rebuild + re-upload `dist/` or `out/`           | `eas build --profile uat` or `production`                          |
| Env (`VITE_*`, `NEXT_PUBLIC_*`, `EXPO_PUBLIC_*`) | Update Vercel env → **Redeploy** (baked in)     | Rebuild web on CI/build machine                 | **New EAS build** (env baked in)                                   |
| `app.config.ts` / bundle ID / Google Maps key    | —                                               | —                                               | **New EAS build** + credentials if IDs changed                       |
| SQL migration                                    | `npm run db:push` on UAT then PROD              | Same                                            | Same — apps pick up schema on next API call                        |
| Edge function                                    | `functions:deploy` on matching Supabase project | Same                                            | Same                                                               |
| OTA JS-only fix (optional)                       | —                                               | —                                               | `eas update --channel uat` / `production` if you enable EAS Update |
| Copy prod → UAT data                             | —                                               | `pg_dump` / restore                             | Reinstall UAT app; no mobile redeploy required                     |

---

## Quick verification

| Check                                        | PROD                                 | UAT (Vercel)                                      | UAT (GoDaddy, when used)      |
| -------------------------------------------- | ------------------------------------ | ------------------------------------------------- | ----------------------------- |
| Marketing `robots.txt`                       | Allows crawl, lists sitemap          | N/A until marketing deployed                      | `Disallow: /`                 |
| Login on admin portal                        | Prod Supabase project in Network tab | UAT project ref; dummy OTP `123456` if enabled    | Same                          |
| Cross-links                                  | Point to `*.oorjaman.com`            | Point to `*.vercel.app` (all three consistent)    | Point to `dev-*.oorjaman.com` |
| SPA deep link refresh                        | `.htaccess` on GoDaddy               | `vercel.json` rewrites — no 404 on `/login`       | `.htaccess`                   |
| Dummy auth (web + mobile)                    | Off                                  | Optional on for QA                                | Optional                      |
| Customer app name on home screen             | **OorjaMan**                         | **OorjaMan (UAT)**                                | Same                          |
| Can install customer + UAT customer together | N/A (only prod on store phone)       | Yes — different bundle IDs                        | Same                          |
| Mobile yellow banner                         | Hidden                               | **UAT — not production**                          | Same                          |
| Legal link in customer app                   | `oorjaman.com`                       | `dev-oorjaman.oorjaman.com`                       | Same                          |

---

## Local development

Default: **localhost** + **OorjaMan UAT** Supabase — see [ENVIRONMENT.md](ENVIRONMENT.md). Portal ports: admin `5173`, vendor `5174`, support `5175`, marketing `3000`.

For **parity with Vercel UAT**, open the deployed portals at `oorjaman-admin/vendor/support.vercel.app` after seeding dummy users (`npm run seed:dummy-users` with root `.env.uat.local`).

`NEXT_PUBLIC_DEPLOY_ENV` unset locally → treated as `local` (marketing pages can still be indexed in dev builds; use `uat` locally to test the non-SEO banner).

---

_Last updated: 2026-05-20 — Vercel UAT portals live; GoDaddy 8-host target; three-mode Vite env files; dual Supabase; EAS/mobile matrix._
