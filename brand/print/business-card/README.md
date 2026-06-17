# Business card

**Size:** 90 × 54 mm (India standard)

## Generate (recommended)

**Admin → Dashboard → Brand print** → Business cards tab  
https://oorjaman-admin.vercel.app/dashboard/brand-collateral

Enter name and title → download front/back PDF or PNG per person.

## Optional CLI

```bash
npm run brand:print
```

Writes `oorjaman-business-card-front-v1.pdf` and `oorjaman-business-card-back-v1.pdf` here (gitignored). Uses placeholder name/title from `CONTACT` in [`scripts/generate-brand-print.mjs`](../../../scripts/generate-brand-print.mjs).

Send both PDFs to your printer with 3 mm bleed if they offer a die-cut template on 90×54 mm stock.
