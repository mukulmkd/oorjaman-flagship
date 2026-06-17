# oorjaman-web — Public marketing site

Next.js App Router site for **https://oorjaman.com** (production) and **https://dev-oorjaman.oorjaman.com** (UAT, noindex).

Marketing, legal pages (app-store required), cities, blog, partner CTA.

## Develop

```bash
cp apps/oorjaman-web/.env.development.example apps/oorjaman-web/.env.development.local
npm run web    # http://localhost:3000
```

## Deploy

| Target | Build | Upload |
| ------ | ----- | ------ |
| **GoDaddy PROD** | `NEXT_PUBLIC_DEPLOY_ENV=production NEXT_PUBLIC_SITE_URL=https://oorjaman.com npm run build:godaddy -w oorjaman-web` | `apps/oorjaman-web/out/` → `public_html` |
| **GoDaddy UAT** | `NEXT_PUBLIC_DEPLOY_ENV=uat NEXT_PUBLIC_SITE_URL=https://dev-oorjaman.oorjaman.com npm run build:godaddy -w oorjaman-web` | `public_html/dev-oorjaman/` |

Portals are **not** on this app — admin/vendor/support run on **Vercel UAT** today ([VERCEL.md](../../project-docs/VERCEL.md)).

## Environment

| Variable | Production | UAT |
| -------- | ---------- | --- |
| `NEXT_PUBLIC_DEPLOY_ENV` | `production` | `uat` |
| `NEXT_PUBLIC_SITE_URL` | `https://oorjaman.com` | `https://dev-oorjaman.oorjaman.com` |
| `NEXT_PUBLIC_VENDOR_PORTAL_URL` | `https://vendor.oorjaman.com` | `https://oorjaman-vendor.vercel.app` (until GoDaddy UAT) |

Customer app legal links: set `EXPO_PUBLIC_SITE_URL` to match the marketing tier.

## Docs

- [SEO.md](../../project-docs/SEO.md) — SEO checklist, Search Console, GoDaddy steps
- [DEPLOYMENT.md](../../project-docs/DEPLOYMENT.md) — full host matrix
