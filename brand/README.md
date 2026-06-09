# OorjaMan brand assets (single source of truth)

All apps derive icons and logos from **`brand/source/`** at the repo root.

## Drop your files here

Put your designer exports in `brand/source/` using these names:

| File | Your file | Used for |
|------|-----------|----------|
| **`logo-icon.png`** (or `.jpg`) | Logo **without** text — icon/mark only | App icons, Android notification, compact loaders |
| **`logo-lockup-tagline.png`** (or `.jpg`) | Logo **with** OorjaMan + **WE CLEAN. YOU GENERATE.** | Splash, login, marketing, letterhead |
| **`logo-lockup.png`** (optional) | Logo with wordmark, **no** tagline | Email headers, admin sidebar (optional) |
| **`branding-kit.png`** (optional) | Full kit sheet | Reference only — not copied to apps |

**Tips for exact look:**
- Prefer **PNG with transparent background** for `logo-icon` (crop tight to the circular O only — no wordmark, no white box, ~1024×1024).
- `brand:sync` trims empty padding and scales the O to **~90%** of the app icon canvas so it does not look tiny on the home screen.
- `logo-lockup-tagline` can match your JPEG on white — splash uses a **white** background.
- JPEG is accepted; the sync script converts to PNG for mobile and web.

## Splash behaviour (customer app)

1. **Native splash** (instant, static): white screen + **icon only** — no tagline.
2. **Animated splash** (in-app): full lockup + tagline with pulsing ring, logo entrance, and progress bar (~2.4s).

Run `npm run brand:sync` after updating masters. Then restart Expo with cache clear: `npx expo start -c`.

## Sync to all apps

From the repo root:

```bash
npm run brand:sync
```

This copies/resizes into:

- `apps/customer-app/assets/images/` + `assets/brand/`
- `apps/technician-app/assets/images/` + `assets/brand/`
- `apps/admin-web/public/`
- `apps/vendor-web/public/`
- `apps/support-web/public/`
- `apps/oorjaman-web/public/`

Commit both **`brand/source/`** (your masters) and the generated copies under each app (or run `brand:sync` in CI before build).

## Tagline rules

| Surface | Tagline |
|---------|---------|
| App icon, notification icon | No |
| Splash, login, marketing, print | Yes |

## Regenerate from SVG (fallback)

If you only have SVGs (no PNG yet), the customer app can still rasterize placeholders:

```bash
npm run brand:generate -w customer-app
```

Replace SVGs in `apps/customer-app/assets/brand/svg/`, then prefer **`brand:sync`** once you have real PNGs in `brand/source/`.
