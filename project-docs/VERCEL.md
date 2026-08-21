# Vercel deployment guide — UAT admin portals (live)

Step-by-step guide for the three **Vite portals** (`admin-web`, `vendor-web`, `support-web`) on **Vercel**. This is the **current UAT hosting** for ops QA; production moves to **GoDaddy** later with a separate Supabase project.

**Status (2026-05-20):** Deployed and verified.

| Portal | URL |
| ------ | --- |
| Admin | https://oorjaman-admin.vercel.app |
| Vendor | https://oorjaman-vendor.vercel.app |
| Support | https://oorjaman-support.vercel.app |

**Related docs:**

- [DEPLOYMENT.md](DEPLOYMENT.md) — full PROD vs UAT matrix (8 web hosts, mobile EAS, GoDaddy DNS)
- [ENVIRONMENT.md](ENVIRONMENT.md) — all environment variables (dev vs production)
- [SUPABASE-UAT-PROD.md](SUPABASE-UAT-PROD.md) — dual Supabase projects, migrations, RLS
- [SECURITY-VERCEL.md](SECURITY-VERCEL.md) — Vercel + Supabase security for the three portals

---

## Mental model

The three portals are **static Vite SPAs**. They talk to Supabase **directly from the browser** using the **anon key** and Row Level Security. There is no Node server at runtime.

| Fact | Implication |
|------|-------------|
| `VITE_*` vars are embedded at **build time** | Changing env in Vercel requires a **new deploy** |
| Only the **anon key** belongs in Vercel | Never put `service_role` in client builds or Vercel env |
| Auth is in-app OTP (`verifyOtp`) | No backend redirect handler needed for normal login |

---

## Best practices

| Practice | Why |
|----------|-----|
| **Use UAT Supabase on Vercel** | Keep your current dev/UAT project for testing; create a separate **Prod** project for GoDaddy later |
| **Three separate Vercel projects** | One each for admin, vendor, and support — independent URLs and env |
| **Set all portal cross-links** | `VITE_ADMIN_PORTAL_URL`, `VITE_VENDOR_PORTAL_URL`, `VITE_SUPPORT_PORTAL_URL` must match real deployed URLs |
| **Keep dummy auth on for Vercel QA** | `VITE_USE_DUMMY_AUTH=true` avoids SMS/email provider setup while testing |
| **Turn dummy auth off on GoDaddy prod** | Real OTP only in production |
| **Never commit `.env` files** | Set secrets only in Vercel (testing) or your CI/build machine (GoDaddy) |
| **Protect Vercel deployments** | Use Vercel Deployment Protection or password gate for internal testing — see [SECURITY-VERCEL.md](SECURITY-VERCEL.md) |

### Recommended environment flow

```
Local dev     → UAT Supabase
Vercel test   → UAT Supabase + dummy auth (optional)
GoDaddy UAT   → UAT Supabase + dev-*.oorjaman.com URLs
GoDaddy PROD  → Prod Supabase + production domains, no dummy auth
```

---

## Step 1 — Push code to GitHub

Vercel deploys from git. Ensure `.env` files stay gitignored (they already are). Do not commit real keys.

---

## Step 2 — Create three Vercel projects

In [vercel.com](https://vercel.com) → **Add New Project** → import this repository. Create **one project per portal**:

| Vercel project (example name) | Workspace | Build output |
|-------------------------------|-----------|--------------|
| `oorjaman-admin` | `admin-web` | `apps/admin-web/dist` |
| `oorjaman-vendor` | `vendor-web` | `apps/vendor-web/dist` |
| `oorjaman-support` | `support-web` | `apps/support-web/dist` |

### Monorepo build settings (each project)

**Use the same pattern on admin, vendor, and support** — copy your working **admin** project and only change the workspace name and output path.

Confirmed working **admin** setup (repo root, not `apps/admin-web` as root):

| Setting | Admin (working) | Vendor | Support |
|---------|-----------------|--------|---------|
| **Root Directory** | empty (repo root) | empty (repo root) | empty (repo root) |
| **Framework Preset** | Vite | Vite | Vite |
| **Install Command** | `npm install` | `npm install` | `npm install` |
| **Build Command** | `npm run build:uat -w admin-web` | `npm run build:uat -w vendor-web` | `npm run build:uat -w support-web` |
| **Output Directory** | `apps/admin-web/dist` | `apps/vendor-web/dist` | `apps/support-web/dist` |
| **Node.js Version** | 20.x | 20.x | 20.x |

**Output Directory must include the app path** (`apps/vendor-web/dist`), not plain `dist`. With Root at repo root, Vite writes to `apps/vendor-web/dist`; if Output is only `dist`, Vercel looks for `/dist` at the repo root and fails with:

`No Output Directory named "dist" found after the Build completed`

Do **not** add per-app `vercel.json` files — use root [`vercel.json`](vercel.json) only (SPA rewrites + security headers).

Vendor `build:uat` runs `prebuild:uat` (ensures `country-state-city` if CI skipped it) then `brand:sync:web` and `vite build --mode uat` (no `tsc` on deploy).

### Per-app deploys only (branch + path filter)

By default, **every push** to a connected branch can rebuild **every** linked Vercel project. Configure each project so it deploys **only** when:

1. The push is on that project’s branch (`develop` for UAT portals, `main` for prod), and  
2. Files that affect that app (or its shared deps) actually changed.

#### A — Production Branch (Dashboard)

For **each** Vercel project → **Settings → Git → Production Branch**:

| Project | Production Branch |
|---------|-------------------|
| `oorjaman-admin` (UAT) | `develop` |
| `oorjaman-vendor` (UAT) | `develop` |
| `oorjaman-support` (UAT) | `develop` |
| Prod marketing (or your single prod Vercel app) | `main` |

That makes **Production** deployments track only that branch. Optionally turn off **Preview** deployments (Settings → Git → ignore / disable automatic previews) if you do not want PR/feature-branch builds.

#### B — Ignored Build Step (path + branch guard)

1. Open the project → **Settings → Build and Deployment → Ignored Build Step**.
2. Choose **Custom** / **Run my Node script** and set:

| Project | Command |
|---------|---------|
| Admin (UAT) | `node scripts/vercel-should-build.mjs admin-web --branch develop` |
| Vendor (UAT) | `node scripts/vercel-should-build.mjs vendor-web --branch develop` |
| Support (UAT) | `node scripts/vercel-should-build.mjs support-web --branch develop` |
| Marketing / prod on `main` | `node scripts/vercel-should-build.mjs oorjaman-web --branch main` |

**Vercel exit codes:** **0** = skip build (deployment CANCELED), **1** = build runs.

The script:

- Skips when `VERCEL_GIT_COMMIT_REF` is not the `--branch` you passed  
- Skips when the commit does not touch that app’s paths (portals: `apps/<portal>/`, `packages/`, `vercel.json`, lockfile, brand sync; marketing: `apps/oorjaman-web/`, `brand/`, lockfile)

**Manual Redeploy** from the dashboard always builds. First deploy on a new project also builds.

> Push `scripts/vercel-should-build.mjs` to **both** `develop` and `main` so each environment’s ignore step can run.

---

## Step 3 — Environment variables (per Vercel project)

In each project → **Settings → Environment Variables**.

Set variables for **Production** scope on your stable test URLs. Add **Preview** scope too if you want PR preview deploys.

### Required (all three portals — UAT Supabase)

```env
VITE_DEPLOY_ENV=uat
VITE_SUPABASE_URL=https://<YOUR_UAT_REF>.supabase.co
VITE_SUPABASE_ANON_KEY=<your_uat_anon_key>
```

Get URL and anon key from Supabase Dashboard → **Project Settings → API**.

### Cross-links (must match real deployed URLs)

Set these to your Vercel URLs (or custom domains once attached):

```env
VITE_ADMIN_PORTAL_URL=https://oorjaman-admin.vercel.app
VITE_VENDOR_PORTAL_URL=https://oorjaman-vendor.vercel.app
VITE_SUPPORT_PORTAL_URL=https://oorjaman-support.vercel.app
```

If you add custom domains (e.g. `dev-admin.oorjaman.com`), use those instead. Mismatched cross-links cause wrong redirects (e.g. vendor sent to `localhost:5174`).

### Optional — QA without SMS/email (recommended for first Vercel deploy)

```env
VITE_USE_DUMMY_AUTH=true
VITE_DUMMY_OTP_CODE=123456
VITE_DUMMY_AUTH_PASSWORD=TestOtp123!
```

Seed dummy users in **UAT** (local machine only — uses `service_role`, never in Vercel):

```bash
# root .env.uat.local: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY = UAT
npm run seed:dummy-users
```

---

## Step 4 — Deploy

Click **Deploy** or push to your connected branch. Vercel builds and hosts the static `dist/` output.

---

## SPA routing (fix 404 on refresh)

The portals use **React Router `BrowserRouter`** (clean URLs like `/login`, not `/#/login`). Client-side navigation works; a **hard refresh** asks the server for `/login` as a real file — Vercel returns **404** unless you add a fallback.

Root [`vercel.json`](vercel.json) includes:

```json
"rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
```

Vercel still serves real files first (`/assets/*`, `favicon.png`, etc.); only missing paths fall through to `index.html`, then React Router takes over.

All three projects (admin, vendor, support) use this file when **Root Directory** is the repo root. **Push and redeploy** after changing `vercel.json`.

**Local dev:** Vite dev server already does this — the issue appears only on static hosts (Vercel, GoDaddy). For GoDaddy, use `.htaccess` SPA rules — see [DEPLOYMENT.md](DEPLOYMENT.md).

---

## Step 5 — Verify after deploy

| Check | How |
|-------|-----|
| Supabase project | DevTools → Network → requests go to **UAT** URL, not prod |
| Login | Works with dummy OTP `123456` if dummy auth is on |
| Cross-links | Admin ↔ Support ↔ Vendor links open correct Vercel URLs |
| SPA routing | Open `/login` directly or refresh on a deep route — should load the app, not Vercel **404** |

---

## Supabase changes (UAT project)

**No schema or migration changes** are required just to host on Vercel. Apply pending migrations if needed:

```bash
npx supabase link --project-ref <UAT_REF>
npm run db:push
```

### A. Auth redirect URLs (recommended)

**Dashboard → Authentication → URL Configuration**

Add your Vercel hosts (wildcards help for preview deploys):

```
https://oorjaman-admin.vercel.app/**
https://oorjaman-vendor.vercel.app/**
https://oorjaman-support.vercel.app/**
https://*.vercel.app/**
```

If you will also use GoDaddy UAT subdomains:

```
https://dev-admin.oorjaman.com/**
https://dev-vendor.oorjaman.com/**
https://dev-support.oorjaman.com/**
```

Set **Site URL** to your primary test host (e.g. admin Vercel URL or `dev-admin.oorjaman.com`).

> Normal login uses in-app OTP codes (`verifyOtp`), not browser redirects. Redirect URLs matter for email magic links and future OAuth.

### B. Auth providers (if not using dummy auth)

| Provider | Needed for |
|----------|------------|
| **Phone** | Real SMS OTP |
| **Email** | Real email OTP |

With `VITE_USE_DUMMY_AUTH=true`, you can skip provider setup for initial testing.

### C. Users and roles

- Run `npm run seed:dummy-users` against UAT if using dummy auth
- Ensure test users have correct roles in `public.users` (`admin`, `vendor`, `support`)

### D. What you do **not** need to change

- RLS policies — same for any browser origin
- CORS — Supabase allows browser clients with the anon key
- Edge functions — portals do not call edge functions for login
- New migrations — only if schema is behind UAT

---

## Marketing site (`oorjaman-web`) — UAT on Vercel

The marketing site is **Next.js**, but for UAT we ship it exactly like the Vite portals: a **static export** (no SSR, no serverless functions) with **SEO fully off**. This is validation-only hosting.

### How SSR + SEO are turned off

`npm run build:uat -w oorjaman-web` sets two things:

- `OORJAMAN_STATIC_EXPORT=1` → `next.config.ts` switches to `output: "export"` → pure static HTML in `apps/oorjaman-web/out/` (**SSR off**).
- `NEXT_PUBLIC_DEPLOY_ENV=uat` → **SEO off**: `robots.txt` is `Disallow: /`, every page emits `noindex, nofollow, nocache`, JSON-LD schema is dropped, a yellow "UAT" banner shows, and titles get a `(UAT)` suffix.

Both are baked at build time, so UAT can never accidentally get indexed. Local dev (`npm run dev`) is also non-production, so it's noindex by default too.

### Create the Vercel project (one new project)

Import the same repo → new project (e.g. `oorjaman-web-uat`). Use the **repo root** pattern, same as admin:

| Setting | Value |
|---------|-------|
| **Root Directory** | empty (repo root) |
| **Framework Preset** | **Other** (not Next.js — we serve static `out/`) |
| **Install Command** | `npm install` |
| **Build Command** | `npm run build:uat -w oorjaman-web` |
| **Output Directory** | `apps/oorjaman-web/out` |
| **Node.js Version** | 20.x |

> Preset is **Other** (not Next.js) on purpose: we don't want Vercel's Next serverless builder — the site is a static folder like the portals' `dist/`. Vercel serves clean URLs automatically (`/about` → `about.html`).

### Environment variables (Production + Preview scope)

```env
NEXT_PUBLIC_DEPLOY_ENV=uat
NEXT_PUBLIC_SITE_URL=https://<your-marketing-uat>.vercel.app
# Optional for UAT:
# NEXT_PUBLIC_VENDOR_PORTAL_URL=https://oorjaman-vendor.vercel.app
```

`build:uat` already forces `NEXT_PUBLIC_DEPLOY_ENV=uat`, so even a wrong Vercel value stays noindex. Set `NEXT_PUBLIC_SITE_URL` to the Vercel URL so canonical/OG links resolve to the UAT host. Leave app-store and GSTIN vars unset for UAT.

### Ignored Build Step (branch + path)

Use the same helper as the portals, locked to `develop` for UAT marketing or `main` for prod marketing:

```bash
# UAT marketing on develop
node scripts/vercel-should-build.mjs oorjaman-web --branch develop

# Prod marketing on main
node scripts/vercel-should-build.mjs oorjaman-web --branch main
```

Also set **Git → Production Branch** to match.

### Caveat — shared root `vercel.json`

The repo-root [`vercel.json`](vercel.json) has a SPA catch-all (`/(.*) → /index.html`) for the Vite portals. Vercel resolves real files first, so all marketing routes serve correctly; only a genuinely unknown URL falls back to the **home page** instead of the styled `404.html`. Acceptable for UAT validation. (Production marketing hosting is static on GoDaddy via `build:godaddy` and does not use this file.)

### Verify after deploy

| Check | Expected |
|-------|----------|
| `/robots.txt` | `User-Agent: *` / `Disallow: /` |
| View source on any page | `<meta name="robots" content="noindex, nofollow, nocache">` |
| Top banner | Yellow "UAT environment — not for production use or search indexing" |
| Network tab | Only static `.html` / `_next/*` assets — no serverless function calls |

---

## Later — GoDaddy production

When moving from Vercel testing to GoDaddy production, see [DEPLOYMENT.md](DEPLOYMENT.md) for DNS and folder layout.

### 1. Use the Prod Supabase project

Follow [SUPABASE-UAT-PROD.md](SUPABASE-UAT-PROD.md): separate project, same migrations, **no dummy users** on prod.

### 2. Build with production env vars

Build on your machine or in CI — **not** by uploading `.env` to GoDaddy:

```env
VITE_DEPLOY_ENV=production
VITE_SUPABASE_URL=https://<PROD_REF>.supabase.co
VITE_SUPABASE_ANON_KEY=<prod_anon_key>
VITE_ADMIN_PORTAL_URL=https://admin.oorjaman.com
VITE_VENDOR_PORTAL_URL=https://vendor.oorjaman.com
VITE_SUPPORT_PORTAL_URL=https://support.oorjaman.com
# Do not set VITE_USE_DUMMY_AUTH or VITE_DUMMY_* on prod
```

```bash
npm run build -w admin-web
npm run build -w vendor-web
npm run build -w support-web
```

### 3. Upload `dist/` to GoDaddy

| Host | Upload contents of |
|------|-------------------|
| `admin.oorjaman.com` | `apps/admin-web/dist/` |
| `vendor.oorjaman.com` | `apps/vendor-web/dist/` |
| `support.oorjaman.com` | `apps/support-web/dist/` |

Add `.htaccess` for SPA routing — see [DEPLOYMENT.md](DEPLOYMENT.md#godaddy-dns-8-document-roots).

### 4. Supabase Prod dashboard

- Auth redirect URLs → production domains only
- Dummy auth **off**
- Real phone/email providers configured

---

## Common pitfalls

| Problem | Cause | Fix |
|---------|-------|-----|
| “Configure VITE_SUPABASE_URL…” on login | Env vars missing at **build** time | Set vars in Vercel → redeploy |
| Login works locally, not on Vercel | Build ran without env vars | Rebuild after setting Vercel env |
| Vendor redirected to `localhost:5174` | `VITE_VENDOR_PORTAL_URL` unset | Set to real Vercel or GoDaddy URL |
| OTP fails without dummy auth | Phone/email provider not configured | Enable providers in Supabase or use dummy auth on UAT |
| Preview deploy auth issues | Supabase missing `*.vercel.app` redirects | Add wildcard redirect URLs |

---

## Environment variable reference (portals only)

| Variable | Vercel (testing) | GoDaddy (prod) |
|----------|------------------|----------------|
| `VITE_DEPLOY_ENV` | `uat` | `production` |
| `VITE_SUPABASE_URL` | UAT project URL | Prod project URL |
| `VITE_SUPABASE_ANON_KEY` | UAT anon key | Prod anon key |
| `VITE_ADMIN_PORTAL_URL` | Your admin Vercel URL | `https://admin.oorjaman.com` |
| `VITE_VENDOR_PORTAL_URL` | Your vendor Vercel URL | `https://vendor.oorjaman.com` |
| `VITE_SUPPORT_PORTAL_URL` | Your support Vercel URL | `https://support.oorjaman.com` |
| `VITE_USE_DUMMY_AUTH` | `true` optional | **omit** |
| `VITE_DUMMY_OTP_CODE` | e.g. `123456` | **omit** |
| `VITE_DUMMY_AUTH_PASSWORD` | matches seed script | **omit** |

Full tables: [ENVIRONMENT.md](ENVIRONMENT.md).

---

## Redeploy checklist

| Change | Action |
|--------|--------|
| UI code only | Push to git → Vercel auto-redeploys |
| `VITE_*` env var | Update in Vercel → **Redeploy** (rebuild required) |
| SQL migration | `db:push` on UAT (then Prod when ready) — no portal redeploy strictly required, but redeploy if you changed build-time env |
| Supabase auth URLs | Dashboard only — no portal rebuild |

---

_Last updated: 2026-05-20 — live UAT on Vercel; three projects; UAT Supabase + dummy auth._
