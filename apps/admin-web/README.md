# admin-web — OorjaMan Admin Portal

React + Vite SPA for platform operators: vendor approval, pricing, booking monitoring, analytics, notifications, brand print, and more.

## Run locally

From repo root (loads `apps/admin-web/.env.development.local`):

```bash
cp apps/admin-web/.env.development.example apps/admin-web/.env.development.local
# UAT Supabase URL + anon; localhost cross-links; optional dummy auth

npm run admin    # http://localhost:5173
```

Seed UAT test users (repo root `.env.uat.local`):

```bash
npm run seed:dummy-users
```

## UAT on Vercel (live)

| Setting | Value |
| ------- | ----- |
| URL | https://oorjaman-admin.vercel.app |
| Build | `npm run build:uat -w admin-web` |
| Output | `apps/admin-web/dist` |
| Backend | **OorjaMan UAT** Supabase (anon key in Vercel env) |

Full monorepo Vercel setup: [VERCEL.md](../../project-docs/VERCEL.md). Env vars: [ENVIRONMENT.md](../../project-docs/ENVIRONMENT.md) · [DEPLOYMENT.md](../../project-docs/DEPLOYMENT.md).

## Brand print (stationery)

**Dashboard → Brand print** (`/dashboard/brand-collateral`) — per-person business cards, letterhead, email signatures, and invoice PDFs. Uses shared layout in `packages/utils/src/brand-print/` and logos from `npm run brand:sync`.

UAT: https://oorjaman-admin.vercel.app/dashboard/brand-collateral

Optional CLI batch export (company-default contact, gitignored output): `npm run brand:print` — see [brand/print/README.md](../../brand/print/README.md).

## Production (GoDaddy, planned)

```bash
cp apps/admin-web/.env.production.example apps/admin-web/.env.production.local
npm run build -w admin-web
```

Deploy `apps/admin-web/dist/` to `https://admin.oorjaman.com` with Prod Supabase — no dummy auth.

## Docs

- [README.md](../../README.md) — monorepo overview
- [ENVIRONMENT.md](../../project-docs/ENVIRONMENT.md) — all `VITE_*` variables
- [SECURITY-VERCEL.md](../../project-docs/SECURITY-VERCEL.md) — portal security on Vercel
