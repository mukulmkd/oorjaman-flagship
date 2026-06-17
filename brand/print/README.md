# OorjaMan print & stationery

**Primary workflow:** Admin portal → **Dashboard → Brand print**  
https://oorjaman-admin.vercel.app/dashboard/brand-collateral (or `npm run admin` locally)

Enter a person’s name, title, phone, and email → preview → download PDFs, PNGs, and email HTML. Includes **business cards**, **letterhead**, **email signature**, and **invoice template**.

Layout and drawing logic live in **`packages/utils/src/brand-print/`** (shared with the admin UI). Logo masters: **`brand/source/`**.

---

## Optional CLI export

For batch exports with **company-default** contact (hardcoded in the script), not per-person:

```bash
npm run brand:print
```

Outputs land under this folder (`letterhead/`, `business-card/`, `email-signature/`). **They are gitignored** — do not commit generated PDFs/PNGs/SVGs/HTML.

To change CLI defaults, edit `CONTACT` in [`scripts/generate-brand-print.mjs`](../../scripts/generate-brand-print.mjs).

---

## Expected CLI filenames (after `brand:print`)

| Path | Description |
|------|-------------|
| `letterhead/oorjaman-letterhead-a4-v1.pdf` | A4 letterhead |
| `business-card/oorjaman-business-card-front-v1.pdf` | Card front (90×54 mm) |
| `business-card/oorjaman-business-card-back-v1.pdf` | Card back |
| `business-card/*.png` | 300 DPI previews |
| `business-card/*.svg` | Vector intermediates |
| `email-signature/oorjaman-email-signature.html` | Sample HTML (local preview only) |
| `email-signature/oorjaman-email-signature-lockup.png` | Raster lockup for email clients |

---

## Masters & colours

| Source | Use |
|--------|-----|
| `brand/source/logo-lockup-tagline.png` | Letterhead header, card front, email |
| `brand/source/logo-icon.png` | Watermarks |

Colours: `packages/config/src/brand.ts`

## App icons

Digital app icons come from **`npm run brand:sync`** only — do not copy print PDFs into `apps/`.

Subfolders: [letterhead/](letterhead/README.md) · [business-card/](business-card/README.md) · [email-signature/](email-signature/README.md)
