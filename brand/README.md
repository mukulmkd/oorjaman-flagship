# OorjaMan brand assets (single source of truth)

All apps derive icons and logos from **`brand/source/`** at the repo root.

**Print & stationery** (letterhead, business cards, email signatures, invoice) — generate in the **admin portal**, not from files in this repo:

| Workflow | How |
|----------|-----|
| **Primary** | Admin → **Dashboard → Brand print** — https://oorjaman-admin.vercel.app/dashboard/brand-collateral (or `npm run admin`) |
| **Optional CLI** | `npm run brand:print` → writes gitignored files under [`brand/print/`](print/README.md) (company-default contact only) |

Shared layout code: **`packages/utils/src/brand-print/`**. Logo masters: **`brand/source/`**. Print outputs are **not** synced into mobile/web apps.

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

- `apps/customer-app/assets/images/` + `assets/brand/` — **native** launcher, splash, notifications (`app.config.ts`)
- `apps/technician-app/assets/images/` + `assets/brand/` — same (partner badge on launcher icons)
- `packages/ui/assets/brand/` — **in-app JS** branding (`@oorjaman/ui` → `BrandSplash`, `BrandLockup`, etc.)
- `apps/admin-web/public/`
- `apps/vendor-web/public/`
- `apps/support-web/public/`
- `apps/oorjaman-web/public/` (OG image only from lockup master)

### Mobile: two asset paths

| Layer | Path | Used for |
|-------|------|----------|
| **Native** | `apps/<app>/assets/images/` | Home-screen icon, pre-JS splash, Android adaptive icon, notification icon |
| **In-app (JS)** | `packages/ui/assets/brand/` | Animated splash, login lockup, sunburst — bundled via Metro from `@oorjaman/ui` |

Both are updated on a **full** `npm run brand:sync`. `brand:sync:web` (`--web-only`) skips mobile native assets and `packages/ui`.

Shared React Native brand components live in **`packages/ui/src/brand/`** (`BrandSplash`, `BrandLockup`, …). Use `variant="partner"` on technician app screens.

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

Edit `apps/customer-app/assets/brand/svg/sunburst.svg`, then run the command above. Output goes to `apps/customer-app/assets/brand/sunburst.png` **and** `packages/ui/assets/brand/sunburst.png`. Logo icons and lockups always come from **`brand:sync`**.

---

## Print specifications

Generate collateral from **`brand/source/`** masters via **Admin → Brand print** (see above). Specs for designers and printers:

| Item | Size | Bleed | Safe margin | Notes |
|------|------|-------|-------------|--------|
| **Letterhead** | A4 — 210 × 297 mm | 3 mm (if full-bleed bg) | 20 mm | PDF/X-1a for print; lockup in header |
| **Business card** | 90 × 54 mm (India) or 85 × 55 mm (ISO) | 3 mm | 5 mm inside trim | 300 DPI; separate front/back PDFs |
| **Email signature** | ~600 px max width | — | — | HTML from Admin Brand print (hosted logo URL for live email) |

### Colours (hex — convert to CMYK with your printer)

| Token | Hex | Use |
|-------|-----|-----|
| Oorja green | `#549048` | “Oorja” in wordmark |
| Man navy | `#1C4276` | “Man”, headings |
| Tagline grey | `#9B9B9B` | Tagline |
| Primary UI green | `#1f8660` | Links, accents in email sig |
| Body text | `#0f2938` | Letter copy |
| Secondary text | `#516a7b` | Titles, footer |

Source of truth in code: `packages/config/src/brand.ts`, `packages/config/src/colors.ts`.

### Typography

| Use | Font | Weight |
|-----|------|--------|
| Headings, name on card | Plus Jakarta Sans | SemiBold (600) |
| Body, letter text | Plus Jakarta Sans | Regular (400) |
| Print fallback | Arial, Helvetica | — |

### What not to do

- Do **not** put letterhead or card PDFs under `apps/*` — apps only consume `npm run brand:sync` outputs.
- Do **not** use `logo-icon.png` alone on letterhead when the full lockup fits — use `logo-lockup-tagline.png`.
- Do **not** embed UAT or internal URLs in customer-facing print or email signatures.

Folder details: [print/letterhead/](print/letterhead/README.md) · [print/business-card/](print/business-card/README.md) · [print/email-signature/](print/email-signature/README.md)
