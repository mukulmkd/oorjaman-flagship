# k6 API stress (UAT only)

## Install

https://grafana.com/docs/k6/latest/set-up/install-k6/

## Env

Prefer `npm run stress:k6:smoke` from repo root (loads `.env.uat.local` + `stress/.env.local`).

Required:

- `SUPABASE_URL` — must **not** contain PROD ref `nppfpegqnmclbcmmogux`
- `SUPABASE_ANON_KEY`
- Either `CUSTOMER_ACCESS_TOKEN` / `TECHNICIAN_ACCESS_TOKEN`, **or**
  - `CUSTOMER_EMAIL` + `CUSTOMER_PASSWORD` (seed default `TestOtp123!`)
  - `TECHNICIAN_EMAIL` + `TECHNICIAN_PASSWORD`

Optional: `VUS`, `DURATION`, `STRESS_ALLOW_CREATE`, `STRESS_VENDOR_ID`, `STRESS_CUSTOMER_ID`.

## Auth

Scripts use password grant so the JWT is a real user session and RLS matches the apps. UAT dummy OTP `123456` maps to password `TestOtp123!` for seeded users.

## Ramp

| Stage | Command hint |
| --- | --- |
| Smoke | `VUS=5 DURATION=2m` (default smoke.js) |
| Load | `VUS=20 DURATION=5m` booking-read-write.js |
| Spike | `VUS=50 DURATION=2m` — watch for 5xx / connection exhaustion |

## Local dashboard

```bash
VUS=50 DURATION=2m npm run stress:k6:booking:dash
```

Opens **http://127.0.0.1:5665** during the run and writes a self-contained HTML report to `stress/k6/reports/`.

| Env | Default | Purpose |
| --- | --- | --- |
| `STRESS_DASHBOARD=1` | off unless `:dash` / `--dashboard` | Enable dashboard |
| `K6_WEB_DASHBOARD_OPEN` | `true` with dashboard | Auto-open browser |
| `K6_WEB_DASHBOARD_PORT` | `5665` | Bind port |
| `K6_WEB_DASHBOARD_PERIOD` | `5s` | Chart aggregation |
| `K6_WEB_DASHBOARD_EXPORT` | auto path under `reports/` | HTML file at end |
