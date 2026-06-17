# Security on Vercel (admin portals)

How to protect **admin-web**, **vendor-web**, and **support-web** on Vercel, and what actually secures your data.

**Related:** [VERCEL.md](VERCEL.md) (deploy settings), [SUPABASE-UAT-PROD.md](SUPABASE-UAT-PROD.md), [ENVIRONMENT.md](ENVIRONMENT.md)

---

## Mental model

| Layer | What it protects |
|-------|------------------|
| **Vercel** | Who can load the static site, edge abuse (DDoS, bots), response headers |
| **App login** | Which portal role signed in (admin / vendor / support) |
| **Supabase Auth + RLS** | **Data** — the anon key is public in the browser; RLS must enforce access |

Vercel cannot secure your database. If RLS is wrong, anyone with the anon key can call Supabase APIs directly.

---

## Repo: `vercel.json` security headers

Root [`vercel.json`](vercel.json) adds three HTTP headers on every response (same as `apps/oorjaman-web/next.config.ts`):

| Header | Purpose |
|--------|---------|
| `X-Frame-Options: DENY` | Reduces clickjacking (embedding your portal in another site’s iframe) |
| `X-Content-Type-Options: nosniff` | Stops browsers from MIME-sniffing assets |
| `Referrer-Policy: strict-origin-when-cross-origin` | Limits referrer leakage on cross-origin navigation |

**Deploy safety:** This file only sets `headers`. It does **not** change install command, build command, or output directory. All three Vercel projects (admin, vendor, support) with **Root Directory = repo root** pick up the same headers automatically.

We intentionally **do not** set a strict `Content-Security-Policy` here — misconfigured CSP can break Vite bundles or Supabase/WebSocket connections. Add CSP only after testing in preview.

**Verify after deploy:** DevTools → Network → click `index.html` → Response Headers — you should see the three headers above.

---

## Supabase (most important)

| Action | Where |
|--------|--------|
| **Row Level Security** on all sensitive tables | Dashboard → Table Editor |
| **Redirect URL allowlist** | Authentication → URL Configuration — your portal URLs only |
| **Site URL** | Primary portal URL (e.g. admin) |
| **Auth rate limits / CAPTCHA** | Authentication → Attack Protection |
| **Anon key only in Vercel** | Never `SUPABASE_SERVICE_ROLE_KEY` in client env |
| **UAT vs Prod projects** | Vercel test → UAT; GoDaddy prod → Prod |
| **Disable dummy auth in production** | `VITE_USE_DUMMY_AUTH=false`, real OTP |
| **Storage RLS** | Same rigor as tables for buckets |

---

## Vercel dashboard

### Who can open the site (UAT / internal)

**Settings → Deployment Protection** (per project or team):

| Mode | Use when |
|------|----------|
| **Vercel Authentication** (team members) | Internal QA; blocks random visitors |
| **Password Protection** (Pro) | Shared password for testers |
| **Protection on Preview only** | Hide PR URLs; production public |

You previously disabled protection so teammates could open URLs without a Vercel login. For wider UAT exposure, rely on **app OTP login** + Supabase RLS instead.

### Abuse, bots, DDoS

| Feature | Where |
|---------|--------|
| Edge DDoS mitigation | Automatic |
| **Firewall / WAF** | Team → Firewall (Pro+) — rate limits, geo blocks, IP rules |
| **Bot challenge** | Firewall rules |

Example: rate-limit anonymous traffic to static assets if you see scanner noise in logs.

### Secrets and access

- Env vars only in Vercel UI — never commit `.env` with real keys
- Scope **Production** vs **Preview** separately (preview should not use prod Supabase)
- Limit team members; enable 2FA on Vercel and GitHub
- `*.vercel.app` URLs are guessable — use Deployment Protection on previews if URLs are sensitive

---

## Attack vs defense (quick reference)

| Threat | Defense |
|--------|---------|
| Scrape public UAT URL | Deployment Protection; Firewall rate limits |
| OTP brute force | Supabase rate limits + CAPTCHA; no dummy OTP in prod |
| API calls with anon key | **RLS policies** per role |
| Leaked `service_role` | Never in Vercel; rotate immediately if exposed |
| DDoS | Vercel edge; Firewall (Pro) |
| Clickjacking / MIME issues | `vercel.json` headers (this repo) |
| Dependency vulnerabilities | `npm audit`, lockfile, Node 20.x on Vercel |

---

## Checklists

### UAT on Vercel (current — live)

- [x] UAT Supabase URL + anon key in Vercel env only
- [x] Redirect URLs include three portal hosts + `https://*.vercel.app/**`
- [x] Dummy auth for internal testers (`VITE_USE_DUMMY_AUTH=true`)
- [x] `vercel.json` security headers deployed
- [ ] Optional: Deployment Protection if URLs should not be public

### Production (GoDaddy / prod domains)

- [ ] Separate **Prod** Supabase project
- [ ] `VITE_USE_DUMMY_AUTH=false`
- [ ] Real SMS/email OTP
- [ ] RLS audit on all tables and storage
- [ ] Prod domains only in Supabase redirect allowlist
- [ ] Security headers (same `vercel.json` or host equivalent on GoDaddy)

---

## Changing headers later

Edit root `vercel.json`, push, redeploy. If you add `Content-Security-Policy`, test in a **Preview** deployment first — CSP is the most common cause of “app loads but Supabase/auth breaks.”

_Last updated: 2026-05-20 — UAT portals live on Vercel._
