# OorjaMan Flagship

OorjaMan is a solar rooftop care platform: homeowners and businesses book cleaning and maintenance visits, partners (vendors) fulfil work through their technicians, and platform operators run pricing, approvals, and operations from web consoles. This repository is the **flagship monorepo** - all customer-facing mobile apps, partner/ops web portals, shared TypeScript packages, and Supabase schema live here.

## What the platform does

| Audience               | App                                  | Role                                                                                                                                                                                                                               |
| ---------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Customers**          | `customer-app` (Expo, iOS/Android)   | Register a site, save service addresses and site photos, book one-off or AMC visits, pick preferred partners, pay, track technicians, chat with support - **store (PROD)** and **UAT** binaries per [DEPLOYMENT.md](DEPLOYMENT.md) |
| **Field partners**     | `technician-app` (Expo, iOS/Android) — **OorjaMan Partner** | View assigned jobs, navigate to sites, run visit workflows (safety checks, evidence photos, OTP/happy codes), share live location during active visits - **PROD / UAT** builds per [DEPLOYMENT.md](DEPLOYMENT.md)                  |
| **Partners / vendors** | `vendor-web` (Vite)                  | Manage technicians, accept or reject booking requests, marketplace jobs, subscriptions, documents, and day-to-day partner operations                                                                                               |
| **Platform admins**    | `admin-web` (Vite)                   | Vendor approval, pricing & capacity catalog, booking monitoring, analytics, notifications, routing defaults, technician verification                                                                                               |
| **Support desk**       | `support-web` (Vite)                 | Inbox for customer chats, insights, customer search with booking context, floating chat dock for active conversations                                                                                                              |
| **Public website**     | `oorjaman-web` (Next.js)             | Marketing, SEO, legal policies at **https://oorjaman.com** - UAT at **dev-oorjaman.oorjaman.com** (noindex) - see [**DEPLOYMENT.md**](DEPLOYMENT.md), [**SEO.md**](SEO.md)                                                         |

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
│   ├── ui/                # React Native components & mobile shell helpers
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
├── DEPLOYMENT.md          # 8 hosts (4 PROD + 4 UAT), GoDaddy, dual Supabase
├── VERCEL.md              # Deploy admin/vendor/support portals to Vercel (testing)
├── SUPABASE-UAT-PROD.md   # OorjaMan UAT vs Prod: migrations, RLS, db push workflow
├── ENVIRONMENT.md         # Dev vs production env & build settings (all apps)
└── BILLING.md             # Third-party services & API keys checklist
```

## Tech stack

- **Monorepo:** npm workspaces (`apps/*`, `packages/*`)
- **Mobile:** Expo SDK 54, Expo Router, React Native, TanStack Query
- **Web:** React 19, Vite 6, React Router, TanStack Query
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

- **Full guide (dev vs production, all apps):** [**ENVIRONMENT.md**](ENVIRONMENT.md)
- **Templates:** [`.env.example`](.env.example) → per-app `.env` and optional repo-root `.env` for seed scripts
- **Paid APIs (maps, etc.):** [BILLING.md](BILLING.md)

### 3. Database

**Source of truth:** `supabase/migrations/*.sql`. Deploy schema, RLS, views, and cron to Supabase with `db push` - not by pasting `schema.sql` in the dashboard.

Apply migrations to your linked Supabase project:

```bash
npm run db:push          # interactive
# or
npm run db:push:yes      # non-interactive
```

**UAT + Prod:** use two Supabase projects (current **OorjaMan** → UAT, new **OorjaMan Prod**). Push the same migrations to both - UAT first, then Prod. See [**SUPABASE-UAT-PROD.md**](SUPABASE-UAT-PROD.md).

Seed local test users (requires root `.env` with `SUPABASE_SERVICE_ROLE_KEY`):

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

| Command              | App               | Typical URL / target                             |
| -------------------- | ----------------- | ------------------------------------------------ |
| `npm run customer`   | Customer mobile   | Expo dev tools → iOS/Android simulator or device |
| `npm run technician` | Partner mobile (OorjaMan Partner) | Same                                             |
| `npm run admin`      | Admin web         | http://localhost:5173                            |
| `npm run vendor`     | Vendor web        | http://localhost:5174                            |
| `npm run support`    | Support web       | http://localhost:5175                            |

Before mobile `typecheck` or after a clean clone, regenerate Expo Router types:

```bash
npm run expo:types
```

## Useful scripts

| Script                               | Description                                                   |
| ------------------------------------ | ------------------------------------------------------------- |
| `npm run typecheck`                  | Typecheck all workspaces (mobile apps run `expo:types` first) |
| `npm run lint`                       | Lint where configured per workspace                           |
| `npm run build`                      | Production build for all three web apps                       |
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
- `@oorjaman/ui` - mobile UI (Screen, modals, offline gate, splash helpers, …)
- `@oorjaman/web-ui` - web UI (buttons, cards, page headers, …)
- `@oorjaman/utils` - booking slots, IST date helpers, etc.

## Documentation

- [**SUPABASE-UAT-PROD.md**](SUPABASE-UAT-PROD.md) - dual Supabase projects, `db push` workflow, keeping `schema.sql` / `policies.sql` in sync
- [**DEPLOYMENT.md**](DEPLOYMENT.md) - PROD vs UAT web hosts, mobile EAS builds, GoDaddy
- [**VERCEL.md**](VERCEL.md) - deploy admin, vendor, and support portals to Vercel for testing (env vars, Supabase setup)
- [**ENVIRONMENT.md**](ENVIRONMENT.md) - environment variables and settings for **development** vs **production** builds (mobile, web, Supabase, push)
- [**BILLING.md**](BILLING.md) - paid third-party services (e.g. Google Maps), env vars, and setup notes
- [**docs/customer-push-setup.md**](docs/customer-push-setup.md) - customer support chat remote push (Expo + edge function)
- [**docs/technician-push-setup.md**](docs/technician-push-setup.md) - technician support chat remote push (Expo + edge function)
- Per-app READMEs under `apps/*` are mostly upstream templates; this file is the project overview

## License

Private - OorjaMan. All rights reserved unless otherwise noted in the repository.
