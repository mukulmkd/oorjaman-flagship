# Mobile stress testing (k6 + Maestro)

UAT-only API + device stress for Customer and Partner. **Never** point these tools at PROD Supabase (`nppfpegqnmclbcmmogux`) or production store builds.

For a light PROD Customer check after a security/Edge ship, use [PROD-SMOKE.md](PROD-SMOKE.md) (`npm run smoke:maestro:customer:prod` + manual Razorpay/AMC ticks).

## k6 report analysis (2026-11-12 booking dash, 50 VU / 2m)

| Signal | Finding |
| --- | --- |
| Thresholds | Passed (`p95=2.4s`, ~0% errors) |
| 1× `jobs ok` fail | Intermittent HTTP flake under concurrency (DB max for that shape ~99ms) — not a bad index |
| E2E avg 847ms / max 7.1s vs DB | Postgres mean vendors **~189ms**, bookings **~35–70ms** → most wait is **PostgREST pool + RLS + India→Singapore RTT**, not missing booking indexes |
| Advisors | Auth RLS InitPlan + multiple permissive SELECT policies on `bookings` / `vendors` |

**Fixes shipped:** migration `rls_initplan_hot_paths` (wrap `(select auth.uid())` / `(select my_*())` on hot helpers + `vendors_select_scope` + bookings SELECT). k6 now logs fail status/body and trends per endpoint.

**Re-run (same 50 VU / 2m after InitPlan fix):** p95 **558ms** (was 2.4s), max **1.93s** (was 7.1s), checks **100%** (was 1 jobs flake), ~2.7× more iterations. Report: `stress/k6/reports/booking-2026-11-12T13-57-42-596Z.html`. Keep stress off PROD.

## Stack

| Layer | Tool | Purpose |
| --- | --- | --- |
| API concurrency | [k6](https://k6.io) | Hammer Supabase REST under RLS with real user JWTs |
| Device flows | [Maestro](https://maestro.mobile.dev) | Loop login / book / jobs on UAT APKs |
| Profiling | Android Studio / Xcode Instruments | Only when a flow feels slow |

Order: seed UAT → k6 smoke → Maestro loops → profile hot screens if needed.

## Phase 0 — Prep

1. Root [`.env.uat.local`](../.env.uat.local.example) → **OorjaMan UAT** URL + service role.
2. `npm run seed:dummy-users`
3. Install **UAT** apps on devices (`com.oorjaman.customer.uat` / `com.oorjaman.technician.uat`).
4. Copy [`stress/.env.example`](../stress/.env.example) → `stress/.env.local` (gitignored) with anon key + test emails.

Dummy OTP on UAT apps: `123456` (password behind the scenes: `TestOtp123!` from seed / `DUMMY_AUTH_PASSWORD`).

## Phase 1 — k6

Install: https://grafana.com/docs/k6/latest/set-up/install-k6/

```bash
# From repo root (loads .env.uat.local + stress/.env.local, blocks PROD)
npm run stress:k6:smoke
npm run stress:k6:booking

# Live local dashboard (http://127.0.0.1:5665) + HTML export under stress/k6/reports/
VUS=50 DURATION=2m npm run stress:k6:booking:dash
```

k6’s built-in web dashboard shows VU count, RPS, latency percentiles, and checks in real time. Closing the browser tab lets the process exit. Reports are gitignored.

Or manually:

```bash
k6 run -e SUPABASE_URL=... -e SUPABASE_ANON_KEY=... \
  -e CUSTOMER_EMAIL=raju.mahalingam@gmail.com \
  -e CUSTOMER_PASSWORD=TestOtp123! \
  -e TECHNICIAN_EMAIL=amit.das@gamusagreen.in \
  -e TECHNICIAN_PASSWORD=TestOtp123! \
  stress/k6/smoke.js
```

### Scripts

| File | What it does |
| --- | --- |
| [`stress/k6/smoke.js`](../stress/k6/smoke.js) | Password login → list approved vendors + customer bookings + tech jobs |
| [`stress/k6/booking-read-write.js`](../stress/k6/booking-read-write.js) | Heavier parallel reads; optional create when `STRESS_ALLOW_CREATE=1` |

### Ramp / pass bars

| Stage | VUs | Duration | Pass |
| --- | --- | --- | --- |
| Smoke | 5 | 1–2 min | p95 &lt; 1.5s, errors &lt; 1% |
| Load | 20 | 5 min | p95 &lt; 3s, errors &lt; 2% |
| Spike | 50 | 2 min | no cascade 5xx / connection blow-ups |

Watch Supabase UAT dashboard (CPU, connections, slow queries) during runs.

Auth uses **user JWT** via `signInWithPassword` so RLS matches the apps (UAT dummy OTP path = password login).

## Phase 2 — Maestro

Install CLI: https://maestro.mobile.dev/getting-started/installing-maestro

```bash
# Device/emulator with UAT Customer installed
npm run stress:maestro:customer
npm run stress:maestro:partner
```

Flows live in [`stress/maestro/`](../stress/maestro/):

| Flow | App |
| --- | --- |
| `customer-login-home.yaml` | Customer UAT login → home |
| `customer-book-smoke.yaml` | Book a visit + bookings list (no Live Razorpay) |
| `partner-login-jobs.yaml` | Partner login → Jobs tab |
| `partner-permissions-not-now.yaml` | Location gate dismissible (5.1.1) |

Repeat each flow 20–50× on one Android + one iOS device. Log crashes / stuck screens.

Override emails via Maestro `env` or edit the YAML defaults to match seeded users.

## Phase 3 — Triage

| Symptom | Likely layer |
| --- | --- |
| Timeouts / 5xx in k6 | DB / RLS / connection limits |
| Maestro stuck / blank list | App query / empty UAT data / navigation |
| Jank on jobs / photos | UI / Storage — profile with Instruments / Studio |

Do not raise PROD traffic from these results.

## Anti-goals

- Stressing PROD
- Detox/Appium CI in v1
- Live Razorpay charge loops
- Cloud device farms required before local Maestro works
