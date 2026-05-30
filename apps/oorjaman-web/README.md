# oorjaman-web

Public site for **https://oorjaman.com** - marketing, legal (app-store), cities, and blog.

**Operations guide:** see repo root [**SEO.md**](../../SEO.md) (deploy, Search Console, future work).

## Develop

```bash
npm install   # from repo root
cp apps/oorjaman-web/.env.example apps/oorjaman-web/.env.local
npm run web
```

## GoDaddy deploy (static)

```bash
npm run build:godaddy -w oorjaman-web
```

Upload the contents of `apps/oorjaman-web/out/` to your domain `public_html` (see SEO.md).

## Environment

| Variable                        | Purpose                                       |
| ------------------------------- | --------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`          | `https://oorjaman.com` in production          |
| `NEXT_PUBLIC_VENDOR_PORTAL_URL` | Partner signup link on `/partners`            |
| `EXPO_PUBLIC_SITE_URL`          | Same URL in customer app for legal deep links |
