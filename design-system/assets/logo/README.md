# Logo assets (pointers — do not redraw)

OorjaMan’s mark is **not** recreated here. Use the masters in `brand/source/` and copies synced by `npm run brand:sync`.

## Primary files

| File | Path from repo root | Use |
| --- | --- | --- |
| Symbol (master) | `brand/source/logo-icon.png` | 1536×1024, alpha. Crop/sync to square. |
| In-app symbol | `packages/ui/assets/brand/logo-icon.png` | 1024×1024, alpha. Splash / lockup. |
| Local copy | `design-system/assets/logo/logo-icon-1024.png` | Same 1024 O, for opening this folder. |
| Lockup | `brand/source/logo-lockup-tagline.png` | 5632×3072, **opaque white**. Print / OG only. |
| Notification | `brand/source/notification-icon.png` | 96×96 white O. |
| Partner launcher | `apps/technician-app/assets/images/icon.png` | O + person badge, baked. |

## Rules (EXTRACTED)

- Split wordmark: **Oorja** `#549048` + **Man** `#1C4276`. Never one flat colour.
- Tagline `WE CLEAN. YOU GENERATE.` in `#9B9B9B`, uppercase, wide tracking.
- On white product UI, compose the wordmark as **text**, not the lockup PNG (white box).
- Partner = same O + circular person badge (white fill, `#549048` ring, `#1C4276` glyph).
- App icons: no tagline.

## Missing (OBSERVED)

SVG O, reverse lockup, transparent lockup, no-tagline horizontal lockup.
