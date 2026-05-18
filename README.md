# OorjaMan Flagship

OorjaMan is a solar rooftop care platform: homeowners and businesses book cleaning and maintenance visits, partners (vendors) fulfil work through their technicians, and platform operators run pricing, approvals, and operations from web consoles. This repository is the **flagship monorepo** — all customer-facing mobile apps, partner/ops web portals, shared TypeScript packages, and Supabase schema live here.

## What the platform does

| Audience | App | Role |
|----------|-----|------|
| **Customers** | `customer-app` (Expo, iOS/Android) | Register a site, save service addresses and site photos, book one-off or AMC visits, pick preferred partners, pay, track technicians, chat with support |
| **Technicians** | `technician-app` (Expo, iOS/Android) | View assigned jobs, navigate to sites, run visit workflows (safety checks, evidence photos, OTP/happy codes), share live location during active visits |
| **Partners / vendors** | `vendor-web` (Vite) | Manage technicians, accept or reject booking requests, marketplace jobs, subscriptions, documents, and day-to-day partner operations |
| **Platform admins** | `admin-web` (Vite) | Vendor approval, pricing & capacity catalog, booking monitoring, analytics, notifications, routing defaults, technician verification |
| **Support desk** | `support-web` (Vite) | Inbox for customer chats, insights, customer search with booking context, floating chat dock for active conversations |

Backend data and auth are provided by **Supabase** (Postgres, Row Level Security, Realtime, Storage, Edge Functions). Business logic shared across apps lives in `packages/api`; UI tokens and components live in `packages/config`, `packages/ui` (mobile), and `packages/web-ui` (web).

## Repository layout

```
oorjaman-flagship/
├── apps/
│   ├── customer-app/      # Expo Router — customer mobile
│   ├── technician-app/    # Expo Router — technician mobile
│   ├── admin-web/         # React + Vite — admin portal
│   ├── vendor-web/        # React + Vite — partner portal
│   └── support-web/       # React + Vite — support desk
├── packages/
│   ├── api/               # Supabase clients, domain APIs, query keys, types
│   ├── config/            # Colors, spacing, typography (shared design tokens)
│   ├── ui/                # React Native components & mobile shell helpers
│   ├── web-ui/            # React web components (admin/vendor/support)
│   └── utils/             # Date/time, booking slots, shared pure helpers
├── supabase/
│   ├── migrations/        # SQL migrations (source of truth for schema)
│   ├── functions/         # Edge functions (e.g. notifications, vendor intake)
│   └── schema.sql         # Reference / bootstrap schema
├── scripts/               # DB seed, repair, push helpers
├── .env.example           # Env template (copy per app — see below)
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

Do **not** commit real `.env` files. Use templates:

- Root: copy [`.env.example`](.env.example) → `.env` (mainly for `npm run seed:dummy-users`)
- Mobile: `apps/customer-app/.env`, `apps/technician-app/.env` — `EXPO_PUBLIC_SUPABASE_*` and optional dummy-auth flags
- Web: `apps/admin-web/.env`, `apps/vendor-web/.env`, `apps/support-web/.env` — `VITE_SUPABASE_*`
- Admin also has `apps/admin-web/.env.example`

See `.env.example` for dummy OTP/password QA settings and support seed phone numbers.

### 3. Database

Apply migrations to your Supabase project:

```bash
npm run db:push          # interactive
# or
npm run db:push:yes      # non-interactive
```

Seed local test users (requires root `.env` with `SUPABASE_SERVICE_ROLE_KEY`):

```bash
npm run seed:dummy-users
```

### 4. Run apps

| Command | App | Typical URL / target |
|---------|-----|-------------------|
| `npm run customer` | Customer mobile | Expo dev tools → iOS/Android simulator or device |
| `npm run technician` | Technician mobile | Same |
| `npm run admin` | Admin web | http://localhost:5173 |
| `npm run vendor` | Vendor web | http://localhost:5174 |
| `npm run support` | Support web | http://localhost:5175 |

Before mobile `typecheck` or after a clean clone, regenerate Expo Router types:

```bash
npm run expo:types
```

## Useful scripts

| Script | Description |
|--------|-------------|
| `npm run typecheck` | Typecheck all workspaces (mobile apps run `expo:types` first) |
| `npm run lint` | Lint where configured per workspace |
| `npm run build` | Production build for all three web apps |
| `npm run db:status` | Local Supabase CLI status |
| `npm run repair:public-users` | Repair script for auth/public user sync issues |
| `npm run typecheck:edge-functions` | Typecheck `supabase/functions` |

## Shared packages

Import from workspace packages in apps (no publish step in dev):

- `@oorjaman/api` — bookings, customers, vendors, technicians, subscriptions, support desk, payments, notifications
- `@oorjaman/config` — design tokens
- `@oorjaman/ui` — mobile UI (Screen, modals, offline gate, splash helpers, …)
- `@oorjaman/web-ui` — web UI (buttons, cards, page headers, …)
- `@oorjaman/utils` — booking slots, IST date helpers, etc.

## Documentation

- [**BILLING.md**](BILLING.md) — paid third-party services (e.g. Google Maps), env vars, and setup notes
- Per-app READMEs under `apps/*` are mostly upstream templates; this file is the project overview

## License

Private — OorjaMan. All rights reserved unless otherwise noted in the repository.
