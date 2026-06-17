# support-web — OorjaMan Support Desk

React + Vite SPA for support agents: customer inbox, insights, booking context, floating chat dock.

## Run locally

```bash
cp apps/support-web/.env.development.example apps/support-web/.env.development.local
npm run support    # http://localhost:5175
```

## UAT on Vercel (live)

| Setting | Value |
| ------- | ----- |
| URL | https://oorjaman-support.vercel.app |
| Build | `npm run build:uat -w support-web` |
| Output | `apps/support-web/dist` |

See [VERCEL.md](../../project-docs/VERCEL.md), [ENVIRONMENT.md](../../project-docs/ENVIRONMENT.md).

## Production (GoDaddy, planned)

`npm run build -w support-web` → `https://support.oorjaman.com`
