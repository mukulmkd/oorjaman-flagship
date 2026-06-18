# OorjaMan Flagship

OorjaMan is a solar rooftop care platform: homeowners and businesses book cleaning and maintenance visits, partners (vendors) fulfil work through their technicians, and platform operators run pricing, approvals, and operations from web consoles. This repository is the **flagship monorepo** - all customer-facing mobile apps, partner/ops web portals, shared TypeScript packages, and Supabase schema live here.

## What the platform does

| Audience               | App                                  | Role                                                                                                                                                                                                                               |
| ---------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Customers**          | `customer-app` (Expo, iOS/Android)   | Register a site, save service addresses and site photos, book one-off or AMC visits, pick preferred partners, pay, track technicians, chat with support - **store (PROD)** and **UAT** binaries per [DEPLOYMENT.md](project-docs/DEPLOYMENT.md) |
| **Field partners**     | `technician-app` (Expo, iOS/Android) — **OorjaMan Partner** | View assigned jobs, navigate to sites, run visit workflows (safety checks, evidence photos, OTP/happy codes), share live location during active visits - **PROD / UAT** builds per [DEPLOYMENT.md](project-docs/DEPLOYMENT.md)                  |
| **Partners / vendors** | `vendor-web` (Vite)                  | Manage technicians, accept or reject booking requests, marketplace jobs, subscriptions, documents, and day-to-day partner operations                                                                                               |
| **Platform admins**    | `admin-web` (Vite)                   | Vendor approval, pricing & capacity catalog, booking monitoring, analytics, notifications, routing defaults, technician verification                                                                                               |
| **Support desk**       | `support-web` (Vite)                 | Inbox for customer chats, insights, customer search with booking context, floating chat dock for active conversations                                                                                                              |
| **Public website**     | `oorjaman-web` (Next.js)             | Marketing, SEO, legal policies at **https://oorjaman.com** - UAT at **dev-oorjaman.oorjaman.com** (noindex) - see [**DEPLOYMENT.md**](project-docs/DEPLOYMENT.md), [**SEO.md**](project-docs/SEO.md)                                                         |

Backend data and auth are provided by **Supabase** (Postgres, Row Level Security, Realtime, Storage, Edge Functions). Business logic shared across apps lives in `packages/api`; UI tokens and components live in `packages/config`, `packages/ui` (mobile), and `packages/web-ui` (web).

## Repository layout

```
oorjaman-flagship/
├── apps/
│   ├── customer-app/      # Expo Router - customer mobile
│   ├── technician-app/    # Expo Router - OorjaMan Partner mobile
│   ├── admin-web/         # React + Vite - admin portal
│   ├── vendor-web/        # React + Vite - partner portal
│   ├── support-web/       # React + Vite - support desk
│   └── oorjaman-web/      # Next.js - public marketing & legal (oorjaman.com)
├── packages/
│   ├── api/               # Supabase clients, domain APIs, query keys, types
│   ├── config/            # Colors, spacing, typography (shared design tokens)
│   ├── mobile-deps/       # Shared Expo/RN dependencies (customer + technician apps)
│   ├── mobile-config/     # Shared Expo plugins, Metro, native rebuild scripts
│   ├── portal-deps/       # Shared Vite portal dependencies (admin/vendor/support)
│   ├── ui/                # React Native components & mobile shell helpers
│   ├── vite-portal-config/ # Shared Vite/ESLint/TS config (admin/vendor/support)
│   ├── web-ui/            # React web components (admin/vendor/support)
│   └── utils/             # Date/time, booking slots, shared pure helpers
├── supabase/
│   ├── migrations/        # SQL migrations (source of truth for schema)
│   ├── functions/         # Edge functions (e.g. notifications, vendor intake)
│   ├── schema.sql         # Reference schema (npm run db:reference)
│   ├── policies.sql       # Reference RLS (npm run db:reference)
│   └── policies-base.sql  # Core RLS helpers prepended to policies.sql
├── scripts/               # DB seed, repair, push helpers
├── .env.example           # Env templates (copy per app)
├── .env.deployment.example # PROD vs UAT URL + Supabase matrix (no secrets)
├── project-docs/          # Deployment, env, billing, run guides, test Word docs (see project-docs/README.md)
│   ├── README.md          # Index of all project-level docs
│   ├── RUNNING-APPS.md    # All run modes: local, debug, UAT, prod, Expo Go
│   ├── DEPLOYMENT.md      # PROD vs UAT matrix
│   ├── VERCEL.md          # UAT admin/vendor/support on Vercel
│   ├── SUPABASE-UAT-PROD.md
│   ├── ENVIRONMENT.md
│   ├── BILLING.md
│   ├── SECURITY-VERCEL.md
│   ├── SEO.md
│   ├── EMAILS.md
│   ├── TODO.md
│   ├── OorjaMan-Functional-Test-Spec.docx
│   └── OorjaMan-E2E-Test-Guide.docx
```

## Tech stack

- **Monorepo:** npm workspaces (`apps/*`, `packages/*`)
- **Mobile:** Expo SDK 56, Expo Router, React Native 0.85, TanStack Query
- **Web:** React 19, Vite 8, React Router, TanStack Query
- **Backend:** Supabase (Postgres + Auth + Realtime + Storage)
- **Language:** TypeScript throughout

**Requirements:** Node.js **≥ 20**

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Do **not** commit real `.env` files.

- **Full guide:** [**ENVIRONMENT.md**](project-docs/ENVIRONMENT.md)
- **Templates:** per-app `*.example` → gitignored `*.local` (see [Where to put files](project-docs/ENVIRONMENT.md#where-to-put-files))
- **UAT portals on Vercel:** set `VITE_*` in Vercel Dashboard — [VERCEL.md](project-docs/VERCEL.md)
- **Scripts (seed):** root `.env.uat.local` from [`.env.uat.local.example`](.env.uat.local.example)
- **Paid APIs:** [BILLING.md](project-docs/BILLING.md)

### 3. Database

**Source of truth:** `supabase/migrations/*.sql`. Deploy schema, RLS, views, and cron to Supabase with `db push` - not by pasting `schema.sql` in the dashboard.

Apply migrations to your linked Supabase project:

```bash
npm run db:push          # interactive
# or
npm run db:push:yes      # non-interactive
```

**UAT + Prod:** use two Supabase projects (current **OorjaMan** → UAT, new **OorjaMan Prod**). Push the same migrations to both - UAT first, then Prod. See [**SUPABASE-UAT-PROD.md**](project-docs/SUPABASE-UAT-PROD.md).

Seed local test users (requires root `.env.uat.local` with `SUPABASE_SERVICE_ROLE_KEY`):

```bash
npm run seed:dummy-users
```

### Database reference files (`schema.sql` & `policies.sql`)

`supabase/schema.sql` and `supabase/policies.sql` are **read-only snapshots** generated from migrations. Use them to review the full design, onboard developers, or bootstrap a blank database manually (`schema.sql` → `policies.sql` → `storage.sql`).

| File | Role |
|------|------|
| `supabase/migrations/` | **Authoritative** - every schema / RLS / view change |
| `supabase/schema.sql` | Generated tables, views, functions, triggers |
| `supabase/policies.sql` | Generated RLS policies + storage policies |
| `supabase/policies-base.sql` | Core RLS helpers (`is_admin`, `my_*`, …) prepended when regenerating |

Regenerate after adding or changing migrations:

```bash
npm run db:reference
git add supabase/schema.sql supabase/policies.sql
```

**Do not** edit `schema.sql` or `policies.sql` by hand for structural changes. Add a migration, then run `db:reference`.

| Change | Action |
|--------|--------|
| Schema, RLS, view, cron | New file under `supabase/migrations/` |
| Keep reference SQL in sync | `npm run db:reference` and commit |
| Deploy to UAT / Prod | `supabase link --project-ref <REF>` → `npm run db:push` (UAT first) |
| Edge functions | `npm run functions:deploy -- <name>` per Supabase project |

### 4. Run apps

**Full guide (all modes):** [**RUNNING-APPS.md**](project-docs/RUNNING-APPS.md) — local Metro, Expo Go, debug native + device logs, UAT APK, EAS UAT/prod, Android & iOS for **customer** and **partner** apps.

#### Web (local)

| Command              | App               | URL / target                         |
| -------------------- | ----------------- | ------------------------------------ |
| `npm run admin`      | Admin web         | http://localhost:5173              |
| `npm run vendor`     | Vendor web        | http://localhost:5174                |
| `npm run support`    | Support web       | http://localhost:5175                |
| `npm run web`        | Marketing site    | http://localhost:3000                |

**UAT portals (deployed):** https://oorjaman-admin.vercel.app · https://oorjaman-vendor.vercel.app · https://oorjaman-support.vercel.app — [VERCEL.md](project-docs/VERCEL.md).

#### Mobile — quick pick

| Goal | Customer | Partner |
|------|----------|---------|
| **Metro** (fast JS) | `npm run customer` | `npm run technician` |
| **Debug on device + terminal logs** | `cd apps/customer-app && npx expo run:android --device` | `cd apps/technician-app && npx expo run:android --device` |
| **Clean native rebuild** | `npm run ios:rebuild` / `npm run android:rebuild` | `npm run technician:ios:rebuild` / `npm run technician:android:rebuild` |
| **iOS Simulator** | `cd apps/customer-app && npx expo run:ios` | `cd apps/technician-app && npx expo run:ios` |
| **UAT APK** (share, no laptop) | `npm run android:apk:uat:customer` | `npm run android:apk:uat:technician` |
| **UAT EAS** | `npm run eas:android:uat:customer` | `npm run eas:android:uat:technician` |
| **Store / prod** | `cd apps/customer-app && npx eas-cli build --profile production --platform all` | same in `technician-app` |

**Env:** local Metro → `apps/<app>/.env.development.local` · UAT APK/EAS → `apps/<app>/env/uat.local` · see [ENVIRONMENT.md](project-docs/ENVIRONMENT.md).

**Expo Go** (scan QR from Metro) is **not** enough for camera, maps, or push — use `expo run:*` or a UAT/production native build ([RUNNING-APPS.md](project-docs/RUNNING-APPS.md#expo-go-vs-development-build)).

**Android USB logs:** `adb reverse tcp:8081 tcp:8081` then run the app. Setup: [RUNNING-APPS.md](project-docs/RUNNING-APPS.md#android--customer-app).

Before mobile `typecheck` or after a clean clone:

```bash
npm run expo:types
```

## Useful scripts

| Script                               | Description                                                   |
| ------------------------------------ | ------------------------------------------------------------- |
| `npm run typecheck`                  | Typecheck all workspaces (mobile apps run `expo:types` first) |
| `npm run lint`                       | Lint where configured per workspace                           |
| `npm run build`                      | Production build for all web apps (portals prod mode + marketing) |
| `npm run build:uat -w admin-web`     | UAT portal build (same as Vercel)                                 |
| `npm run android:apk:uat:customer` / `technician` | UAT release APK (embedded JS, share with QA) |
| `npm run eas:android:uat:customer` / `technician` | UAT EAS Android build (cloud) |
| `npm run seed:dummy-users`           | UAT test users (root `.env.uat.local`)                            |
| `npm run db:push` / `db:push:yes`    | Apply `supabase/migrations/` to the linked Supabase project   |
| `npm run db:reference`               | Regenerate `schema.sql` and `policies.sql` from migrations      |
| `npm run db:status`                  | Local Supabase CLI status                                     |
| `npm run functions:deploy -- <name>` | Deploy one edge function from `supabase/functions/<name>`     |
| `npm run repair:public-users`        | Repair script for auth/public user sync issues                |
| `npm run typecheck:edge-functions`   | Typecheck `supabase/functions`                                |

## Shared packages

Import from workspace packages in apps (no publish step in dev):

- `@oorjaman/api` - bookings, customers, vendors, technicians, subscriptions, support desk, payments, notifications
- `@oorjaman/config` - design tokens
- `@oorjaman/mobile-deps` - shared Expo/RN stack for **customer-app** and **technician-app** (bump SDK versions here)
- `@oorjaman/mobile-config` - shared Expo plugins, Metro config, and native rebuild scripts for both mobile apps
- `@oorjaman/portal-deps` - shared Vite portal stack for **admin-web**, **vendor-web**, and **support-web**
- `@oorjaman/ui` - mobile UI (Screen, modals, offline gate, splash helpers, …)
- `@oorjaman/vite-portal-config` - shared Vite/ESLint/TS for **admin-web**, **vendor-web**, **support-web**
- `@oorjaman/web-ui` - web UI primitives plus shared portal shell (Supabase provider, session gates, notifications, document viewer, …)
- `@oorjaman/utils` - booking slots, IST date helpers, etc.

## Documentation

Project-level guides live in [**project-docs/**](project-docs/README.md). The root [README.md](README.md) links the essentials; see the index for the full list.

| Doc | Purpose |
| --- | ------- |
| [DEPLOYMENT.md](project-docs/DEPLOYMENT.md) | PROD vs UAT matrix: **Vercel UAT portals (live)**, GoDaddy target, mobile EAS |
| [VERCEL.md](project-docs/VERCEL.md) | Three Vercel projects, env vars, Supabase auth URLs |
| [SUPABASE-UAT-PROD.md](project-docs/SUPABASE-UAT-PROD.md) | Dual Supabase projects, `db:push`, migration workflow |
| [ENVIRONMENT.md](project-docs/ENVIRONMENT.md) | All env vars: local / UAT / production |
| [BILLING.md](project-docs/BILLING.md) | Supabase, Vercel, EAS, Maps, Apple/Google store |
| [SECURITY-VERCEL.md](project-docs/SECURITY-VERCEL.md) | Portal + Supabase security on Vercel |
| [SEO.md](project-docs/SEO.md) | Marketing site SEO & GoDaddy deploy |
| [EMAILS.md](project-docs/EMAILS.md) | Business email setup & DNS |
| [RUNNING-APPS.md](project-docs/RUNNING-APPS.md) | **All run modes:** local, debug, UAT, prod, Expo Go — Android & iOS |
| [TODO.md](project-docs/TODO.md) | Release & ops checklist |
| [docs/android-local-apk.md](docs/android-local-apk.md) | UAT APK without EAS cloud |
| [docs/ios-qa-distribution.md](docs/ios-qa-distribution.md) | UAT iOS on physical devices (EAS internal) |
| [docs/customer-push-setup.md](docs/customer-push-setup.md) | Customer support push |
| [docs/technician-push-setup.md](docs/technician-push-setup.md) | Partner support push |
| [docs/booking-notifications-realtime.md](docs/booking-notifications-realtime.md) | Admin/vendor realtime bells |
| Per-app [README.md](apps/admin-web/README.md) under `apps/*` | Quick start per app |

## License

Private - OorjaMan. All rights reserved unless otherwise noted in the repository.
