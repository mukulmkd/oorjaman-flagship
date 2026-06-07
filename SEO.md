# OorjaMan public site - SEO & deployment (`oorjaman-web`)

Canonical production URL: **https://oorjaman.com**

UAT marketing: **https://dev-oorjaman.oorjaman.com** - not indexed (`NEXT_PUBLIC_DEPLOY_ENV=uat`). See [**DEPLOYMENT.md**](DEPLOYMENT.md).

App: `apps/oorjaman-web` (Next.js 15, App Router, static/SSG pages).

This document is the **runbook and backlog** for the marketing site. Revisit when you change domains, launch new cities, or submit app-store listings.

---

## What is shipped (Phases 0-3)

| Phase                    | Status | Contents                                                                                                      |
| ------------------------ | ------ | ------------------------------------------------------------------------------------------------------------- |
| **0 - Foundation**       | Done   | Next.js app, layout, `sitemap.xml`, `robots.txt`, JSON-LD (Organization, WebSite), OG image, security headers |
| **1 - Store gate**       | Done   | `/legal/*` (privacy, terms, account deletion, refunds, cookies, …), `/contact`, `/download`                   |
| **2 - Marketing**        | Done   | Home, how-it-works, services, homeowners/businesses, partners, pricing, safety, FAQ, about                    |
| **3 - Growth (minimal)** | Done   | `/cities` + 6 metro landings, `/blog` + 2 starter articles                                                    |

**Mobile wiring:** Customer registration links to hosted Terms, Privacy, Safety via `EXPO_PUBLIC_SITE_URL` (`packages/config` → `publicLegalUrls`).

---

## Before you go live (checklist)

- [ ] **DNS (GoDaddy):** `A` / `CNAME` for `oorjaman.com` and `www.oorjaman.com` → your hosting target
- [ ] **HTTPS:** Enable SSL in GoDaddy (Let’s Encrypt or managed cert)
- [ ] **Redirect:** `www` → `https://oorjaman.com` (non-www canonical) - GoDaddy forwarding or hosting rules
- [ ] **Build:** `npm run build:godaddy -w oorjaman-web` → upload `apps/oorjaman-web/out/` to `public_html`
- [ ] **Env (production):** `NEXT_PUBLIC_SITE_URL=https://oorjaman.com`
- [ ] **Env (customer app):** `EXPO_PUBLIC_SITE_URL=https://oorjaman.com`
- [ ] **Email DNS:** Configure `support@`, `privacy@`, `legal@` on `@oorjaman.com` (or update addresses in `apps/oorjaman-web/lib/site.ts`)
- [ ] **Lawyer review** of all `/legal/*` copy (currently engineering drafts)
- [ ] **App Store / Play Console** URLs → same legal pages on oorjaman.com
- [ ] **Real store links** on `/download` when listings exist (`apps/oorjaman-web/lib/site.ts` → `APP_LINKS`)
- [ ] **Google Search Console** - add property `https://oorjaman.com`, submit sitemap `https://oorjaman.com/sitemap.xml`
- [ ] **Bing Webmaster Tools** - optional, same sitemap

---

## GoDaddy deployment (static export)

Most GoDaddy shared plans serve **static files** from `public_html`.

```bash
# From repo root
npm install
cp apps/oorjaman-web/.env.example apps/oorjaman-web/.env.local
# Set NEXT_PUBLIC_SITE_URL=https://oorjaman.com in .env.local before build

npm run build:godaddy -w oorjaman-web
```

1. In cPanel File Manager (or FTP), open **`public_html`** for `oorjaman.com`.
2. Upload **all files inside** `apps/oorjaman-web/out/` (not the `out` folder itself as a single blob unless your host expects it).
3. Ensure `index.html` exists at the domain root.
4. For clean URLs, many hosts need a **404 → index.html** fallback (SPA-style) or Next’s generated `404.html`. Test `/legal/privacy-policy` after upload.

**If you have Node.js hosting on GoDaddy** instead of static-only, you can use `npm run build -w oorjaman-web` (without `OORJAMAN_STATIC_EXPORT`) and run `npm run start -w oorjaman-web` behind their Node app manager - only if your plan supports it.

---

## App-store required URLs (copy into consoles)

| Purpose                     | URL                                         |
| --------------------------- | ------------------------------------------- |
| Privacy Policy              | https://oorjaman.com/legal/privacy-policy   |
| Terms of Service            | https://oorjaman.com/legal/terms-of-service |
| Account deletion            | https://oorjaman.com/legal/account-deletion |
| Support                     | https://oorjaman.com/contact                |
| Marketing / support website | https://oorjaman.com                        |

---

## SEO maintenance

### Already automated

- Per-page `title`, `description`, canonical, Open Graph, Twitter cards (`apps/oorjaman-web/lib/seo.ts`)
- `app/sitemap.ts` - static routes, legal, cities, blog
- `app/robots.ts` - allow crawl, point to sitemap
- FAQ schema on `/` and `/faq`; Service schema on city pages
- `lang="en-IN"` on `<html>`

### Revisit later (backlog)

| Item                           | Where to change                                                  | Notes                                                           |
| ------------------------------ | ---------------------------------------------------------------- | --------------------------------------------------------------- |
| **More cities**                | `apps/oorjaman-web/lib/cities.ts`                                | Add slug + unique intro (200+ words); avoid duplicate templates |
| **Blog / content**             | `apps/oorjaman-web/lib/blog-posts.ts`                            | Move to MDX or CMS when volume grows                            |
| **Hindi pages**                | New route group e.g. `/hi/...`                                   | `hreflang` alternates in `seo.ts`                               |
| **Cookie consent banner**      | New component + layout                                           | Required if you add GA4/Meta pixels                             |
| **Analytics**                  | `layout.tsx` or third-party script                               | Plausible / GA4 - document in Cookie Policy                     |
| **Google Business Profile**    | Off-site                                                         | Tie to registered entity address                                |
| **Real pricing on web**        | Optional Supabase read                                           | Today pricing is narrative only                                 |
| **Logo / favicon**             | `app/icon.tsx`, `public/`                                        | Replace gradient placeholder in header                          |
| **Partner portal URL**         | `NEXT_PUBLIC_VENDOR_PORTAL_URL`                                  | `/partners` CTA                                                 |
| **Technician app legal links** | Same as customer                                                 | Point to same `publicLegalUrls`                                 |
| **Structured data audit**      | [Rich Results Test](https://search.google.com/test/rich-results) | After each major release                                        |
| **Lighthouse pass**            | CI or manual                                                     | Target ≥ 90 mobile Performance/SEO                              |
| **Apple App Site Association** | `public/.well-known/`                                            | Universal links to `/download`                                  |
| **Digital Asset Links**        | `public/.well-known/assetlinks.json`                             | Android app links                                               |

### When legal or pricing changes

1. Update `apps/oorjaman-web/lib/legal-docs.ts` (`lastUpdated` dates).
2. Rebuild and redeploy static `out/`.
3. Confirm app-store URLs still match.
4. Notify users if material policy change (in-app notice).

---

## Local development

```bash
npm run web          # http://localhost:3000
npm run build:web    # standard Next build (Vercel/Node)
npm run build:godaddy -w oorjaman-web   # static export → out/
```

---

## Key files

| File                                  | Role                                              |
| ------------------------------------- | ------------------------------------------------- |
| `packages/config/src/public-site.ts`  | Default `https://oorjaman.com`, legal URL helpers |
| `apps/oorjaman-web/lib/seo.ts`        | Metadata builder                                  |
| `apps/oorjaman-web/lib/legal-docs.ts` | Policy content                                    |
| `apps/oorjaman-web/lib/cities.ts`     | City landings (Phase 3)                           |
| `apps/oorjaman-web/lib/blog-posts.ts` | Blog posts (Phase 3)                              |
| `apps/customer-app/lib/legal-urls.ts` | In-app links to web legal pages                   |
| `apps/oorjaman-web/next.config.ts`    | `OORJAMAN_STATIC_EXPORT=1` for GoDaddy            |

---

## Monorepo scripts

```bash
npm run web          # dev server oorjaman-web
npm run build:web    # production build (included in root npm run build)
```

Root `package.json` `build` includes `oorjaman-web` for CI.

---

_Last updated: 2026-05-19 - Phases 0-3 complete for oorjaman.com / GoDaddy static path._
