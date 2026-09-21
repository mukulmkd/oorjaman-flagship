# Partner app — Play Store listing assets

Mirror of `apps/customer-app/store-listing/` for **OorjaMan Partner** (`com.oorjaman.technician`).

## Layout

| Path | Purpose |
|------|---------|
| `graphics/` | App icon (512) + feature graphic (1024×500) |
| `screenshots/` | Full capture masters |
| `play-upload/` | Curated set for Play Console |

## Capture notes

- Prefer a **PROD** or production-like build (not UAT-labelled status bar).
- Phone-only targeting is in `app.config.ts`; reuse phone screenshots for tablet slots if Play still asks before the phone-only AAB is live.
- Suggested screens: home / jobs, job detail, safety checklist, en route / location, profile.

Brand icons can be synced with `npm run brand:sync` from the app (or repo root brand scripts).
