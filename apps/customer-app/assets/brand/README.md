# OorjaMan customer app brand assets

**Single source of truth:** put your master files in **`brand/source/`** at the repo root, then run:

```bash
npm run brand:sync
```

from the monorepo root. This folder receives copies for the Expo bundle.

## Bundled assets

| Asset | Tagline | Used for |
|-------|---------|----------|
| `logo-icon.png` | No | Splash icon, composed lockup, loaders |
| `sunburst.png` | No | Decorative background on splash |

Splash and login use a **composed** lockup (`BrandWordmark` + tagline text), not a raster lockup PNG.

## Regenerate sunburst PNG

From `apps/customer-app`:

```bash
npm run brand:generate
```

This rasterizes `svg/sunburst.svg` into `sunburst.png`. Icons and notification assets come from `brand:sync`.
