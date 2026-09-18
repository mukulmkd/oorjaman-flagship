# Letterhead

A4 print-ready PDF:

- Lockup + tagline header (left)
- Phone, email, website (right)
- Faint O watermark (bottom right, above footer wave)
- Navy + green wave footer with address and tagline

## Generate (recommended)

**Admin → Dashboard → Brand print** → Letterheads tab  
https://oorjaman-admin.vercel.app/dashboard/brand-collateral

## Optional CLI

```bash
npm run brand:print
```

Writes `oorjaman-letterhead-a4-v1.pdf` here (gitignored).

### Airtel DLT — Letter of Authority

Official Airtel `AUTHORITY_LETTER` wording on OorjaMan letterhead:

```bash
node scripts/generate-airtel-dlt-authorization-letter.mjs
```

Writes `oorjaman-airtel-dlt-authority-letter-YYYY-MM-DD.pdf` here. Print on A4, wet-ink signatures in the blanks, company stamp if required.

To print: open PDF → Print → 100% scale, no margins adjustment unless your printer requires it.
