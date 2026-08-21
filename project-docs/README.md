# Project documentation

Monorepo-wide guides, checklists, and generated Word test specs. **Default location for new project-level docs** unless you specify another path (app READMEs stay under `apps/*`).

Topic-specific how-tos (push setup, local APK, realtime) remain in [`docs/`](../docs/).

> **Going live?** [`PROD_CHECKLIST.md`](../PROD_CHECKLIST.md) (repo root) is the **master launch checklist & status tracker**. The docs below are the runbook detail it links into — keep them; update launch status there.

## Run & deploy

| Doc | Purpose |
| --- | ------- |
| [SCRIPTS.md](SCRIPTS.md) | npm scripts catalog (root + mobile): what to run, what is redundant |
| [../packages/mobile-config/README.md](../packages/mobile-config/README.md) | Shared mobile plugins, Metro, native rebuild scripts |
| [RUNNING-APPS.md](RUNNING-APPS.md) | All run modes: Metro, Expo Go, debug native, UAT APK, EAS — plus **native prebuild & brand sync** |
| [DEPLOYMENT.md](DEPLOYMENT.md) | PROD vs UAT matrix: portals, mobile EAS, GoDaddy |
| [VERCEL.md](VERCEL.md) | Three Vercel projects, env vars, Supabase auth URLs |
| [SUPABASE-UAT-PROD.md](SUPABASE-UAT-PROD.md) | Dual Supabase projects, migrations, `db:push` |
| [ENVIRONMENT.md](ENVIRONMENT.md) | All env vars: local / UAT / production |
| [SECURITY-VERCEL.md](SECURITY-VERCEL.md) | Portal + Supabase security on Vercel |
| [RATE-LIMITING.md](RATE-LIMITING.md) | Edge Function rate limits + Auth Attack Protection / CAPTCHA checklist |
| [SEO.md](SEO.md) | Marketing site SEO & GoDaddy deploy |
| [LAUNCH.md](LAUNCH.md) | Soft-launch checklist (marketing + stores + account deletion) |

## Ops & billing

| Doc | Purpose |
| --- | ------- |
| [BILLING.md](BILLING.md) | Supabase, Vercel, EAS, Maps, store fees |
| [EMAILS.md](EMAILS.md) | Business email setup & DNS |
| [TODO.md](TODO.md) | Dated release & ops checklist |
| [GOOD_ENAHNCEMENTS.md](GOOD_ENAHNCEMENTS.md) | Enhancement backlog notes |

## Architecture & test guides (Word)

| File | Regenerate |
| --- | ---------- |
| [OorjaMan-Architecture.docx](OorjaMan-Architecture.docx) | `npm run docs:architecture` |
| [OorjaMan-Costing.docx](OorjaMan-Costing.docx) | `npm run docs:costing` |
| [OorjaMan-Vendor-Technician-Onboarding-Prerequisites.docx](OorjaMan-Vendor-Technician-Onboarding-Prerequisites.docx) | `npm run docs:onboarding-prerequisites` |
| [OorjaMan-Functional-Test-Spec.docx](OorjaMan-Functional-Test-Spec.docx) | `npm run docs:functional-test` |
| [OorjaMan-E2E-Test-Guide.docx](OorjaMan-E2E-Test-Guide.docx) | `npm run docs:uat-guide` |

## Related (`docs/`)

| Doc | Purpose |
| --- | ------- |
| [docs/android-local-apk.md](../docs/android-local-apk.md) | UAT APK without EAS cloud |
| [docs/ios-qa-distribution.md](../docs/ios-qa-distribution.md) | UAT iOS on physical devices (EAS internal) |
| [docs/customer-push-setup.md](../docs/customer-push-setup.md) | Customer support push |
| [docs/technician-push-setup.md](../docs/technician-push-setup.md) | Partner support push |
| [docs/booking-notifications-realtime.md](../docs/booking-notifications-realtime.md) | Admin/vendor realtime bells |
