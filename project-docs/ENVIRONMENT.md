# Environment & build configuration

Guide for **local development**, **UAT** (Vercel portals + UAT mobile), and **production** settings across the OorjaMan flagship monorepo.

**Do not commit real `.env` files.** Templates: per-app `*.example` → gitignored `*.local`. **Deployment matrix:** [**DEPLOYMENT.md**](DEPLOYMENT.md), [`.env.deployment.example`](../.env.deployment.example). **Vercel UAT portals:** [**VERCEL.md**](VERCEL.md). Paid services: [**BILLING.md**](BILLING.md).

---

## Deployment tiers (quick map)

| Tier | Web portals | Marketing | Mobile | Supabase |
| ---- | ----------- | --------- | ------ | -------- |
| **Local dev** | `localhost:5173–5175` · `.env.development.local` | `localhost:3000` | Metro · `.env.development.local` | **OorjaMan UAT** |
| **UAT (live)** | **Vercel** · env in Dashboard (or `.env.uat.local` for local `build:uat`) | GoDaddy `dev-oorjaman` (when deployed) | EAS `uat` / local APK · `env/uat.local` | **OorjaMan UAT** |
| **Production** | GoDaddy `admin/vendor/support` · `.env.production.local` | `oorjaman.com` | Store · EAS `production` | **OorjaMan Prod** |

**Live Vercel UAT URLs:** https://oorjaman-admin.vercel.app · https://oorjaman-vendor.vercel.app · https://oorjaman-support.vercel.app

---

## Principles

| Topic                        | Rule                                                                                                                                                              |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Where secrets live**       | Per-app `.env.development.local` (UAT/local) and `.env.production.local` (prod builds); repo-root `.env.uat.local` / `.env.production.local` for scripts. Never in git. |
| **Client vs server**         | `EXPO_PUBLIC_*` and `VITE_*` are embedded in the app at **build time** and are visible to users. Only the Supabase **anon** key belongs there-not `service_role`. |
| **Dev vs prod Supabase**     | Use a separate Supabase project (or branch) for production. Same variable names; different URLs and keys.                                                         |
| **Dummy auth**               | `*_USE_DUMMY_AUTH=true` is for **local QA only**. Must be **off** in production builds.                                                                           |
| **Rebuild after env change** | Expo native config (maps, push project id) and all `EXPO_PUBLIC_*` values require a **new native build**, not just Metro reload. Web: restart `vite` / redeploy.  |

---

## Where to put files

Each app uses **mode-specific** env files (gitignored `.local` copies hold real secrets; committed `*.example` are templates).

| File | When it loads | Supabase project |
|------|---------------|------------------|
| `apps/*/.env.development.local` | `npm run dev`, `npm run customer`, etc. | **OorjaMan UAT** |
| `apps/*/.env.uat.local` | `npm run build:uat -w <portal>` (local UAT build smoke test) | **OorjaMan UAT** |
| `apps/*/.env.production.local` | `npm run build` (Vite/Next prod mode) | **OorjaMan Prod** |
| `apps/<expo-app>/env/uat.local` | UAT APK / EAS via `run-with-expo-env.mjs` | **OorjaMan UAT** |
| `.env.uat.local` (repo root) | `npm run seed:dummy-users` (default) | **UAT** |
| `.env.production.local` (repo root) | `SEED_ENV=production npm run seed:dummy-users` | **Prod** |

**Vite portals** (`admin-web`, `vendor-web`, `support-web`): copy `.env.development.example`, `.env.uat.example`, and `.env.production.example` → matching `.local` files.

**Vercel (UAT portals live):** set the same `VITE_*` names in the **Vercel Dashboard** (Production + Preview). Vercel does not read local `.env.uat.local`. See [VERCEL.md](VERCEL.md).

---

## Checklists

### Local development (first time)

1. `npm install`
2. Create Supabase project (or run `supabase start` locally).
3. `npm run db:push` - apply migrations.
4. Copy each app’s `\.env.development.example` → `\.env.development.local` (UAT keys from Dashboard → OorjaMan UAT → API).
5. Copy root `\.env.uat.local.example` → `\.env.uat.local` (UAT `service_role` for scripts).
6. `npm run seed:dummy-users` — uses `\.env.uat.local` by default.
7. Run apps: `npm run customer`, `npm run technician`, `npm run admin`, etc.
8. (Optional) Customer maps + site photo stamps: `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` + native rebuild ([RUNNING-APPS.md — Site photos](RUNNING-APPS.md#customer-app--site-photos-camera-gps-stamp-upload), [BILLING.md](BILLING.md)).
9. (Optional) Customer remote push: EAS project id + edge function (see [Customer push](#customer-app--expo-push--notifications)).

### Production release

1. **Supabase production project** - migrations applied; RLS reviewed.
2. **Turn off dummy auth** on all mobile and web apps.
3. **Edge functions deployed** with production secrets.
4. **Database push dispatch** configured (customer support push).
5. **EAS production builds** for customer (and technician if shipping) with production `EXPO_PUBLIC_*`.
6. **Web portals** — UAT on Vercel today ([VERCEL.md](VERCEL.md)); production on GoDaddy with production `VITE_*` ([DEPLOYMENT.md](DEPLOYMENT.md)).
7. **Google Maps** key restricted to production bundle IDs / SHA-1 ([BILLING.md](BILLING.md)).
8. **Apple Developer** + APNs via EAS for iOS push ([Customer push](#customer-app--expo-push--notifications)).

---

## 1. Supabase (all apps)

Same logical project per environment; values differ between dev and prod.

| Variable         | Development           | Production                                              | Notes                        |
| ---------------- | --------------------- | ------------------------------------------------------- | ---------------------------- |
| Project URL      | Dev project URL       | Prod project URL                                        | Dashboard → Settings → API   |
| Anon key         | Dev anon key          | Prod anon key                                           | Safe in client apps with RLS |
| Service role key | Dev only, root `.env.uat.local` | **Server only** - Edge secrets, CI, never in mobile/web | Full DB access               |

**Exposed in clients as:**

| App type                                        | URL variable               | Anon key variable               |
| ----------------------------------------------- | -------------------------- | ------------------------------- |
| Expo (`customer-app`, `technician-app`)         | `EXPO_PUBLIC_SUPABASE_URL` | `EXPO_PUBLIC_SUPABASE_ANON_KEY` |
| Vite (`admin-web`, `vendor-web`, `support-web`) | `VITE_SUPABASE_URL`        | `VITE_SUPABASE_ANON_KEY`        |

**Auth (Dashboard):** Email provider enabled for OTP/password flows. Dummy auth still uses email+password under the hood-see dummy auth section.

---

## 2. Dummy OTP / password (QA only)

Skips real SMS; fixed OTP then password login. Must match `DUMMY_AUTH_PASSWORD` used by `npm run seed:dummy-users`.

| Variable                          | Development         | Production          |
| --------------------------------- | ------------------- | ------------------- |
| `EXPO_PUBLIC_USE_DUMMY_AUTH`      | `true` (optional)   | **omit or `false`** |
| `EXPO_PUBLIC_DUMMY_OTP_CODE`      | e.g. `123456`       | **omit**            |
| `EXPO_PUBLIC_DUMMY_AUTH_PASSWORD` | e.g. `TestOtp123!`  | **omit**            |
| `VITE_USE_DUMMY_AUTH`             | `true` (optional)   | **omit or `false`** |
| `VITE_DUMMY_OTP_CODE`             | e.g. `123456`       | **omit**            |
| `VITE_DUMMY_AUTH_PASSWORD`        | same as seed script | **omit**            |

**Apps:** `customer-app`, `technician-app`, `admin-web`, `vendor-web`, `support-web`.

**Production:** Use real Supabase phone/email auth; do not ship dummy flags.

---

## 3. Customer app (`apps/customer-app`)

**PROD vs UAT builds** (bundle IDs, EAS profiles, store vs internal): [**DEPLOYMENT.md**](DEPLOYMENT.md#mobile-apps--customer--technician-prod-vs-uat).

| Variable                          | Development         | UAT (EAS `uat` profile)             | Production (store)     | Required                        |
| --------------------------------- | ------------------- | ----------------------------------- | ---------------------- | ------------------------------- |
| `EXPO_PUBLIC_DEPLOY_ENV`          | `local`             | `uat`                               | `production`           | Yes for tiered builds           |
| `EXPO_PUBLIC_SUPABASE_URL`        | Dev / UAT URL       | UAT URL                             | Prod URL               | Yes                             |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY`   | Dev / UAT anon      | UAT anon                            | Prod anon              | Yes                             |
| `EXPO_PUBLIC_SITE_URL`            | localhost / dev web | `https://dev-oorjaman.oorjaman.com` | `https://oorjaman.com` | Legal links                     |
| `EXPO_PUBLIC_USE_DUMMY_AUTH`      | `true` optional     | `true` optional                     | **off**                | No                              |
| `EXPO_PUBLIC_DUMMY_OTP_*`         | QA values           | QA values                           | **omit**               | No                              |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | Dev-restricted key  | UAT bundle `*.customer.uat`         | Prod bundle            | Maps ([BILLING.md](BILLING.md)) |
| `EXPO_PUBLIC_EAS_PROJECT_ID`      | EAS project UUID    | Same                                | Same                   | For **remote push**             |

**Local run:** `npm run customer` (from repo root) or `npm start` in app folder.

**Development build (device, push, maps):**

```bash
cd apps/customer-app
npx eas init                    # once - links EAS project
# set EXPO_PUBLIC_EAS_PROJECT_ID in .env from eas.json / dashboard
npx eas build --profile development --platform ios   # or android
```

**UAT build (internal QA):**

```bash
cd apps/customer-app
# EAS secrets for UAT Supabase + EXPO_PUBLIC_DEPLOY_ENV=uat (see eas.json)
npx eas build --profile uat --platform all
```

**Production build (store):**

```bash
cd apps/customer-app
# EAS secrets: production Supabase + maps + EAS project id, NO dummy auth
npx eas build --profile production --platform all
```

Configure push credentials: `npx eas credentials` (APNs iOS, FCM Android).

### Customer app - Expo push & notifications

Support chat uses **local notifications** (app open/background) and **remote Expo push** (app killed).

| Layer                  | Development                                                                           | Production                               |
| ---------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------- |
| Client token           | Physical device + dev/prod build; set `EXPO_PUBLIC_EAS_PROJECT_ID`                    | Same; production EAS credentials         |
| Migrations             | `20260730130000_support_customer_unread.sql`, `20260731120000_customer_expo_push.sql` | Same on prod DB                          |
| Edge function          | `supabase functions deploy send-customer-expo-push`                                   | Deploy to **prod** project               |
| Edge secrets           | `PUSH_DISPATCH_SECRET`, optional `EXPO_ACCESS_TOKEN`                                  | Strong random secret; rotate if leaked   |
| DB dispatch (optional) | SQL `app.customer_push_function_url` + `app.push_dispatch_secret`                     | Prod function URL + same secret          |
| Cron fallback          | Dashboard cron → function every 1 min                                                 | Recommended if not using pg_net dispatch |

**Edge function secrets** (Supabase Dashboard → Edge Functions → Secrets):

| Secret                      | Required      | Purpose                      |
| --------------------------- | ------------- | ---------------------------- |
| `SUPABASE_URL`              | Auto-injected | -                            |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-injected | Process outbox, read tokens  |
| `PUSH_DISPATCH_SECRET`      | Yes           | Auth from DB trigger / cron  |
| `EXPO_ACCESS_TOKEN`         | Optional      | Higher Expo push rate limits |

**Postgres settings** (production SQL editor, once per project):

```sql
alter database postgres set app.customer_push_function_url = 'https://<PROJECT_REF>.supabase.co/functions/v1/send-customer-expo-push';
alter database postgres set app.push_dispatch_secret = '<same-as-PUSH_DISPATCH_SECRET>';
```

Detail: [docs/customer-push-setup.md](docs/customer-push-setup.md).

**Expo Go:** Push and native maps are limited; use an **EAS development build** for full testing.

### Admin / vendor booking alerts (in-app, real-time)

| Layer                            | Behavior                                                                                                                                     |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **In-app bell**                  | **Real-time** via Supabase Realtime on `notification_events` (`INSERT`) - no page refresh                                                    |
| **New booking / assign / float** | Fired when the booking action completes (API inserts `sent` in-app row)                                                                      |
| **Partner overdue (1h window)**  | **Automatic** every 5 min: `pg_cron` → `notify_overdue_vendor_responses_batch` (migration `20260733230000_vendor_response_overdue_cron.sql`) |
| **Cron fallback**                | Dashboard cron → `scan-vendor-response-overdue` every 5 min if `pg_cron` unavailable                                                         |
| **Email/SMS/WhatsApp**           | Queued; needs `process-notification-events` cron or Operations **Process queue**                                                             |

Deploy overdue scan function: `npm run functions:deploy -- scan-vendor-response-overdue`

Detail: [docs/booking-notifications-realtime.md](docs/booking-notifications-realtime.md).

---

## 4. Partner app (`apps/technician-app`)

**PROD vs UAT:** [**DEPLOYMENT.md**](DEPLOYMENT.md#mobile-apps--customer--technician-prod-vs-uat).

| Variable                        | Development | UAT      | Production   | Required |
| ------------------------------- | ----------- | -------- | ------------ | -------- |
| `EXPO_PUBLIC_DEPLOY_ENV`        | `local`     | `uat`    | `production` | Yes      |
| `EXPO_PUBLIC_SUPABASE_URL`      | Dev / UAT   | UAT      | Prod         | Yes      |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Dev / UAT   | UAT      | Prod         | Yes      |
| `EXPO_PUBLIC_USE_DUMMY_AUTH`    | optional    | optional | **off**      | No       |
| `EXPO_PUBLIC_DUMMY_OTP_*`       | QA          | QA       | **omit**     | No       |
| `EXPO_PUBLIC_EAS_PROJECT_ID`    | EAS UUID    | EAS UUID | EAS UUID     | Push     |

**Local run:** `npm run technician`.

**UAT build:** `npx eas build --profile uat --platform all`  
**Production build:** `npx eas build --profile production --platform all` (+ `eas credentials` for prod and `.uat` bundle IDs).

### Partner app - Expo push & notifications

Support chat uses **local notifications** (app open/background) and **remote Expo push** (app killed).

| Layer                  | Development                                                             | Production                                      |
| ---------------------- | ----------------------------------------------------------------------- | ----------------------------------------------- |
| Client token           | Physical device + dev/prod build; set `EXPO_PUBLIC_EAS_PROJECT_ID`      | Same; production EAS credentials                |
| Migrations             | `20260732120000_support_technician_audience.sql` (includes push tables) | Same on prod DB                                 |
| Edge function          | `npm run functions:deploy -- send-technician-expo-push`                 | Deploy to **prod** project                      |
| Edge secrets           | `PUSH_DISPATCH_SECRET`, optional `EXPO_ACCESS_TOKEN`                    | Same secret as customer function on one project |
| DB dispatch (optional) | SQL `app.technician_push_function_url` + `app.push_dispatch_secret`     | Prod function URL + same secret                 |
| Cron fallback          | Dashboard cron → function every 1 min                                   | Recommended if not using pg_net dispatch        |

**Postgres settings** (production SQL editor, once per project):

```sql
alter database postgres set app.technician_push_function_url = 'https://<PROJECT_REF>.supabase.co/functions/v1/send-technician-expo-push';
alter database postgres set app.push_dispatch_secret = '<same-as-PUSH_DISPATCH_SECRET>';
```

Detail: [docs/technician-push-setup.md](docs/technician-push-setup.md).

**Expo Go:** Push is limited; use an **EAS development build** for full testing.

---

## 5. Web apps (Vite portals)

Shared pattern for `admin-web`, `vendor-web`, `support-web`.

| Variable | Local dev | UAT (Vercel / `build:uat`) | Production (GoDaddy) | Required |
| -------- | --------- | ---------------------------- | -------------------- | -------- |
| `VITE_DEPLOY_ENV` | `uat` | `uat` | `production` | Yes |
| `VITE_SUPABASE_URL` | UAT URL | UAT URL | Prod URL | Yes |
| `VITE_SUPABASE_ANON_KEY` | UAT anon | UAT anon | Prod anon | Yes |
| `VITE_USE_DUMMY_AUTH` | `true` optional | `true` optional (Vercel QA) | **off** | No |
| `VITE_ADMIN_PORTAL_URL` | `http://localhost:5173` | `https://oorjaman-admin.vercel.app` | `https://admin.oorjaman.com` | Cross-links |
| `VITE_VENDOR_PORTAL_URL` | `http://localhost:5174` | `https://oorjaman-vendor.vercel.app` | `https://vendor.oorjaman.com` | Cross-links |
| `VITE_SUPPORT_PORTAL_URL` | `http://localhost:5175` | `https://oorjaman-support.vercel.app` | `https://support.oorjaman.com` | Cross-links |

**Local ports (default):**

| App     | Command           | URL                   |
| ------- | ----------------- | --------------------- |
| Admin   | `npm run admin`   | http://localhost:5173 |
| Vendor  | `npm run vendor`  | http://localhost:5174 |
| Support | `npm run support` | http://localhost:5175 |

**UAT build (Vercel or local verify):**

```bash
npm run build:uat -w admin-web    # uses apps/admin-web/.env.uat.local if present
npm run build:uat -w vendor-web
npm run build:uat -w support-web
# output: apps/<app>/dist
```

**Production build (GoDaddy):**

```bash
npm run build -w admin-web    # uses .env.production.local
```

Set `VITE_*` in **Vercel Dashboard** for deployed UAT — values are embedded at build time, not read at runtime.

---

## 6. Repo root (scripts only)

| Variable                    | Development                | Production        | Notes                                      |
| --------------------------- | -------------------------- | ----------------- | ------------------------------------------ |
| `SUPABASE_URL`              | Dev/prod URL               | Prod URL          | `npm run seed:dummy-users`, repair scripts |
| `SUPABASE_SERVICE_ROLE_KEY` | Dev service role           | Prod service role | **Never** in client apps                   |
| `DUMMY_AUTH_PASSWORD`       | Matches app dummy password | N/A in prod       | Seed script only                           |

---

## 7. Supabase Edge Functions (server secrets)

Set per Supabase project (dev vs prod separately).

### `send-customer-expo-push`

| Secret                 | Dev           | Prod               |
| ---------------------- | ------------- | ------------------ |
| `PUSH_DISPATCH_SECRET` | Random string | Unique prod secret |
| `EXPO_ACCESS_TOKEN`    | Optional      | Optional           |

Deploy: `npm run functions:deploy -- send-customer-expo-push` (see [Useful scripts](#useful-scripts) in README)

Detail: [docs/customer-push-setup.md](docs/customer-push-setup.md).

### `send-technician-expo-push`

| Secret                 | Dev                                           | Prod               |
| ---------------------- | --------------------------------------------- | ------------------ |
| `PUSH_DISPATCH_SECRET` | Random string (shared with customer function) | Unique prod secret |
| `EXPO_ACCESS_TOKEN`    | Optional                                      | Optional           |

Deploy: `npm run functions:deploy -- send-technician-expo-push`

Postgres (in addition to customer URL if both apps are live):

```sql
alter database postgres set app.technician_push_function_url = 'https://<PROJECT_REF>.supabase.co/functions/v1/send-technician-expo-push';
```

Detail: [docs/technician-push-setup.md](docs/technician-push-setup.md).

### `process-notification-events`

| Secret                            | Dev         | Prod                             | Default |
| --------------------------------- | ----------- | -------------------------------- | ------- |
| `NOTIFICATION_DELIVERY_MODE`      | `demo`      | `live` when real providers wired | `demo`  |
| `NOTIFICATION_DEMO_FAIL_CHANNELS` | Optional QA | **omit**                         | -       |
| `NOTIFICATION_DEMO_FAIL_RATE`     | Optional QA | **omit**                         | `0`     |

Admin-only invoke; processes `notification_events` queue (in-app/email/sms adapters in demo mode today).

### `approve-vendor-intake`

Uses auto-injected `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`. No extra client env vars.

---

## 8. EAS / CI environment (mobile apps)

For cloud builds, prefer **EAS Secrets** over committing `.env`.

**Customer app:**

```bash
cd apps/customer-app
eas secret:create --name EXPO_PUBLIC_SUPABASE_URL --value "https://..."
eas secret:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "..."
eas secret:create --name EXPO_PUBLIC_EAS_PROJECT_ID --value "..."
eas secret:create --name EXPO_PUBLIC_GOOGLE_MAPS_API_KEY --value "..."
```

**Partner app:**

```bash
cd apps/technician-app
eas secret:create --name EXPO_PUBLIC_SUPABASE_URL --value "https://..."
eas secret:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "..."
eas secret:create --name EXPO_PUBLIC_EAS_PROJECT_ID --value "..."
```

Use **development**, **preview**, and **production** EAS build profiles (`eas.json`) to scope which secrets apply. Do not set dummy auth secrets on production profile.

---

## 9. Database & migrations

| Task             | Command                    | When                                        |
| ---------------- | -------------------------- | ------------------------------------------- |
| Apply migrations | `npm run db:push`          | After pull, before testing new features     |
| Seed test users  | `npm run seed:dummy-users` | Dev/UAT only; needs service role in root `.env.uat.local` |
| Local Supabase   | `npm run db:status`        | Optional local stack                        |

Production: run migrations against the **production** project only from a controlled CI/CD or release process-never point a dev `.env` at prod for seed scripts.

---

## Quick reference - all client env vars

| Variable                          | Apps                   | Dev             | Prod                |
| --------------------------------- | ---------------------- | --------------- | ------------------- |
| `EXPO_PUBLIC_SUPABASE_URL`        | customer, technician   | Dev project     | Prod project        |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY`   | customer, technician   | Dev anon        | Prod anon           |
| `EXPO_PUBLIC_USE_DUMMY_AUTH`      | customer, technician   | optional `true` | **off**             |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | customer               | Dev key         | Restricted prod key |
| `EXPO_PUBLIC_EAS_PROJECT_ID`      | customer, technician   | EAS UUID        | EAS UUID            |
| `VITE_SUPABASE_URL`               | admin, vendor, support | Dev             | Prod                |
| `VITE_SUPABASE_ANON_KEY`          | admin, vendor, support | Dev             | Prod                |
| `VITE_USE_DUMMY_AUTH`             | admin, vendor, support | optional `true` | **off**             |
| `VITE_*_PORTAL_URL`               | web cross-links        | localhost ports | Vercel `.vercel.app` (UAT) → GoDaddy prod |

---

## Related docs

- [README.md](README.md) — monorepo overview and run commands
- [DEPLOYMENT.md](DEPLOYMENT.md) — full PROD vs UAT matrix
- [VERCEL.md](VERCEL.md) — live UAT portal deployment
- [.env.deployment.example](../.env.deployment.example) — copy-paste matrix (no secrets)
- [BILLING.md](BILLING.md) — Google Maps and other paid APIs
- [docs/customer-push-setup.md](docs/customer-push-setup.md) — customer support chat remote push
- [docs/technician-push-setup.md](docs/technician-push-setup.md) — technician support chat remote push

_Last updated: 2026-05-20 — three-tier env files, Vercel UAT portals live._
