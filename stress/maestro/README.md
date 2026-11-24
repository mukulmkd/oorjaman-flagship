# Maestro device stress (UAT builds only)

## Install

https://maestro.mobile.dev/getting-started/installing-maestro

## Apps

| App | Package / bundle |
| --- | --- |
| Customer UAT | `com.oorjaman.customer.uat` |
| Partner UAT | `com.oorjaman.technician.uat` |

Use physical devices or emulators with the UAT binary (not Expo Go, not PROD store builds).

## Run

```bash
npm run stress:maestro:customer
npm run stress:maestro:partner

# Loop a flow locally (20–50× recommended)
maestro test --repeat 20 stress/maestro/customer-login-home.yaml
```

Dummy OTP: `123456`. Defaults: `raju.mahalingam@gmail.com` / `amit.das@gamusagreen.in`. Override:

```bash
maestro test -e CUSTOMER_EMAIL=you@example.com stress/maestro/customer-login-home.yaml
maestro test -e TECHNICIAN_EMAIL=you@example.com stress/maestro/partner-login-jobs.yaml
```

## Flows

| File | Intent |
| --- | --- |
| `customer-login-home.yaml` | Login → Home |
| `customer-book-smoke.yaml` | Book / bookings navigation (no Live Razorpay) |
| `partner-login-jobs.yaml` | Login → Jobs |
| `partner-permissions-not-now.yaml` | Location “Not now” remains usable |

## PROD (Customer, one-shot only)

See [project-docs/PROD-SMOKE.md](../../project-docs/PROD-SMOKE.md). Store package `com.oorjaman.customer`, already logged in, no `--repeat`:

```bash
npm run smoke:maestro:customer:prod
```
