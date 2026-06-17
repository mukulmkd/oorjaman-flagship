# OorjaMan — email & mailbox tracker

Single place to review **public addresses**, **UAT seed personas**, **system senders**, and **internal mailboxes** before DNS, Supabase Auth, and notification providers go live on production.

**Status key:** ✅ In code/docs today · 🟡 Proposed — review later · ⬜ Not started (DNS / inbox)

---

## Public — `@oorjaman.com` (customer & compliance)

| Address | Status | Owner (TBD) | Used for | Code / doc refs |
|---------|--------|-------------|----------|-----------------|
| **support@oorjaman.com** | ✅ | Support | Customer help, bookings, escalations, account deletion (email path) | `apps/oorjaman-web/lib/site.ts`, legal docs, `/contact` |
| **privacy@oorjaman.com** | ✅ | Privacy / DPO | Data access, correction, deletion, privacy complaints | `apps/oorjaman-web/lib/site.ts`, privacy policy |
| **legal@oorjaman.com** | ✅ | Legal | Terms, partner agreements, compliance | `apps/oorjaman-web/lib/site.ts`, legal pages |
| **info@oorjaman.com** | ✅ | Marketing / ops | General company contact; brand print default | `packages/utils/src/brand-print/types.ts`, `scripts/generate-brand-print.mjs` |

**Staff naming (print / collateral):** `firstname.lastname@oorjaman.com` — see `suggestBrandEmailFromName()` in `packages/utils/src/brand-print/types.ts`.  
Legacy `@oorjaman.in` in UAT seeds is normalized to `@oorjaman.com` for print (`normalizeBrandEmail()`).

**DNS (production):** Configure inboxes or forwards for support / privacy / legal — see [SEO.md](SEO.md) pre-launch checklist.

---

## Proposed public mailboxes — review later

Not in product code yet. Ratify owner, forward-to, and whether each is a real inbox vs alias.

| Address | Status | Suggested owner | Suggested use |
|---------|--------|-----------------|---------------|
| **noreply@oorjaman.com** | 🟡 | System / eng | OTP, booking confirmations, receipts — no human replies |
| **billing@oorjaman.com** | 🟡 | Finance | Invoices, settlements, AMC payment questions |
| **partners@oorjaman.com** | 🟡 | Vendor ops | Partner onboarding, `/partners` enquiries |
| **hello@oorjaman.com** | 🟡 | Marketing | Optional campaigns alias → `info@` |
| **sales@oorjaman.com** | 🟡 | Commercial | B2B / multi-site (when sales motion exists) |
| **security@oorjaman.com** | 🟡 | Engineering / founder | Vulnerability reports |
| **abuse@oorjaman.com** | 🟡 | Trust & safety | Chat / conduct abuse reports |

**Avoid for customer-facing product:** `dev@`, `engineering@` — prefer internal groups (Slack / Google Group) unless you explicitly want a public-facing tech contact.

---

## Internal / operations — review later

| Address | Status | Notes |
|---------|--------|-------|
| **ops@oorjaman.com** | 🟡 | Optional internal escalations; not referenced in apps today |
| **engineering@oorjaman.com** | 🟡 | Internal only |
| **dev@oorjaman.com** | 🟡 | DNS/testing only if needed — not for marketing or support pages |

---

## UAT & dummy auth (not production inboxes)

| Pattern | Status | Purpose |
|---------|--------|---------|
| **`u{phone_digits}@oorjaman-dummy.test`** | ✅ | Supabase Auth email for dummy password login; hidden in UI | `packages/api/src/auth/auth-api.ts`, `scripts/seed-dummy-test-users.mjs` |
| **`@oorjaman.test`** | ✅ | Extra seeded customer personas | `scripts/seed-dummy-test-users.mjs` |
| OTP **`123456`**, password **`TestOtp123!`** | ✅ | UAT dummy auth (match `DUMMY_AUTH_PASSWORD` / `VITE_USE_DUMMY_AUTH`) | [ENVIRONMENT.md](ENVIRONMENT.md), [VERCEL.md](VERCEL.md) |

**Rule:** Do **not** seed dummy users on production Supabase unless intentional — [SUPABASE-UAT-PROD.md](SUPABASE-UAT-PROD.md).

---

## UAT seed personas — display emails

Source: `npm run seed:dummy-users` → `scripts/seed-dummy-test-users.mjs`.  
**Auth** uses `u{phone}@oorjaman-dummy.test`; **`public.users.email`** uses the display column below.

### OorjaMan staff (seed)

| Role | Phone | Display email | Portal |
|------|-------|---------------|--------|
| Admin | +919000000101 | priya.sharma@oorjaman.in | Admin |
| Admin | +919000000102 | vikram.mehta@oorjaman.in | Admin |
| Support | +919000000111 | ananya.reddy@oorjaman.in | Support desk |
| Support | +919000000112 | karthik.nair@oorjaman.in | Support desk |

🟡 **Review:** Align display emails to `@oorjaman.com` (`priya.sharma@oorjaman.com`, etc.) for consistency with brand print.

### Vendors & technicians (fictional partner orgs)

| Role | Phone | Display email |
|------|-------|---------------|
| Vendor | +919000000201 | contact@gamusagreen.in |
| Vendor | +919000000202 | contact@bharatsun.in |
| Technician | +919000000301 | amit.das@gamusagreen.in |
| Technician | +919000000303 | ravi.iyer@gamusagreen.in |
| Technician | +919000000304 | deepak.menon@gamusagreen.in |
| Technician | +919000000302 | sanjay.pillai@bharatsun.in |
| Technician | +919000000305 | suresh.babu@bharatsun.in |
| Technician | +919000000306 | manoj.krishnan@bharatsun.in |

### Customers (seed)

| Phone | Display email |
|-------|---------------|
| +919000000401 | raju.mahalingam@gmail.com |
| +919000000402 | rajesh.kumar@gmail.com |
| +919000000403 | teammate.customer1@oorjaman.test |
| +919000000404 | teammate.customer2@oorjaman.test |
| +919000000405 | teammate.customer3@oorjaman.test |
| +919000000406 | teammate.customer4@oorjaman.test |

---

## Transactional / notification senders — review later

| Item | Status | Notes |
|------|--------|-------|
| From address for SMS/email/WhatsApp templates | 🟡 | Notification copy in DB / `packages/api` — confirm `noreply@` vs `support@` per channel |
| Reply-to for support-related emails | 🟡 | Likely `support@oorjaman.com` |
| Hosted logo URL in email signatures | ✅ | Production `https://oorjaman.com/...` — see `brand/print/email-signature/README.md` |

---

## Free setup options (GoDaddy domain)

Domain is registered on **GoDaddy** ([DEPLOYMENT.md](DEPLOYMENT.md)). GoDaddy does **not** include free business mailboxes with a domain alone (legacy Workspace Email is retired). Free paths are usually **third-party forwarding** or **Zoho Mail Forever Free**.

**Status:** 🟡 Options documented — pick one (or a combo) when implementing DNS.

### GoDaddy-native (limited)

| Option | Cost | What you get | When it applies |
|--------|------|--------------|-----------------|
| **Legacy Email Forwarding product** | $0 only if already on account | Alias → external inbox; no mailbox | Check GoDaddy **My Products** for old forwarding credits |
| **cPanel email forwarders** | $0 on top of hosting | Forward `support@` → Gmail, etc. | Only if you have **Web Hosting (cPanel)** for `oorjaman.com` — [GoDaddy cPanel forwarders](https://www.godaddy.com/help/set-up-email-forwarders-in-my-web-hosting-cpanel-account-8864) |
| **Professional Email / Microsoft 365** | Paid | Real inboxes + forwarding | Not free — use when team outgrows free tiers |

### Third-party — $0 tiers (recommended to evaluate)

| Option | Real inbox? | Receive `@oorjaman.com` | Send as `@oorjaman.com` | DNS at GoDaddy? | Limits / catches |
|--------|-------------|-------------------------|-------------------------|-----------------|------------------|
| **[Zoho Mail Forever Free](https://www.zoho.com/mail/zohomail-pricing.html)** | Yes — up to **5 users** | Yes | Yes (web + Zoho app) | Yes — change **MX** to Zoho | No IMAP/POP on free; region/data-center limits; 5 GB/user |
| **[Cloudflare Email Routing](https://www.cloudflare.com/products/email-routing/)** | No — forward only | Yes | Via Gmail “Send mail as” + SMTP setup | No — nameservers → Cloudflare (domain can stay registered at GoDaddy) | Receive-only; outbound not native |
| **[ImprovMX Free](https://improvmx.com/pricing/)** | No — forward only | Yes | Paid tier for SMTP send | Yes — change **MX** to ImprovMX | 1 domain, **25 aliases**, **500 forwards/day** |
| **Gmail personal + forwarding** | Uses your Gmail | Via Cloudflare or ImprovMX | “Send mail as” (SPF/DKIM fiddly) | Depends on forwarder | Google Workspace is **not** free |

### Transactional send (`noreply@`) — separate from GoDaddy mail

Product OTP and notification email usually does **not** use a GoDaddy mailbox:

| Service | Typical free tier | Role |
|---------|-------------------|------|
| **Resend** (or similar) | Limited sends/month | `noreply@oorjaman.com` for app transactional mail |
| **Supabase Auth** | Included with project | Auth emails; customize templates + custom SMTP for prod |

Configure **SPF / DKIM** for whichever service sends as `@oorjaman.com`.

### Suggested early-stage combo (PO default — review later)

| Address type | Free approach |
|--------------|---------------|
| **support@**, **privacy@**, **legal@**, **info@** | **Zoho free** (≤5 people, real replies) **or** **ImprovMX / Cloudflare** → one Gmail |
| **noreply@** | Resend / Supabase SMTP — not GoDaddy |
| **partners@**, **billing@** (when live) | Extra Zoho user or ImprovMX alias → same inbox |

Many founders start with **ImprovMX or Cloudflare → Gmail**, then add **Zoho** when support volume needs a shared inbox.

### DNS records (any option)

Edit in **GoDaddy DNS** (or **Cloudflare** if nameservers moved):

- **MX** — where inbound mail is delivered (Zoho / ImprovMX / Cloudflare)
- **SPF (TXT)** — which services may send mail for `@oorjaman.com`
- **DKIM** — deliverability for Zoho, Resend, etc.

Wrong MX is the most common reason `support@` never arrives.

### Decision log (fill in when chosen)

| Field | Choice |
|-------|--------|
| **Inbound (receive)** | ⬜ Zoho · ⬜ ImprovMX · ⬜ Cloudflare · ⬜ GoDaddy cPanel · ⬜ Other: ___ |
| **Outbound (human reply)** | ⬜ Same as inbound · ⬜ Gmail send-as · ⬜ Other: ___ |
| **Transactional (`noreply@`)** | ⬜ Resend · ⬜ Supabase default · ⬜ Other: ___ |
| **Forward-to / admin inbox** | ⬜ ___ |
| **Date decided** | ⬜ ___ |

---

## Review checklist (when you pick this up)

- [ ] Choose **free setup option(s)** from section above; fill **Decision log**
- [ ] Confirm final list of **production** `@oorjaman.com` mailboxes and owners
- [ ] Set up **MX / SPF / DKIM** for chosen provider (GoDaddy DNS or Cloudflare)
- [ ] Set up inboxes or forwards for support, privacy, legal, info
- [ ] Decide **noreply@** + **billing@** + **partners@** before GoDaddy prod cutover
- [ ] Align **seed script** staff emails to `@oorjaman.com` if desired
- [ ] Configure **Supabase Auth** email templates (prod) — no dummy domain
- [ ] Configure **notification provider** From / Reply-To per environment (UAT vs prod)
- [ ] Update [SEO.md](SEO.md) and [DEPLOYMENT.md](DEPLOYMENT.md) if addresses change
- [ ] App Store / Play listing contact emails match this doc

---

## Related docs

- [DEPLOYMENT.md](DEPLOYMENT.md) — domains, env tiers, prod vs UAT
- [ENVIRONMENT.md](ENVIRONMENT.md) — dummy auth, seed commands
- [SEO.md](SEO.md) — email DNS on launch
- [brand/README.md](brand/README.md) — print collateral & signatures

_Last updated: 2026-05-19 — added free GoDaddy-domain setup options._
