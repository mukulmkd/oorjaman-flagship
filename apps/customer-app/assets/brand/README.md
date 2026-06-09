# OorjaMan customer app brand assets

**Single source of truth:** put your master files in **`brand/source/`** at the repo root, then run:

```bash
npm run brand:sync
```

from the monorepo root. This folder receives copies for the Expo bundle.

## Usage rules

| Asset | Tagline |
|-------|---------|
| `logo-icon.*` | No |
| `logo-lockup-tagline.*` | Yes (`WE CLEAN. YOU GENERATE.`) |

**Tagline required:** marketing, splash, in-app animated splash, letterhead, email, invoice, social.

**Tagline not used:** app icon, Android notification icon, compact in-app loader icon.

## Source files

- `svg/logo-icon.svg` — icon only
- `svg/logo-lockup-tagline.svg` — lockup + tagline
- `svg/notification-icon.svg` — white mono for Android notifications
- `splash-progress.json` — Lottie progress bar for splash and `BrandLoader`

## Regenerate PNGs

From `apps/customer-app`:

```bash
npm run brand:generate
```

This updates `assets/images/icon.png`, `adaptive-icon.png`, `splash-icon.png`, `notification-icon.png`, and `assets/brand/*.png`.

Replace the SVGs with exports from your designer file, then re-run the script.
