# vendor-web — OorjaMan Partner Portal

React + Vite SPA for approved vendors: technicians, booking requests, marketplace, subscriptions, documents.

## Run locally

```bash
cp apps/vendor-web/.env.development.example apps/vendor-web/.env.development.local
npm run vendor    # http://localhost:5174
```

## UAT on Vercel (live)

| Setting | Value |
| ------- | ----- |
| URL | https://oorjaman-vendor.vercel.app |
| Build | `npm run build:uat -w vendor-web` |
| Output | `apps/vendor-web/dist` |

See [VERCEL.md](../../project-docs/VERCEL.md), [ENVIRONMENT.md](../../project-docs/ENVIRONMENT.md).

## Production (GoDaddy, planned)

`npm run build -w vendor-web` → `https://vendor.oorjaman.com`
