# Deployment - PROD vs UAT (8 web hosts + 4 mobile apps, 2 Supabase projects)

This runbook covers:

- **8 web URLs** on GoDaddy (4 production + 4 UAT)
- **4 mobile installables** - Customer and Technician apps, each with a **PROD** (store) and **UAT** (internal QA) binary
- **2 Supabase projects** - UAT database vs production database (same schema, different data)

**Related docs:** [ENVIRONMENT.md](ENVIRONMENT.md) (all env vars), [SEO.md](SEO.md) (production marketing SEO only), [BILLING.md](BILLING.md) (Maps, push, store fees).

---

## At a glance

| Surface                      | PROD                               | UAT                                            |
| ---------------------------- | ---------------------------------- | ---------------------------------------------- |
| Marketing web                | `oorjaman.com`                     | `dev-oorjaman.oorjaman.com` (noindex)          |
| Admin / vendor / support web | `admin.*`, `vendor.*`, `support.*` | `dev-admin.*`, `dev-vendor.*`, `dev-support.*` |
| Customer app (iOS/Android)   | App Store / Play - **OorjaMan**    | Internal / TestFlight - **OorjaMan (UAT)**     |
| Technician app (iOS/Android) | Store - **OorjaMan Technician**    | Internal - **OorjaMan Technician (UAT)**       |
| Supabase                     | `oorjaman-prod` project            | `oorjaman-uat` project                         |

---

## URL matrix (8 web hosts)

All hosts below use **HTTPS**. Replace `oorjaman.com` if your apex domain differs.

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
| **OorjaMan UAT** (rename your current **OorjaMan** project in the dashboard) | Staging / UAT             | All 4 UAT web builds, UAT mobile builds, local dev (recommended) |
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
| **Fresh UAT**         | Seed test users only: root `.env` with UAT `SUPABASE_SERVICE_ROLE_KEY` → `npm run seed:dummy-users` |
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
| Site URL      | `https://oorjaman.com`                                                                                                          | `https://dev-oorjaman.oorjaman.com`                                                                                                                      |
| Redirect URLs | `https://oorjaman.com/**`, `https://admin.oorjaman.com/**`, `https://vendor.oorjaman.com/**`, `https://support.oorjaman.com/**` | `https://dev-oorjaman.oorjaman.com/**`, `https://dev-admin.oorjaman.com/**`, `https://dev-vendor.oorjaman.com/**`, `https://dev-support.oorjaman.com/**` |

---

## Environment files (per tier)

Copy templates from [`.env.example`](.env.example). Use **separate** `.env` (or CI secrets) per tier - do not commit real values.

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

### Vite portals - `apps/admin-web/.env`, `vendor-web`, `support-web`

**PROD (same Supabase pair in all three files):**

```env
VITE_DEPLOY_ENV=production
VITE_SUPABASE_URL=https://<PROD_REF>.supabase.co
VITE_SUPABASE_ANON_KEY=<prod_anon_key>
VITE_ADMIN_PORTAL_URL=https://admin.oorjaman.com
VITE_VENDOR_PORTAL_URL=https://vendor.oorjaman.com
VITE_SUPPORT_PORTAL_URL=https://support.oorjaman.com
```

**UAT:**

```env
VITE_DEPLOY_ENV=uat
VITE_SUPABASE_URL=https://<UAT_REF>.supabase.co
VITE_SUPABASE_ANON_KEY=<uat_anon_key>
VITE_ADMIN_PORTAL_URL=https://dev-admin.oorjaman.com
VITE_VENDOR_PORTAL_URL=https://dev-vendor.oorjaman.com
VITE_SUPPORT_PORTAL_URL=https://dev-support.oorjaman.com
```

---

## Mobile apps - Customer & Technician (PROD vs UAT)

Expo apps do **not** use GoDaddy. They ship as **native binaries** via [EAS Build](https://docs.expo.dev/build/introduction/). PROD and UAT must be **different installable apps** (different bundle IDs) so QA can run both on one phone and the store never receives a UAT build.

### How distinction works

| Mechanism                                     | PROD                                                | UAT                                                         |
| --------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------- |
| `EXPO_PUBLIC_DEPLOY_ENV`                      | `production`                                        | `uat`                                                       |
| App display name                              | OorjaMan / OorjaMan Technician                      | OorjaMan **(UAT)** / OorjaMan Technician **(UAT)**          |
| iOS bundle ID                                 | `com.oorjaman.customer` / `com.oorjaman.technician` | `com.oorjaman.customer.uat` / `com.oorjaman.technician.uat` |
| Android package                               | same pattern                                        | `*.uat` suffix                                              |
| Deep link scheme                              | `oorjaman-customer` / `oorjaman-technician`         | `oorjaman-customer-uat` / `oorjaman-technician-uat`         |
| Supabase                                      | **prod** URL + anon key                             | **uat** URL + anon key                                      |
| `EXPO_PUBLIC_SITE_URL` (customer legal links) | `https://oorjaman.com`                              | `https://dev-oorjaman.oorjaman.com`                         |
| Distribution                                  | App Store + Google Play                             | **Internal** (EAS link, TestFlight, APK) - not public store |
| In-app banner                                 | none                                                | yellow **UAT - not production** strip                       |

Configured in `app.config.ts` (customer + technician) and `eas.json` profiles: `development`, `uat`, `production`.

### Environment files

| File                                                                                              | Use                      |
| ------------------------------------------------------------------------------------------------- | ------------------------ |
| `apps/customer-app/.env`                                                                          | Local Metro / dev client |
| `apps/technician-app/.env`                                                                        | Local Metro / dev client |
| [`.env.example`](apps/customer-app/.env.example) / [technician](apps/technician-app/.env.example) | Templates                |

**PROD** (`apps/customer-app/.env` for local testing against prod - rare):

```env
EXPO_PUBLIC_DEPLOY_ENV=production
EXPO_PUBLIC_SUPABASE_URL=https://<PROD_REF>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<prod_anon>
EXPO_PUBLIC_SITE_URL=https://oorjaman.com
# NO dummy auth
```

**UAT** (recommended for day-to-day QA):

```env
EXPO_PUBLIC_DEPLOY_ENV=uat
EXPO_PUBLIC_SUPABASE_URL=https://<UAT_REF>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<uat_anon>
EXPO_PUBLIC_SITE_URL=https://dev-oorjaman.oorjaman.com
EXPO_PUBLIC_USE_DUMMY_AUTH=true
EXPO_PUBLIC_DUMMY_OTP_CODE=123456
EXPO_PUBLIC_DUMMY_AUTH_PASSWORD=TestOtp123!
```

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
npm run customer    # from repo root - uses apps/customer-app/.env
npm run technician
```

Use a **development** EAS build (`eas build --profile development`) for push notifications and full native modules - Expo Go is not enough for production-like testing ([ENVIRONMENT.md](ENVIRONMENT.md)).

### Mobile ↔ Supabase ↔ web alignment

| Test flow      | Customer app                | Backend         | Web consoles                             |
| -------------- | --------------------------- | --------------- | ---------------------------------------- |
| UAT end-to-end | UAT build → UAT Supabase    | `oorjaman-uat`  | `dev-admin`, `dev-vendor`, `dev-support` |
| Production     | Store build → PROD Supabase | `oorjaman-prod` | `admin`, `vendor`, `support`             |

A **UAT customer app must not** point at production Supabase (and vice versa). Seed UAT users with root `.env` + `npm run seed:dummy-users` against the **UAT** service role key.

### Push notifications (both tiers)

Edge functions and Postgres `app.*_push_function_url` settings are **per Supabase project**. Deploy push functions to **both** UAT and PROD and use **separate** `PUSH_DISPATCH_SECRET` values if you want isolation.

UAT builds use the **`.uat` bundle IDs** - register separate FCM/APNs credentials in EAS for those IDs. See [docs/customer-push-setup.md](docs/customer-push-setup.md) and [docs/technician-push-setup.md](docs/technician-push-setup.md).

### Google Maps (customer app only)

Restrict API keys in Google Cloud Console:

- **PROD key:** iOS bundle `com.oorjaman.customer`, Android package `com.oorjaman.customer`
- **UAT key:** `com.oorjaman.customer.uat` (both platforms)

See [BILLING.md](BILLING.md).

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

### Production

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

### UAT

```bash
NEXT_PUBLIC_DEPLOY_ENV=uat NEXT_PUBLIC_SITE_URL=https://dev-oorjaman.oorjaman.com \
  npm run build:godaddy -w oorjaman-web

# UAT VITE_* in each app .env.uat or shell exports
npm run build -w admin-web
npm run build -w vendor-web
npm run build -w support-web
```

Upload to the four `dev-*` folders.

---

## Redeploy checklist

| Change                                           | Web                                             | Mobile (customer / technician)                                     |
| ------------------------------------------------ | ----------------------------------------------- | ------------------------------------------------------------------ |
| UI code only                                     | Rebuild + re-upload `dist/` or `out/`           | `eas build --profile uat` or `production`                          |
| Env (`VITE_*`, `NEXT_PUBLIC_*`, `EXPO_PUBLIC_*`) | Rebuild web                                     | **New EAS build** (env baked in)                                   |
| `app.config.ts` / bundle ID                      | -                                               | **New EAS build** + credentials if IDs changed                     |
| SQL migration                                    | `db:push` on UAT then PROD                      | Same - apps pick up schema on next API call                        |
| Edge function                                    | `functions:deploy` on matching Supabase project | Same                                                               |
| OTA JS-only fix (optional)                       | -                                               | `eas update --channel uat` / `production` if you enable EAS Update |
| Copy prod → UAT data                             | `pg_dump` / restore                             | Reinstall UAT app; no mobile redeploy required                     |

---

## Quick verification

| Check                                        | PROD                                 | UAT                           |
| -------------------------------------------- | ------------------------------------ | ----------------------------- |
| Marketing `robots.txt`                       | Allows crawl, lists sitemap          | `Disallow: /`                 |
| Login on admin portal                        | Prod Supabase project in Network tab | UAT project ref               |
| Cross-links                                  | Point to `*.oorjaman.com`            | Point to `dev-*.oorjaman.com` |
| Dummy auth (web + mobile)                    | Off                                  | Optional on for QA            |
| Customer app name on home screen             | **OorjaMan**                         | **OorjaMan (UAT)**            |
| Can install customer + UAT customer together | N/A (only prod on store phone)       | Yes - different bundle IDs    |
| Mobile yellow banner                         | Hidden                               | **UAT - not production**      |
| Legal link in customer app                   | `oorjaman.com`                       | `dev-oorjaman.oorjaman.com`   |

---

## Local development

Default: **localhost** + UAT or local Supabase - see [ENVIRONMENT.md](ENVIRONMENT.md). Portal ports: admin `5173`, vendor `5174`, support `5175`, marketing `3000`.

`NEXT_PUBLIC_DEPLOY_ENV` unset locally → treated as `local` (marketing pages can still be indexed in dev builds; use `uat` locally to test the non-SEO banner).

---

_Last updated: 2026-05-19 - 8 web hosts, customer/technician PROD/UAT EAS matrix, dual Supabase projects._
