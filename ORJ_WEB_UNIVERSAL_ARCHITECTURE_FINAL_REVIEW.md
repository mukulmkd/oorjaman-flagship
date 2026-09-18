# OorjaMan Universal Web — Final Architecture Review

**Document:** `ORJ_WEB_UNIVERSAL_ARCHITECTURE_FINAL_REVIEW.md`  
**Reviews:** `ORJ_WEB_UNIVERSAL_ARCHITECTURE_PLAN.md`  
**Date:** 2026-09-18  
**Mode:** Architecture review only — no repository source changes  

---

## 1. Original Objective

| # | Objective |
|---|-----------|
| 1 | Existing Expo Customer App remains intact |
| 2 | Existing Expo Technician App remains intact |
| 3 | Introduce React Native Web for both apps |
| 4 | Achieve functional feature parity between mobile and web |
| 5 | Public OorjaMan web presence must be SSR/SSG and SEO compliant |
| 6 | Avoid duplicate business logic |
| 7 | Preserve current Supabase architecture |
| 8 | Preserve native App Store / Play Store release stability |
| 9 | JavaScript-only is the **preferred** application-development constraint unless the repository makes this technically impractical |

**Interpretation note:** Objective 5 applies to the **public** web presence (crawlable marketing), not to authenticated product shells. Objective 4 means product flows work on web with equivalent outcomes; it does **not** require identical native modules (e.g. Expo Push vs in-app realtime).

---

## 2. Current Plan Summary

The plan proposes:

1. Keep **two separate Expo apps** (`customer-app`, `technician-app`).
2. Keep **`apps/oorjaman-web` (Next.js)** as the public SEO/SSR–SSG authority at `oorjaman.com`.
3. Ship authenticated Customer / Technician product web as **Expo Router + React Native Web CSR** (static `expo export -p web`) on `app.oorjaman.com` / `partner.oorjaman.com`.
4. **Do not** use Expo SSR; **do not** SSR authenticated dashboards.
5. Isolate platform I/O with **`.web.*` / `.native.*`** adapters; keep **`@oorjaman/api`** as the shared domain layer.
6. Preserve Supabase anon + RLS clients; Edge Functions for payments/webhooks; no Express BFF.
7. Prefer continuing **TypeScript** (status quo), treating JS-only as an open question.
8. Phased rollout 0→10 with mobile regression controls.

---

## 3. What Is Correct

These plan recommendations **do** satisfy the original objective and should be retained:

| Topic | Verdict |
|-------|---------|
| Separate Expo apps (no merge) | Correct — separate schemes, EAS, branding, deps |
| RN Web via existing Expo apps (not a new CRA/Vite product app) | Correct — maximizes UI reuse; RN Web already in `mobile-deps` |
| Keep `oorjaman-web` as SEO authority | Correct — already implements public pages + `project-docs/SEO.md` |
| Do not duplicate marketing inside Expo | Correct |
| Authenticated apps = CSR | Correct — no SEO value; session/realtime bound |
| Do not SSR dashboards “for SSR’s sake” | Correct |
| `@oorjaman/api` remains domain layer | Correct |
| Service role stays out of Expo bundles | Correct |
| Realtime client-side only | Correct |
| Payments verify/webhooks server-side (Edge) | Correct |
| `.web` / `.native` adapters over scattered `Platform.OS` in business logic | Correct direction |
| No Express unless a real requirement appears | Correct |
| Mobile stability prioritized over web elegance | Correct |
| Portals (admin/vendor/support) stay Vite | Correct — out of RN Web scope |

**SSR/SEO interpretation check:** The plan’s split (public Next SSR/SSG vs authenticated Expo CSR) is the **correct** reading of “SSR and SEO compliant” given objective 5’s public-web wording and the existing Next marketing site.

---

## 4. What Needs Correction

Issues where the plan is incomplete, soft, or must be tightened **before** implementation:

| # | Issue | Why it matters |
|---|--------|----------------|
| C1 | **“Parity” is softened** (“optional push”, “degraded map”, “best-effort GPS”) without an explicit **Parity Contract** | Objective 4 can be argued either way; without a signed contract, implementers will ship incomplete web |
| C2 | Customer **Definition of Done** omits several matrix items | Preferred partner, tax invoice download/print, cancel/refund/postpaid on booking-detail, AMC pause/resume/cancel, multi-address book |
| C3 | Technician **MandatoryLocationGate** behavior on web is underspecified | Native blocks; web “soft” may break “en route requires GPS fix” business rule |
| C4 | Periodic **TechnicianLocationTracker** deferred without stating whether live customer track still works when tech is on web only | Cross-app parity dependency |
| C5 | **Phase ordering inconsistency** (§26 vs §37): marketing CTAs (Phase 4) listed after product MVP in one place | Sequencing confusion |
| C6 | **Deployment** left as “Cloudflare or Vercel” | Needs a single default for Expo static hosts |
| C7 | **TypeScript declared the winner** without presenting the required three JS options neutrally | Objective 9 asks for preference analysis, not automatic TS victory |
| C8 | Adapter extensions assumed `.ts` | Language decision must drive `.js` vs `.ts` suffixes |
| C9 | Marketing often uses **static export** (`OORJAMAN_STATIC_EXPORT`) | “SSR” for public site may currently mean **SSG/static HTML** — still SEO-valid, but Phase 7 must verify crawlable HTML + metadata in the **actual** deploy mode |
| C10 | READY gate missing | Plan reads implementable; several decisions are still open |

**None of C1–C10 invalidate the architecture.** They are pre-implementation corrections.

---

## 5. SSR Decision

### Distinctions (mandatory)

| Requirement | Meaning | OorjaMan target |
|-------------|---------|-----------------|
| **SEO requirement** | Crawlable public HTML, titles, canonicals, OG, sitemap, robots, structured data | `apps/oorjaman-web` @ `oorjaman.com` |
| **Public-page SSR/SSG requirement** | Public pages pre-rendered (SSR **or** SSG/static export) so bots get content without relying on client JS | Next.js — SSG/static export is acceptable; SSR where dynamic |
| **Authenticated-app rendering requirement** | Secure session UI after login | Expo RN Web **CSR** |

### Decision

| Surface | Rendering | Rationale |
|---------|-----------|-----------|
| Public marketing | **SSG preferred; SSR only if needed** | Meets SEO; already Next |
| Customer product web | **CSR** | Session, payments, realtime; noindex |
| Technician product web | **CSR** | Same |
| Expo SSR | **Do not use** | Duplicates marketing; couples mobile CI; no authenticated benefit |

**Conclusion:** The plan’s SSR stance is **correct**. Authenticated dashboards must **not** be SSR’d.

**Correction:** Treat public “SSR compliant” as **“pre-rendered HTML (SSR or SSG)”**, and explicitly verify that production marketing deploy mode still emits crawlable HTML (static export counts).

---

## 6. SEO Decision

| Decision | Detail |
|----------|--------|
| SEO authority | **`apps/oorjaman-web` only** |
| Do not rebuild marketing in Expo | Affirmed |
| App hosts | `noindex` + `robots.txt` Disallow |
| Marketing CTAs | May link to `app.` / `partner.` login without ranking those URLs for service keywords |

**Conclusion:** Plan is correct. No change.

---

## 7. Customer Web Decision

| Decision | Detail |
|----------|--------|
| Ship from | Same `apps/customer-app` Expo Router tree |
| Host | `https://app.oorjaman.com` |
| Mode | RN Web CSR static export |
| Keep mobile | Intact via adapters; no bundle ID / scheme changes |

**Parity Contract (Customer) — must be explicit before coding:**

| Capability | Web requirement |
|------------|-----------------|
| Auth email OTP + Play Review path | Required |
| Phone OTP | Same gate as mobile (dummy/coming-soon) |
| Registration / site profile | Required |
| Address book + GPS assist | Required (browser geolocation; manual entry fallback) |
| Book one-time + pricing/quote | Required |
| AMC view/subscribe/manage (incl. pause/resume/cancel if mobile has them) | Required |
| Razorpay checkout | Required (Checkout.js / hosted); same Edge verify |
| Credits | Required |
| Bookings list/detail | Required |
| Cancel / refund / postpaid collect (as on mobile) | Required |
| Reschedule | Required |
| Preferred partner | Required |
| Live tracking | Required **functional** map (not “unsupported” stub); temporary degraded mode only behind feature flag during rollout |
| Support chat + realtime | Required |
| Site photos upload/view | Required |
| Tax invoice preview/download/print | Required (browser) |
| Push notifications | **Not required for parity** (native enhancement); in-app realtime OK |
| Onboarding slides / OS permission primer | Optional on web (may skip to login) |

---

## 8. Technician Web Decision

| Decision | Detail |
|----------|--------|
| Ship from | Same `apps/technician-app` |
| Host | `https://partner.oorjaman.com` |
| Mode | RN Web CSR static export |

**Parity Contract (Technician):**

| Capability | Web requirement |
|------------|-----------------|
| Auth email OTP + Play Review | Required |
| KYC onboarding + document upload | Required |
| Pending / vendor-not-onboarded / wrong-role | Required |
| Home / availability / jobs list / detail | Required |
| En-route with GPS fix | Required when browser grants geolocation; if denied, **block en-route** with clear UX (do not silently skip business rule) |
| Continuous background-style tracker | **Not required**; foreground/best-effort upload while tab visible is enough for MVP |
| Navigate via Google Maps URL | Required |
| Execute: verify, safety, selfie, start, before, after, issues, submit | Required |
| Camera/library evidence → `job-photos` | Required |
| Collect payment link / QR / partner-collected | Required |
| Profile documents preview | Required (iframe/download, not RN WebView) |
| Feedback / activity / profile | Required |
| Push | Not required for parity |

**Desktop vs mobile-browser:** Architecture supports both. **Recommendation:** validate MVP on **mobile browser first** (field reality), then desktop polish — but do not omit execute on desktop entirely.

---

## 9. Feature Parity Gaps

Gaps relative to a strict reading of objective 4 / the plan’s own inventory:

### Customer — missing or weak in plan DoD

- Preferred partner flow  
- Tax invoice share/print/download  
- Booking-detail cancel / refund / postpaid pay  
- AMC pause / resume / cancel (and upgrade sheet behavior)  
- Multi-address service address picker  
- Explicit live-track **non-stub** acceptance criteria  
- Booking/subscription **in-app realtime** invalidation (distinct from push)

### Technician — missing or weak

- Hard rule when geolocation denied on en-route  
- Whether customer live-track remains useful if technician uses web without continuous tracker  
- Document viewer replacement acceptance criteria  
- Availability toggle on home  

### Explicitly acceptable non-parity (document as enhancements)

- Expo Push / Web Push  
- Native Razorpay SDK vs Checkout.js (outcome parity, not SDK parity)  
- `react-native-maps` vs Maps JS (outcome parity)  
- Background GPS sampling rate  

**Correction required:** Replace soft MVP language with the Parity Contracts in §7–§8 before Phase 5/6 prompts are executed.

---

## 10. Platform Adapter Decision

**Affirmed.**

| Do | Don't |
|----|-------|
| Use Metro platform extensions: `*.web.*` / `*.native.*` | Scatter `Platform.OS` through booking/payment/job business rules |
| Keep shared orchestration in screens/hooks calling adapters | Fork entire screens per platform unless layout truly diverges |
| Start adapters under `apps/*/lib/` | Premature `packages/platform` mega-package on day one |
| Extract cross-app adapters only after duplication is proven | Rewrite `@oorjaman/api` |

**File extension:** follow the language decision (§15): `.web.ts`/`.native.ts` **or** `.web.js`/`.native.js`.

---

## 11. Authentication Decision

| Topic | Decision |
|-------|----------|
| Mechanism | Existing `authApi` OTP / Play Review — unchanged domain |
| Mobile storage | Keep AsyncStorage mobile client |
| Web storage | Browser `localStorage` (or AsyncStorage’s web backend) via storage adapter |
| Cookie/`@supabase/ssr` | **Not required** for CSR MVP |
| Session guards | Web-safe alerts; preserve `MobileAuthSessionGuard` behavior |
| Supabase Auth allowlist | Must include `app.` and `partner.` origins before launch |
| Service role | Never in Expo web |

---

## 12. Supabase Decision

| Check | Status |
|-------|--------|
| `@oorjaman/api` shared domain layer | Affirmed |
| RLS = browser security boundary | Affirmed |
| Service-role never in Expo web bundles | Affirmed |
| Realtime client-side after mount | Affirmed |
| Privileged payment/webhook server-side (Edge) | Affirmed |
| Schema rewrite for web | **Not required** for architecture |
| Auth redirect / site URL updates | **Required** operational step |

**Conclusion:** Plan preserves Supabase architecture correctly.

---

## 13. Domain Strategy

| Host | Role | Verdict |
|------|------|---------|
| `oorjaman.com` | Public SEO (Next) | Keep |
| `app.oorjaman.com` | Customer Expo web | Keep |
| `partner.oorjaman.com` | Technician Expo web | **Preferred** over path nesting |

**Why separate partner host:** separate XSS blast radius, clearer role UX, matches separate post-auth resolvers and store brands (“OorjaMan” vs “OorjaMan Partner”).

**Also keep:** existing admin/vendor/support portal hosts unchanged.

**www:** continue redirect to apex per `project-docs/SEO.md`.

---

## 14. Deployment Decision

### Expo Web CSR/static (`expo export -p web`)

| Option | Fit | Notes |
|--------|-----|-------|
| **Cloudflare Pages** | Excellent for static SPA + CDN | Needs SPA fallback; good if DNS moves to Cloudflare |
| **Vercel** | Excellent for static SPA | Aligns with existing portal/marketing docs/process |
| **Express** | Not needed | No product requirement for a Node SSR server for Expo apps |

### Recommendation (single default)

1. **Marketing (`oorjaman.com`):** keep current Next path (Vercel and/or GoDaddy static export as already documented).  
2. **Customer + Technician Expo web:** default to **Vercel static hosting** for process continuity with existing web deploys **unless** you standardize DNS/CDN on Cloudflare — in that case Cloudflare Pages is equally valid.  
3. **Do not introduce Express** for this program.

**Correction vs plan:** pick **one** org default for app hosts before Phase 9 (see §19).

---

## 15. TypeScript vs JavaScript Decision

Objective 9 prefers JavaScript **unless the repository makes it impractical**. This monorepo is TypeScript-first (`tsconfig.base.json`, all six apps, `@oorjaman/api|ui|config|utils|web-ui`, `tsc` in validate). Below are the three required options.

### Option 1 — Keep TypeScript (status quo)

| Dimension | Assessment |
|-----------|------------|
| Risk | Lowest for mobile regression and type drift in `@oorjaman/api` |
| Effort | Lowest — no toolchain split |
| Impact on mobile | Neutral/positive — same language as today |
| Impact on Cursor | Best — existing rules, types, refactors stay coherent |
| Maintainability | Best given current repo |

### Option 2 — New web code in JavaScript; existing TS remains

| Dimension | Assessment |
|-----------|------------|
| Risk | Medium — dual language in same Expo app; Metro resolves `.web.js` beside `.tsx` screens; weaker guarantees at adapter boundaries |
| Effort | Medium — JSDoc discipline; eslint boundaries; incomplete typecheck coverage for new files |
| Impact on mobile | Low if adapters are isolated; rises if JS leaks into shared screens |
| Impact on Cursor | Mixed — agents must not “fix” JS into TS packages or vice versa |
| Maintainability | Worse long-term dual standard |

**When acceptable:** only for **thin** `*.web.js` adapters (Razorpay script loader, file input) if leadership mandates visible JS — not for rewriting screens.

### Option 3 — Full migration to JavaScript

| Dimension | Assessment |
|-----------|------------|
| Risk | **Critical** to App Store/Play stability and delivery timeline |
| Effort | Extremely high — entire apps + `packages/api` + portals + marketing |
| Impact on mobile | Severe churn during store review windows |
| Impact on Cursor | High confusion; loses typed `database.types` benefits |
| Maintainability | Short-term “simpler language,” long-term loss of safety in a large Supabase surface |

**Not viable** during a web-introduction program that must preserve native releases.

### Recommendation (this repository)

**Choose Option 1 — Keep TypeScript** for all product Expo/shared package work.

**Rationale:** Objective 9’s escape hatch applies: JS-only is **technically impractical** here without a deliberate, multi-quarter migration that conflicts with objective 8 (store stability). Preferring JS as a greenfield rule does not justify rewriting a TS monorepo to ship RN Web.

If you still want a symbolic JS preference: allow **Option 2 only for isolated browser SDK loaders**, not for screens or `@oorjaman/api`.

---

## 16. Final Target Architecture

```
                         OorjaMan
                              |
          +-------------------+-------------------+
          |                                       |
  apps/oorjaman-web                         packages/api
  Next.js SSG/SSR                           (+ config, utils)
  SEO @ oorjaman.com                              |
                                                  |
                    +-----------------------------+-----------------------------+
                    |                                                           |
           apps/customer-app                                          apps/technician-app
           Expo Router + RN + RN Web                                  Expo Router + RN + RN Web
                    |                                                           |
         +----------+----------+                                       +--------+--------+
         |          |          |                                       |        |        |
       iOS      Android   Web CSR                                   iOS    Android   Web CSR
                         app.oorjaman.com                                    partner.oorjaman.com
                         (static export)                                       (static export)
                              |                                                     |
                         .web / .native adapters  <-------- shared domain calls -----+
                         (payments, maps, media, location, storage)
```

**Out of scope unchanged:** `admin-web` / `vendor-web` / `support-web` (Vite + `@oorjaman/web-ui`).

---

## 17. Final Implementation Sequence

1. **Decisions lock** (§19) — block coding until done  
2. **Phase 0** — hosts, Auth allowlist, env placeholders, branch rules  
3. **Phase 1** — web boot shims (push/keyboard/location tracker)  
4. **Phase 3** — platform adapters (payments/media/location/storage) *before* feature work  
5. **Phase 2** — responsive shells (parallel once boot is green)  
6. **Phase 5** — Customer Web against Parity Contract §7  
7. **Phase 6** — Technician Web against Parity Contract §8  
8. **Phase 4 + 8** — marketing CTAs + SEO hardening (can start after hosts exist; finish before prod traffic)  
9. **Phase 7** — Next marketing pre-render verification only (no Expo SSR)  
10. **Phase 9–10** — deploy app hosts + production validation + mobile regression  

---

## 18. Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Shared UI change breaks store builds | Critical | `.native` defaults; UAT EAS on shared-package PRs; freeze during review |
| Shipping “parity” with stubs | High | Enforce Parity Contracts; no prod with map/pay stubs |
| Razorpay web verify mismatch | High | Test-mode matrix; flag until proven |
| XSS → localStorage session theft | High | CSP; separate hosts; sanitize |
| Tech on web weakens customer live track | Medium | Foreground geo while execute/en-route active; document limits |
| Dual language (if Option 2) | Medium | Forbid JS in `packages/api` |
| Accidental indexing of app hosts | Medium | robots + noindex |
| Scope creep into portals / Expo SSR | Medium | Explicit non-goals |

---

## 19. Explicit Decisions Required From Me

Implementation must **not** start until you answer:

| # | Decision | Options | Reviewer recommendation |
|---|----------|---------|-------------------------|
| D1 | Language | (1) Keep TS · (2) JS adapters only · (3) Full JS migration | **(1) Keep TypeScript** |
| D2 | App host CDN | Vercel static · Cloudflare Pages | **Vercel static** (continuity) unless Cloudflare DNS is mandatory |
| D3 | Partner hostname | `partner.oorjaman.com` · `app.oorjaman.com/…` | **`partner.oorjaman.com`** |
| D4 | Parity Contract | Accept §7–§8 as binding · Soften further | **Accept §7–§8** |
| D5 | Live track on web | Full Maps JS required for MVP · Temporary flagged degrade OK | **Full Maps JS for MVP** (flag only in staging) |
| D6 | Technician geo denial | Block en-route · Allow without GPS | **Block en-route** (preserve business rule) |
| D7 | Push on web | Defer · Required for MVP | **Defer** |
| D8 | Technician execute on desktop | Required · Mobile-browser sufficient for MVP | **Mobile-browser required; desktop best-effort same release** |

---

# FINAL ARCHITECTURE

```
oorjaman.com          →  Next.js (SSG/SSR) SEO          apps/oorjaman-web
app.oorjaman.com      →  Expo RN Web CSR (Customer)     apps/customer-app
partner.oorjaman.com  →  Expo RN Web CSR (Technician)   apps/technician-app
shared                →  @oorjaman/api + config/utils + .web/.native I/O adapters
supabase              →  anon+RLS clients; Edge for pay/webhooks; no Express
native stores         →  unchanged iOS/Android release trains
```

---

# FINAL DECISIONS

- Keep Customer and Technician as **separate Expo apps** with independent web builds.  
- Introduce **React Native Web** from those same apps (CSR static export).  
- Public SEO/SSR–SSG remains **`apps/oorjaman-web`**; do **not** duplicate in Expo.  
- Do **not** Expo-SSR authenticated apps.  
- Enforce **Parity Contracts** (§7–§8); defer only push + background GPS.  
- Use **`.web.*` / `.native.*`** adapters; keep business logic in `@oorjaman/api` + shared screens.  
- Preserve Supabase architecture (RLS, Edge privileges, no service-role in web).  
- Domains: `oorjaman.com` / `app.oorjaman.com` / `partner.oorjaman.com`.  
- Deploy Expo web as **static SPA** (Vercel default unless Cloudflare chosen).  
- **Keep TypeScript** for product code (JS-only impractical in this repo).  
- No Express BFF for this program.  

---

# DO NOT IMPLEMENT

- Merging customer + technician apps  
- Rebuilding marketing SEO inside Expo Router  
- Expo SSR for dashboards or marketing duplication  
- Standalone CRA/Vite clone of product apps  
- Service-role keys in Expo web env  
- Rewriting `@oorjaman/api` (or the monorepo) to JavaScript  
- Scattering `Platform.OS` through payment/booking/job domain logic  
- Shipping production web with payment/map **stubs**  
- Indexing `app.` / `partner.` in search engines  
- Changing native bundle IDs, schemes, or EAS project IDs for web work  
- Drive-by refactors of Vite portals or RLS “while we’re here”  
- Introducing Express without a new explicit requirement  

---

# READY FOR IMPLEMENTATION

**NO**

Architecture direction is **approved in principle**, but implementation is **blocked** until you lock **§19 decisions D1–D8** (especially language, CDN, and binding Parity Contracts). After those answers, update the phase prompts to cite this review + the contracts, then Phase 0 may begin.

---

*End of final review. No application source or configuration was modified.*
