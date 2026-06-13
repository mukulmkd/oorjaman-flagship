# Vercel deployment — admin portals (testing)

Step-by-step guide for deploying the three **Vite admin portals** (`admin-web`, `vendor-web`, `support-web`) to **Vercel** for internal testing, before production hosting on **GoDaddy**.

**Related docs:**

- [DEPLOYMENT.md](DEPLOYMENT.md) — full PROD vs UAT matrix (8 web hosts, mobile EAS, GoDaddy DNS)
- [ENVIRONMENT.md](ENVIRONMENT.md) — all environment variables (dev vs production)
- [SUPABASE-UAT-PROD.md](SUPABASE-UAT-PROD.md) — dual Supabase projects, migrations, RLS

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
| **Protect Vercel deployments** | Use Vercel Deployment Protection or password gate for internal testing |

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

Because this repo uses **npm workspaces**, install from the **repository root** — do not set Root Directory to `apps/admin-web`.

| Setting | Value |
|---------|-------|
| **Root Directory** | `.` (repo root) — **must match on admin, vendor, and support** |
| **Framework Preset** | **Other** (not Vite — avoids `vite build` overriding your command) |
| **Install Command** | `npm ci --include=dev` *(or leave empty to use root `vercel.json`)* |
| **Build Command** | `npm run build:uat -w admin-web` *(swap workspace name per project)* |
| **Output Directory** | `apps/admin-web/dist` *(swap per project)* |
| **Node.js Version** | 20.x |

If **vendor** fails on `country-state-city` while **admin** succeeds, compare **Root Directory**: vendor is often wrongly set to `apps/vendor-web`. Either clear it (repo root) or rely on `apps/vendor-web/vercel.json`, which reinstalls from the monorepo root.

Each portal’s `build:uat` runs `brand:sync:web` before Vite. Vendor skips `tsc` during UAT deploy and installs `country-state-city` in `prebuild:uat` if the package was missing from CI install.

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
# root .env: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY = UAT
npm run seed:dummy-users
```

---

## Step 4 — Deploy

Click **Deploy** or push to your connected branch. Vercel builds and hosts the static `dist/` output.

---

## Step 5 — Verify after deploy

| Check | How |
|-------|-----|
| Supabase project | DevTools → Network → requests go to **UAT** URL, not prod |
| Login | Works with dummy OTP `123456` if dummy auth is on |
| Cross-links | Admin ↔ Support ↔ Vendor links open correct Vercel URLs |
| SPA routing | Deep routes work (e.g. `/dashboard/analytics`) — Vercel handles Vite SPA fallback |

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

_Last updated: 2026-05-19 — Vercel testing for admin-web, vendor-web, support-web._
