# OorjaMan brand assets (single source of truth)

All apps derive icons and logos from **`brand/source/`** at the repo root.

## Drop your files here

Put your designer exports in `brand/source/` using these names:

| File | Your file | Used for |
|------|-----------|----------|
| **`logo-icon.png`** (or `.jpg`) | Logo **without** text — icon/mark only | App icons, compact loaders, portal login |
| **`notification-icon.png`** (auto) | **White** O silhouette on **transparent** 96×96 | Android status bar / shade — always regenerated from `logo-icon` on `brand:sync` |
| **`logo-lockup-tagline.png`** (or `.jpg`) | Logo **with** OorjaMan + **WE CLEAN. YOU GENERATE.** | Marketing site OG image, letterhead, print |
| **`branding-kit.png`** (optional) | Full kit sheet | Reference only — not copied to apps |

**Tips for exact look:**
- Prefer **PNG with transparent background** for `logo-icon` (crop tight to the circular O only — no wordmark, no white box, ~1024×1024).
- **iOS** uses the full `icon.png` in notifications. **Android**: white O small icon (`notification-icon.png`) for status bar + left badge on a **white** circle (`#ffffff`); full launcher on the right via `notification_app_icon` drawable.
- `brand:sync` trims empty padding and scales the O to **~90%** of the app icon canvas so it does not look tiny on the home screen.
- JPEG is accepted; the sync script converts to PNG for mobile and web.

## Splash behaviour (mobile apps)

1. **Native splash** (instant, static): white screen + **icon only** — no tagline. **Both iOS and Android** show this before JS loads.
2. **Animated splash** (in-app): composed wordmark + tagline with pulsing ring, logo entrance, and progress bar (~2.4s).

**Android vs iOS:** **`icon.png`** — O at ~88% contain-fit for app drawer / iOS (balanced padding). **Partner app** adds the persona badge on `icon.png` / `adaptive-foreground.png`. **`adaptive-foreground.png`** — ~58% on white for Pixel **home screen** (adaptive circle safe zone). Post-prebuild plugin (`withAndroidWhiteAdaptiveIcon`) writes opaque white foreground + white background bitmap + white monochrome. **Pixel home screen only:** if a green ring persists while the app drawer looks correct, that is Pixel Launcher caching / Material You — uninstall, **remove the home shortcut**, clear **Pixel Launcher** app cache (Settings → Apps → Pixel Launcher → Storage), then reinstall. **Pre-splash:** `splash-android-icon.png` at **`imageWidth: 196`**.

Run `npm run brand:sync` after updating masters, then `npx expo prebuild --platform android` (or iOS) and rebuild. Restart Expo with cache clear: `npx expo start -c`.

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
- `apps/oorjaman-web/public/` (OG image only from lockup master)

Commit both **`brand/source/`** (your masters) and the generated copies under each app (or run `brand:sync` in CI before build).

## Tagline rules

| Surface | Tagline |
|---------|---------|
| App icon, notification icon | No |
| In-app / portal login (composed UI) | Yes — rendered as text |
| Marketing OG, print, email | Yes — raster lockup master |

## Regenerate sunburst (fallback)

If you need to refresh the decorative sunburst PNG:

```bash
npm run brand:generate -w customer-app
```

Edit `apps/customer-app/assets/brand/svg/sunburst.svg`, then run the command above. Logo icons and lockups always come from **`brand:sync`**.
