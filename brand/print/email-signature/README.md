# Email signature

## Generate (recommended)

**Admin → Dashboard → Brand print** → Email signatures tab  
https://oorjaman-admin.vercel.app/dashboard/brand-collateral

Preview in the UI → **Copy for Gmail/Outlook** or download HTML + lockup PNG. The admin flow uses a hosted logo URL suitable for live email (`https://oorjaman.com/...`), not Vercel UAT URLs.

## Optional CLI

```bash
npm run brand:print
```

Writes `oorjaman-email-signature.html` and `oorjaman-email-signature-lockup.png` here (gitignored). Uses company-default `CONTACT` in [`scripts/generate-brand-print.mjs`](../../../scripts/generate-brand-print.mjs) and embeds the lockup as a data URI (local preview only — upload PNG to your site for production email).
