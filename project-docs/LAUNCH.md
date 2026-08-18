# Marketing site + store launch checklist

> **Master status tracker: [`PROD_CHECKLIST.md`](../PROD_CHECKLIST.md) (repo root).** That file owns overall launch status/sign-off; this doc is the marketing/store **runbook detail**. Update status there, follow steps here.

Operational checklist for shipping **oorjaman.com** and store-facing legal URLs. Detail lives in [SEO.md](SEO.md), [DEPLOYMENT.md](DEPLOYMENT.md), and [EMAILS.md](EMAILS.md).

---

## Done in product (engineering)

- [x] Brand chrome, waitlist download (until store URLs set), partner CTA fail-closed
- [x] Legal suite at `/legal/*` including account deletion URL for App Store / Play
- [x] **In-app account deletion** — Profile → Delete account → Edge Function `delete-customer-account`
- [x] Public emails live (`support@` / `privacy@` / `legal@` / `info@`) — see EMAILS.md
- [x] FAQ, cities, blog depth for soft launch SEO
- [x] Company legal name + Guwahati registered-office placeholder on About / Contact
- [x] Optional GSTIN via `NEXT_PUBLIC_COMPANY_GSTIN` (omit until verified)

---

## Ops — before public announce

### Marketing host (GoDaddy)

- [ ] DNS `A` / `CNAME` for `oorjaman.com` + `www` → hosting
- [ ] HTTPS + `www` → apex redirect
- [ ] Prod env for marketing build:
  - `NEXT_PUBLIC_DEPLOY_ENV=production`
  - `NEXT_PUBLIC_SITE_URL=https://oorjaman.com`
  - `NEXT_PUBLIC_VENDOR_PORTAL_URL=https://vendor.oorjaman.com` (https only)
  - Store URLs when live: `NEXT_PUBLIC_APP_STORE_URL`, `NEXT_PUBLIC_PLAY_STORE_URL`
  - Optional: `NEXT_PUBLIC_COMPANY_GSTIN`
- [ ] Build & upload: `npm run build:godaddy -w oorjaman-web` → `apps/oorjaman-web/out/` → `public_html`
- [ ] Smoke: home, `/download`, `/legal/privacy-policy`, `/legal/account-deletion`, `/contact`, `/pricing`

### Supabase (Prod)

- [ ] Deploy function: `npm run functions:deploy -- delete-customer-account` (UAT first, then Prod)
- [ ] Confirm JWT verify enabled (customer must be signed in)
- [ ] Smoke delete on a **throwaway UAT** customer with no open bookings

### Mobile / stores

- [ ] `EXPO_PUBLIC_SITE_URL=https://oorjaman.com` on production EAS profile
- [ ] Paste store listing URLs: Privacy, Terms, Account deletion → oorjaman.com paths in [SEO.md](SEO.md)
- [ ] Contact email on listings = `support@oorjaman.com`
- [ ] When listings live: set store env vars on marketing and redeploy `/download`

### Legal / counsel

- [ ] Lawyer review of all `/legal/*` (engineering drafts; lastUpdated 2026-08-08)
- [ ] Confirm company GSTIN before setting `NEXT_PUBLIC_COMPANY_GSTIN`
- [ ] Confirm registered office address (replace Guwahati placeholder with LLP Form-2 / records address via `NEXT_PUBLIC_COMPANY_ADDRESS`)

### Search

- [ ] Google Search Console → property `https://oorjaman.com` → submit `sitemap.xml`
- [ ] Optional Bing Webmaster Tools

---

## Deploy function (account deletion)

```bash
# Link CLI to the target project first, then:
npm run functions:deploy -- delete-customer-account
```

Client path: `userApi.requestDeleteMyCustomerAccount` → Profile confirm UI.

---

## Related

- [SEO.md](SEO.md) — robots, sitemap, store URL table
- [DEPLOYMENT.md](DEPLOYMENT.md) — 8-host matrix
- [EMAILS.md](EMAILS.md) — mailboxes
- [ENVIRONMENT.md](ENVIRONMENT.md) — env vars + edge functions
