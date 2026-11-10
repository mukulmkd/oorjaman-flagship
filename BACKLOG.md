# OorjaMan backlog

Living list of **open** work. Dated session checklists stay in [`project-docs/TODO.md`](project-docs/TODO.md). Enhancement ideas stay in [`project-docs/GOOD_ENAHNCEMENTS.md`](project-docs/GOOD_ENAHNCEMENTS.md).

Update this file when something ships or a new must-do appears.

---

## P0 — Do soon (risk / continuity)

| ID | Item | Notes |
| --- | --- | --- |
| B-001 | **Upgrade Google Cloud billing before trial ends** | Console shows ~**30 days** left on the free trial. Upgrade to a paid billing account so Maps / related APIs keep working. Unused trial credit carries over until the original trial window ends. Set a low budget alert ($10–50). OorjaMan mainly uses Maps SDK (unlimited free), Static Maps, and optional Directions — see [project-docs/BILLING.md](project-docs/BILLING.md) and [Maps pricing](https://developers.google.com/maps/billing-and-pricing/pricing). |
| B-002 | **Commit / ship local develop work still uncommitted** | Working tree has Admin invoices + tax PDF, vendor-assignment Resend email, book date/time split, AppUpdateGate foreground refresh, customer contact on ops surfaces, related API changes. Decide commit + deploy (portals / OTA) vs park. |
| B-003 | **Confirm PROD Supabase PITR / backup retention** | Production hardening; not launch-blocking but ops-critical. From [TODO.md](project-docs/TODO.md). |
| B-004 | **Error tracking + Supabase log alerts + uptime** | Same hardening pass as B-003. |

---

## P1 — Product / finance / ops

| ID | Item | Notes |
| --- | --- | --- |
| B-010 | **RazorpayX partner visit payouts** | Not built. Finance ledger Approve / Mark settled is manual bank transfer today. Spec: [RAZORPAYX-PAYOUTS.md](RAZORPAYX-PAYOUTS.md). Needs RazorpayX on existing account, secure fund-account storage, idempotent edge payout + webhooks. |
| B-011 | **Admin duplicate API / Network storm pass** | Operations desk and Bookings still re-enrich labels and refetch noisily. Open checklist under **2026-05-19** in [TODO.md](project-docs/TODO.md). |
| B-012 | **Full `db:baseline` disaster-recovery bootstrap** | Needs Docker; one-command base DDL. [TODO.md](project-docs/TODO.md). |
| B-013 | **Portal CSP: remove `'unsafe-inline'`** | Hashes or nonces. [TODO.md](project-docs/TODO.md). |
| B-014 | **Re-scan `npm audit` after next Expo SDK bump** | Remaining items were transitive / build-time. |

---

## P1 — National KPIs (parked metrics)

Scorecard exists at Admin `/dashboard/kpis`. Still parked until definitions / data model exist — see [KPI-DASHBOARD-PLAN.md](KPI-DASHBOARD-PLAN.md):

- Booking conversion (no enquiry/lead object)
- Unified complaints count
- Vendor cancellation rate (definition)
- No-show rate (folded into cancelled today)
- Issue resolution time (ops vs support)
- Green / amber / red targets + weekly review log
- Training assessments / SOPs / risk register

---

## P2 — Quality / moderation enhancements

From [GOOD_ENAHNCEMENTS.md](project-docs/GOOD_ENAHNCEMENTS.md):

1. Dedicated feedback moderation page (filters, search)
2. Moderation audit trail (who / when / reason)
3. Auto-flag risky feedback (assistive only)
4. Stronger mandatory rating UX
5. Rating confidence bands
6. 7-day vs 30-day rating trend cards
7. (Later) ML sentiment labels; moderation SLA buckets

---

## P2 — Marketing / SEO / web

From [SEO.md](project-docs/SEO.md) “Revisit later”:

- More city pages; blog → MDX/CMS; Hindi (`hreflang`)
- Cookie consent + analytics (Plausible / GA4) if pixels are added
- Google Business Profile; real pricing from Supabase on web (optional)
- App Site Association + Digital Asset Links for store deep links
- Lighthouse ≥ 90; structured-data audit after major releases

Universal web deferrals ([WEB-UNIVERSAL.md](project-docs/WEB-UNIVERSAL.md)):

- Web Push
- Background-style GPS on Partner web (En Route still requires geolocation)
- Partner in-app PDF preview on web (“coming soon” stub)

---

## P2 — Distribution / QA

| ID | Item | Notes |
| --- | --- | --- |
| B-030 | Android UAT EAS builds for teammates | Secrets + `uat` profile builds + smoke — [TODO.md](project-docs/TODO.md) **2026-05-20**. Local APK path already works. |
| B-031 | Launch / announce ops leftovers | Marketing DNS/env, Search Console, lawyer legal review, GSTIN / registered address — open boxes in [LAUNCH.md](project-docs/LAUNCH.md). |

---

## Done recently (do not re-open without cause)

Track detail in git history / [TODO.md](project-docs/TODO.md) archive. Notable:

- Customer + Partner production OTAs (runtime `1.0.1`) including foreground OTA gate behavior
- Vendor assignment email Edge Function (UAT soft-skip Resend; PROD live)
- Admin national KPIs scorecard (computable subset)
- Live mobile OTP path (MSG91) shipped in product; UI may still gate by env/config in some builds

---

## How to use

1. Prefer editing **this file** for cross-cutting “what’s left.”
2. Put day-by-day execution checklists in `project-docs/TODO.md`.
3. Keep deep specs in their own docs (RazorpayX, KPI plan, SEO) and link from here.
