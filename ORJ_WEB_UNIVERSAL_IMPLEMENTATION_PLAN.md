# OorjaMan Universal Web — Implementation Master Plan

**Document:** `ORJ_WEB_UNIVERSAL_IMPLEMENTATION_PLAN.md`  
**Authority:** Locked decisions from user + `ORJ_WEB_UNIVERSAL_ARCHITECTURE_FINAL_REVIEW.md`  
**Companion:** `ORJ_WEB_UNIVERSAL_ARCHITECTURE_PLAN.md` (analysis)  
**Date:** 2026-09-18  

---

## Status banner

| Field | Value |
|-------|--------|
| **ARCHITECTURE STATUS** | **LOCKED** |
| **IMPLEMENTATION STATUS** | **NOT STARTED** |
| **READY FOR PHASE 0** | **YES** |

**This document does not implement source changes.** It is the sole execution guide for Cursor Agent phases.

---

## Locked architecture (immutable)

```
oorjaman.com
  → Next.js SSR/SSG public SEO
  → apps/oorjaman-web

app.oorjaman.com
  → apps/customer-app
  → Expo Router + React Native Web
  → CSR static SPA on Vercel

partner.oorjaman.com
  → apps/technician-app
  → Expo Router + React Native Web
  → CSR static SPA on Vercel

Shared: @oorjaman/api, @oorjaman/config, @oorjaman/utils, @oorjaman/ui (where appropriate)
Platform I/O: *.web.ts / *.native.ts
Backend: Supabase anon+RLS; Edge for payments/webhooks; NEVER service-role in Expo Web
Language: TypeScript only (no JS migration, no parallel JS architecture)
```

### Locked decisions (D1–D8)

| ID | Decision |
|----|----------|
| D1 | **Keep TypeScript** |
| D2 | **Vercel static** for Expo Web SPA hosts |
| D3 | **`partner.oorjaman.com`** |
| D4 | Parity Contracts **binding** |
| D5 | **Full functional web map** for MVP (no production stub) |
| D6 | **Block En Route** when geolocation denied |
| D7 | **Defer Web Push** |
| D8 | Technician MVP primary validation = **mobile browser**; desktop still supported |

### Locked phase order

1. Phase 0 — Architecture preparation  
2. Phase 1 — Web boot  
3. Phase 3 — Platform adapters  
4. Phase 2 — Responsive shell  
5. Phase 5 — Customer Web  
6. Phase 6 — Technician Web  
7. Phase 4 — Marketing CTA integration  
8. Phase 8 — SEO hardening / verification  
9. Phase 9 — Vercel deployment  
10. Phase 10 — Production validation  

### Global DO NOT (every phase)

- Merge `customer-app` and `technician-app`  
- Replace Next marketing with Expo / introduce Expo SSR  
- Create CRA/Vite product clones  
- Migrate repo to JavaScript / rewrite `@oorjaman/api`  
- Introduce Express or Cloudflare for this program  
- Modify native bundle IDs, URL schemes, EAS project IDs  
- Delete Vite admin/vendor/support portals  
- Ship production payment/map stubs  
- Weaken business rules for Web convenience  
- Unrelated refactors  

### Mobile Safety Gate (every mergeable phase)

Before declaring any phase complete that touches `@oorjaman/ui`, `@oorjaman/api`, `customer-app`, `technician-app`, Expo config, or shared deps:

| Track | Gate |
|-------|------|
| Customer iOS | Smoke: launch → login screen or restored session → home/tabs |
| Customer Android | Same |
| Technician iOS | Same |
| Technician Android | Same |
| Customer web | Boot → `/login` renders |
| Technician web | Boot → `/login` renders |

If any native regression is detected → **phase incomplete**; rollback required.

---

## Native API classification (program-wide)

| Capability | Classification | Native | Web | Notes |
|------------|----------------|--------|-----|-------|
| Email OTP / Play Review | **SHARED** | `authApi` | Same | Domain in `@oorjaman/api` |
| Phone OTP | **SHARED** (policy-gated) | Same gate | Same gate | No special web bypass |
| Session persistence | **SHARED interface** | AsyncStorage | localStorage adapter | CSR only; no cookie SSR |
| Role / post-auth redirects | **SHARED** | Resolvers | Same | |
| Razorpay checkout UI | **PLATFORM** | `react-native-razorpay` | Checkout.js | Shared Edge verify |
| Payment domain / verify / webhook | **SHARED** | Edge + `paymentApi` | Same | |
| Live technician map | **PLATFORM** | `react-native-maps` | Google Maps JS | Shared booking location APIs |
| Maps navigation (tech) | **SHARED** | Linking URLs | `window.open` URLs | |
| Browser / device geolocation | **PLATFORM** | `expo-location` | Geolocation API | En-route **blocks** if denied (web) |
| Background-style GPS tracker | **DEFERRED / DEGRADED WEB** | Periodic upload | Foreground/best-effort while tab visible | Approved degrade |
| Expo Push / Web Push | **NATIVE ONLY / DEFERRED WEB** | Expo push | None for MVP | Approved defer |
| Image pick (site/selfie/before/after) | **PLATFORM** | ImagePicker | `<input capture>` | Shared upload rules + buckets |
| Document pick (KYC) | **PLATFORM** | DocumentPicker | file input | Same buckets |
| Image compress / FileSystem | **PLATFORM** | expo-file-system / manipulator | Canvas/Blob | |
| PDF preview | **PLATFORM** | WebView | iframe / download | |
| Print / share invoice | **PLATFORM** | print/share/view-shot | download / `window.print` | |
| Keyboard controller | **PLATFORM** | native module | no-op / KAV | Boot safety |
| FlashList | **PLATFORM** | FlashList | FlatList fallback | |
| Realtime subscriptions | **SHARED** | Client | Client | Never SSR |
| Supabase Storage uploads | **SHARED** | via api helpers | Same paths/buckets | |

**Degraded allowed only for:** Web Push (deferred), background-style GPS tracker.  
**Not degraded:** payments, live map, en-route GPS gate, evidence uploads, AMC/booking parity.

---

## Payments architecture (locked)

```
Screen / hook
    → paymentApi (@oorjaman/api)          # SHARED domain
    → openCheckout(adapter)               # PLATFORM
         native: react-native-razorpay
         web:    Razorpay Checkout.js
    → paymentApi.verify* / Edge Functions # SHARED server
    → razorpay-webhook                    # SHARED server
```

- Feature flag: `EXPO_PUBLIC_WEB_PAYMENTS=1` until verify proven; production requires flag on **and** no stubs.  
- Never duplicate amount/order business rules in adapters.

---

## Maps architecture (locked)

```
booking-track / live card
    → bookingApi location queries         # SHARED
    → MapView adapter                     # PLATFORM
         native: react-native-maps
         web:    Google Maps JavaScript API
```

- Production Customer Web MVP **requires** functional map (D5).  
- Technician navigation remains URL-based (shared).

---

## Media architecture (locked)

| Flow | Bucket / linkage | Shared | Native | Web |
|------|------------------|--------|--------|-----|
| Customer site photos | Existing customer site photo paths | Upload APIs + rules | ImagePicker + stamp | file/camera + optional stamp |
| Tech selfie / before / after | `job-photos` | `technicianSaveJobPhotoUrls` / finalize | ImagePicker | file/camera input |
| Tech KYC docs | `technician-documents` | upload helpers | DocumentPicker / camera | file input |
| Display | Signed URLs | Existing signed URL helpers | Image / WebView | Image / iframe |

---

## Auth architecture (locked)

| Concern | Spec |
|---------|------|
| Domain | `authApi`, post-auth resolvers — unchanged |
| Native storage | AsyncStorage via `createSupabaseMobileClient` |
| Web storage | Storage adapter → `localStorage` (CSR) |
| OTP | Email primary; phone same mobile gate |
| Session lifecycle | Existing refresh/guard patterns; web-safe Alert |
| Role guards | Existing `(main)` layouts + wrong-role routes |
| Cookie SSR auth | **Not introduced** |
| Supabase Auth allowlist | Add `https://app.oorjaman.com/**`, `https://partner.oorjaman.com/**` (+ preview URLs) |

---

## SEO architecture (locked)

| Owner | `apps/oorjaman-web` only |
|-------|---------------------------|
| Metadata / canonical / OG / Twitter | Next metadata APIs |
| Structured data / sitemap / robots | Next |
| `app.` / `partner.` | `noindex,nofollow` + CDN/`robots.txt` Disallow |
| Do not | Duplicate SEO pages in Expo |

---

## Vercel deployment architecture (locked — Phase 9)

### Projects

| Vercel project (suggested) | Root | Domain |
|----------------------------|------|--------|
| `oorjaman-customer-web` | monorepo | `app.oorjaman.com` |
| `oorjaman-technician-web` | monorepo | `partner.oorjaman.com` |

### Build (per project; finalize in Phase 9 after export path verified)

| Setting | Customer | Technician |
|---------|----------|------------|
| Framework | Other | Other |
| Install | `npm ci` at repo root | same |
| Build | `npx expo export -p web` in app dir (or workspace script) | same |
| Output | Expo web `dist` (confirm exact path in Phase 1/9) | same |
| SPA fallback | Rewrite all → `/index.html` | same |

### Environment (build-time `EXPO_PUBLIC_*`)

- `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`  
- `EXPO_PUBLIC_DEPLOY_ENV`  
- `EXPO_PUBLIC_SITE_URL=https://oorjaman.com`  
- `EXPO_PUBLIC_WEB_ORIGIN` (`https://app.oorjaman.com` / `https://partner.oorjaman.com`)  
- `EXPO_PUBLIC_RAZORPAY_KEY_ID`  
- `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` (customer; HTTP referrer restricted to app host)  
- `EXPO_PUBLIC_WEB_PAYMENTS`  
- **Never** `SUPABASE_SERVICE_ROLE_KEY`

### Headers / caching / rollback

- Security headers aligned with root `vercel.json` / portal practice (XFO, nosniff, referrer).  
- Cache static assets aggressively; `index.html` short/no-cache.  
- Rollback = previous Vercel deployment.  
- Preview deployments per PR with Deployment Protection for UAT.

---

## Binding parity contracts

### Customer (MVP complete only if all pass)

Email OTP · Play Review · Registration · Address book · Browser geolocation assist · Manual address fallback · One-time booking · Pricing/quote · AMC view/subscribe/manage · AMC pause/resume/cancel where present on mobile · Razorpay web checkout · Payment verification · Credits · Booking list/detail · Cancel/refund/postpaid where present · Reschedule · Preferred partner · **Functional live technician map** · Support chat · Realtime updates · Site photo upload/view · Tax invoice preview/download/print  

### Technician (MVP complete only if all pass)

Email OTP · Play Review · KYC · Document upload · Pending vendor review · Vendor-not-onboarded · Wrong-role · Home · Availability · Jobs · Job detail · En-route · Browser geolocation · **Block En Route when GPS denied** · Google Maps navigation · Verify · Safety · Selfie · Start · Before · After · Issues · Submit · `job-photos` upload · Collect · QR/payment link · Partner-collected · Profile documents · PDF view/download · Feedback · Activity · Profile  

---

# PHASE 0 — Architecture preparation

### 1. Objective
Lock operational prerequisites (hosts, Auth allowlist checklist, env placeholders, docs) with **zero runtime behavior change** to native apps.

### 2. Preconditions
Architecture locked; this plan approved; store review in progress → **minimal file touch**.

### 3. Exact files to inspect
- `ORJ_WEB_UNIVERSAL_ARCHITECTURE_FINAL_REVIEW.md`
- `apps/customer-app/.env.example`, `apps/technician-app/.env.example`
- `apps/customer-app/app.config.ts`, `apps/technician-app/app.config.ts`
- `apps/customer-app/eas.json`, `apps/technician-app/eas.json`
- `project-docs/ENVIRONMENT.md`, `project-docs/SEO.md`, `project-docs/VERCEL.md`
- `packages/api/src/env.ts`, `packages/config/src/public-site.ts` (if exists)

### 4. Exact files expected to change
- `apps/customer-app/.env.example`
- `apps/technician-app/.env.example`
- Optionally `project-docs/ENVIRONMENT.md` (document `EXPO_PUBLIC_WEB_ORIGIN`, hosts)
- This plan’s status remains NOT STARTED until Phase 0 exit; may add `project-docs/WEB-UNIVERSAL.md` **index** linking hosts (docs only)

### 5. Exact files expected to be created
- `project-docs/WEB-UNIVERSAL.md` (ops checklist: Auth allowlist, DNS, Vercel project names) — docs only

### 6. Files explicitly forbidden from modification
- Any `app/**/*.tsx` screen logic  
- `eas.json` project IDs / profiles that alter store builds  
- Bundle IDs / schemes in `app.config.ts`  
- `packages/api` domain modules  
- `supabase/**`  
- Portal apps  

### 7. Dependencies/package changes
None.

### 8. Detailed implementation steps
1. Document hosts: `app.oorjaman.com`, `partner.oorjaman.com`.  
2. Add commented placeholders to `.env.example` for `EXPO_PUBLIC_WEB_ORIGIN`, web payments flag, maps key notes.  
3. Write human checklist for Supabase Dashboard Auth URL allowlist (no automated change).  
4. Confirm EAS project IDs unchanged by diffing `app.config.ts` / `eas.json`.  

### 9. Platform-specific considerations
N/A (docs/env examples only).

### 10. Native regression risks
Near-zero if only `.env.example` / docs change.

### 11. Validation commands
```bash
git diff -- apps/customer-app/app.config.ts apps/technician-app/app.config.ts apps/customer-app/eas.json apps/technician-app/eas.json
# must show no scheme/bundle/EAS id changes
```

### 12. Manual validation checklist
- [ ] Hostnames documented  
- [ ] Auth allowlist steps listed for human  
- [ ] No native config identity changes  

### 13. Automated tests
None required.

### 14. Rollback
Revert doc/env.example commits.

### 15. Exit criteria
Docs + env examples updated; Auth allowlist checklist published; **no app runtime change**.

#### Phase 0 tasks

**TASK ID:** P0-T1  
**TASK NAME:** Document web hosts and Auth allowlist checklist  
**SCOPE:** Docs only  
**FILES:** Create `project-docs/WEB-UNIVERSAL.md`; optionally update `project-docs/ENVIRONMENT.md`  
**IMPLEMENTATION:** Write locked hosts, Vercel project names, Supabase Auth URL steps, never-service-role rule  
**VALIDATION:** File exists; links from ENVIRONMENT if updated  
**ROLLBACK:** Delete/revert docs  

**TASK ID:** P0-T2  
**TASK NAME:** Env example placeholders  
**SCOPE:** `.env.example` only  
**FILES:** `apps/customer-app/.env.example`, `apps/technician-app/.env.example`  
**IMPLEMENTATION:** Add `EXPO_PUBLIC_WEB_ORIGIN`, `EXPO_PUBLIC_WEB_PAYMENTS`, comment maps key for customer  
**VALIDATION:** Examples parse as comments/keys; no secrets committed  
**ROLLBACK:** Revert examples  

---

# PHASE 1 — Web boot

### 1. Objective
Both apps boot on web to `/login` without crashing providers; **native boot unchanged**.

### 2. Preconditions
Phase 0 exit.

### 3. Exact files to inspect
- `apps/customer-app/app/_layout.tsx`, `apps/technician-app/app/_layout.tsx`
- `packages/ui` notification / offline / auth guard entrypoints
- Customer/technician push registration components
- `react-native-keyboard-controller` usage
- `apps/*/metro.config.js`, `babel.config.js`
- `apps/*/app.config.ts` (web section only)

### 4. Exact files expected to change
- `apps/*/app/_layout.tsx` (only if import path switches to adapters — prefer adapters only)
- `apps/*/app.config.ts` — add `web: { ... }` **without** changing ios/android identifiers
- Push/keyboard import sites → adapter modules

### 5. Exact files expected to be created
- `apps/customer-app/lib/platform/notifications.native.ts` / `.web.ts` (+ barrel if needed)
- `apps/technician-app/lib/platform/notifications.native.ts` / `.web.ts`
- `apps/*/lib/platform/keyboard.native.ts` / `.web.ts` (or shared pattern per app)
- Optional: `apps/*/lib/platform/location-tracker.web.ts` no-op (prep for Phase 3)

### 6. Forbidden
- Payment/map/business logic  
- Bundle ID / scheme / EAS id changes  
- `@oorjaman/api` rewrites  
- Portal / Next marketing feature work  

### 7. Dependencies
None new preferred; use existing `react-native-web` / `react-dom`.

### 8. Steps
1. Identify crash points on `expo start --web`.  
2. Add `.web.ts` no-ops for push init/registration.  
3. Shim keyboard-controller on web.  
4. Add minimal `web` config (name, favicon) without touching native IDs.  
5. Confirm native still imports `.native` implementations.  

### 9. Platform
Web: no-op push. Native: identical behavior.

### 10. Native regression risks
Wrong Metro resolve of `.web` into native bundles → **critical**. Validate both platforms.

### 11. Validation commands
```bash
cd apps/customer-app && npx expo start --web
# separately
cd apps/technician-app && npx expo start --web
# native smoke via Expo Go / dev client as available
```

### 12. Manual checklist
- [ ] Customer web shows login  
- [ ] Technician web shows login  
- [ ] Customer native launch OK  
- [ ] Technician native launch OK  

### 13. Automated tests
Optional smoke script later; not blocking if manual OK.

### 14. Rollback
Revert Phase 1 commits; remove platform shims.

### 15. Exit criteria
Web boot both apps; Mobile Safety Gate green.

#### Phase 1 tasks

**P1-T1** Customer web boot shims (notifications + keyboard)  
**P1-T2** Technician web boot shims (notifications + keyboard + location tracker no-op stub)  
**P1-T3** `app.config.ts` web section only (both apps) — verify schemes/bundle IDs unchanged  

---

# PHASE 3 — Platform adapters

### 1. Objective
Introduce payment, maps, media, location, auth-storage adapters with **native default paths byte-compatible**.

### 2. Preconditions
Phase 1 exit.

### 3. Inspect
- `apps/customer-app/lib/razorpay-checkout.ts`
- `apps/customer-app/app/booking-track.tsx`, live track components
- `apps/customer-app/lib/site-photo-capture.ts` (+ related)
- `apps/technician-app` job evidence picker / `lib/job-photos.ts`
- `apps/technician-app` location gate / tracker / en-route fix
- `apps/*/lib/supabase.ts`
- Document viewer modal

### 4. Expected to change
- Split existing libs into `.native.ts` retaining current code; thin re-exports from call sites if needed  
- En-route path calls location adapter (behavior native unchanged)

### 5. Expected to create
| Adapter | Customer | Technician |
|---------|----------|------------|
| `razorpay-checkout.native.ts` / `.web.ts` | ✅ (web may throw “disabled” until Phase 5) | — |
| `maps-live.native.tsx` / `.web.tsx` | ✅ (web may throw until Phase 5) | — |
| `pick-image.native.ts` / `.web.ts` | ✅ | ✅ |
| `pick-document.native.ts` / `.web.ts` | — | ✅ |
| `location.native.ts` / `.web.ts` | ✅ | ✅ |
| `auth-storage` if needed | ✅ | ✅ |
| `pdf-viewer.native.tsx` / `.web.tsx` | invoice if needed | documents |
| `share-invoice.native.ts` / `.web.ts` | ✅ | — |

### 6. Forbidden
- Changing Edge Functions  
- Changing payment amounts / RPC names  
- Enabling production web payments/maps yet  
- Weakening en-route GPS rule  

### 7. Dependencies
None required in this phase (script injection in Phase 5). Do **not** add random map SDKs to native.

### 8. Steps
1. Move current native implementations to `.native.ts` unchanged.  
2. Add `.web.ts` stubs that fail clearly OR implement safe no-ops only where Phase 1 already did.  
3. Wire imports so Metro picks platform files.  
4. Native regression: open Razorpay path still exists on device builds.  

### 9. Platform
Web stubs acceptable **only** until Phase 5/6; must not ship to production.

### 10. Native regression risks
High if native file content drifts — prefer move-as-is.

### 11. Validation
```bash
# typecheck apps if available
npm run validate   # or app-level tsc
```

### 12. Manual
- [ ] Native customer payment module still loads  
- [ ] Native maps screen still loads  
- [ ] Native tech execute photo pick still works  

### 13. Automated
Unit test adapter exports resolve (optional).

### 14. Rollback
Restore single-file libs; delete adapters.

### 15. Exit criteria
Adapters exist; native paths unchanged in behavior; web stubs not used in production.

#### Phase 3 tasks

**P3-T1** Customer Razorpay split native/web stub  
**P3-T2** Customer maps split native/web stub  
**P3-T3** Customer media + invoice adapters  
**P3-T4** Customer/technician location adapters (web: permission API; en-route deny = throw/false)  
**P3-T5** Technician media + document + pdf adapters  
**P3-T6** Auth storage adapter alignment (if required for web session)  

---

# PHASE 2 — Responsive shell

### 1. Objective
Desktop/web shell (≥1024) with sidebar; **phone native tab bar unchanged**.

### 2. Preconditions
Phase 3 exit (adapters stable) **or** Phase 1 minimum if shell does not need adapters — **locked order says after Phase 3**.

### 3. Inspect
- `apps/*/app/(main)/_layout.tsx`
- `@oorjaman/ui` AppScaffold / tab bar / Screen

### 4. Expected to change
- `(main)/_layout.tsx` both apps — width/platform branching  
- Possibly small `@oorjaman/ui` additions **only if necessary** and web-gated

### 5. Create
- `apps/*/components/web-app-shell.tsx` (or `.web.tsx`)  
- Breakpoint hook `lib/use-layout-mode.ts`

### 6. Forbidden
- Redesigning mobile tab icons/order  
- Payment/map feature work  

### 7. Dependencies
None.

### 8–15.
Steps: detect web or width≥1024 → sidebar mapping existing tabs; keep Stack modals as dialogs later in Phase 5/6.  
Risks: accidental mobile layout change — gate strictly.  
Validation: screenshots 390 / 768 / 1280; native phone unchanged.  
Exit: shells usable; Mobile Safety Gate green.

#### Tasks
**P2-T1** Customer responsive shell  
**P2-T2** Technician responsive shell  

---

# PHASE 5 — Customer Web

### 1. Objective
Full Customer Parity Contract on `app` web CSR.

### 2. Preconditions
Phases 0, 1, 3, 2 complete; Maps API key + Razorpay test key available; Auth allowlist includes preview/prod app host.

### 3. Inspect
All customer routes in parity list; `book.tsx`, `subscription.tsx`, `booking-detail.tsx`, `booking-track.tsx`, `credits.tsx`, `preferred-partner.tsx`, `support-chat.tsx`, profile/site photos, registration.

### 4. Expected to change
- Implement `.web.ts` Razorpay Checkout.js (flagged)  
- Implement `.web.tsx` Google Maps JS live track  
- Wire media/invoice web adapters  
- Responsive tweaks for book/AMC modals  
- Ensure realtime subscriptions mount client-side  

### 5. Create
- Razorpay.js loader helper  
- Maps JS map component  
- Playwright specs under `apps/customer-app/e2e-web/` (or `e2e/customer-web/`)

### 6. Forbidden
- Technician feature scope  
- Stub maps in production builds  
- Service-role  
- Changing native Razorpay path  

### 7. Dependencies
Runtime: load Checkout.js / Maps JS via script tag or officially supported loader — prefer no heavy npm if script is enough; if npm package added, document unexpected deps in Agent report.

### 8. Steps (by task)
See tasks P5-T1… below covering auth→book→pay→AMC→track→support→photos→invoice.

### 9. Platform
Web payments/maps only; native untouched.

### 10. Native risks
Shared screen edits — keep logic shared; UI branches for layout only.

### 11. Validation
```bash
cd apps/customer-app && npx expo start --web
# Playwright parity smoke when added
```

### 12. Manual parity checklist
Every Customer contract bullet checked on mobile browser + desktop width.

### 13. Automated
Playwright: login, open book, open track (map canvas present), support chat.

### 14. Rollback
Revert Phase 5; leave adapters stubs.

### 15. Exit criteria
Parity Contract 100%; Mobile Safety Gate; no production stubs.

#### Phase 5 tasks (executable)

| ID | Name | Scope |
|----|------|-------|
| P5-T1 | Web auth storage + login OTP/Play Review | login + supabase client web |
| P5-T2 | Registration + address book + geo assist + manual fallback | registration/profile address |
| P5-T3 | Razorpay web checkout + verify (test) | book + booking-detail + subscription pay |
| P5-T4 | One-time book + pricing/quote web UX | `/book` |
| P5-T5 | AMC view/subscribe/manage/pause-resume-cancel | subscription |
| P5-T6 | Credits + bookings list/detail + cancel/refund/postpaid + reschedule | bookings flows |
| P5-T7 | Preferred partner | preferred-partner |
| P5-T8 | **Functional live map** (Maps JS) | booking-track + live card |
| P5-T9 | Support chat + realtime | support-chat + providers |
| P5-T10 | Site photos + tax invoice web | profile/photos + invoice |

---

# PHASE 6 — Technician Web

### 1. Objective
Full Technician Parity Contract; **block En Route without GPS**.

### 2. Preconditions
Phase 5 preferably done (shared patterns); Phase 3 adapters ready.

### 3. Inspect
`jobs/[id].tsx`, `execute/[bookingId].tsx`, `collect/[bookingId].tsx`, onboarding, location gate/tracker, documents.

### 4–5. Change/create
- Location web adapter returns denied → UI blocks En Route  
- Media web adapters for selfie/before/after/docs  
- PDF web viewer  
- Tracker: foreground-only while relevant (approved degrade)  
- Playwright technician flows  

### 6. Forbidden
- Bypass GPS for en-route  
- Weakening safety/code gates  
- Web Push  

### 7–15.
Primary validation on **mobile browser**; also run desktop execute once.  
Exit: Parity Contract 100%; Mobile Safety Gate.

#### Phase 6 tasks

| ID | Name |
|----|------|
| P6-T1 | Auth + KYC + document upload web |
| P6-T2 | Gates: pending / vendor-not-onboarded / wrong-role |
| P6-T3 | Home + availability + jobs list/detail |
| P6-T4 | En-route + **GPS deny blocks** + Maps URL nav |
| P6-T5 | Execute wizard full (verify→submit) + job-photos |
| P6-T6 | Collect + QR/link + partner-collected |
| P6-T7 | Profile documents PDF + feedback/activity/profile |
| P6-T8 | Foreground location best-effort while on job (optional tracker) |

---

# PHASE 4 — Marketing CTA integration

### 1. Objective
`oorjaman-web` CTAs link to Customer/Technician web login without SEO damage.

### 2. Preconditions
Staging app/partner URLs exist (preview OK).

### 3. Inspect
`apps/oorjaman-web` download, pricing, partners, home CTAs; `project-docs/SEO.md`.

### 4–5. Change/create
- CTA components/env `NEXT_PUBLIC_CUSTOMER_WEB_URL`, `NEXT_PUBLIC_PARTNER_WEB_URL`  
- Keep store badges  

### 6. Forbidden
- Expo marketing rebuild  
- Indexing app hosts  

### 7–15.
Validate Lighthouse SEO unchanged; links work. Exit: CTAs live on staging marketing.

#### Tasks
**P4-T1** Env + CTA “Open web app” customer  
**P4-T2** Partner portal CTA → `partner.oorjaman.com` where appropriate  

---

# PHASE 8 — SEO hardening / verification

### 1. Objective
Confirm marketing SEO; enforce noindex on app hosts.

### 2. Preconditions
Phase 4; Phase 9 may supply robots on CDN — can prep meta/robots docs earlier.

### 3–15.
Inspect `oorjaman-web` metadata, sitemap, robots; add app-host `robots.txt` in export/`public` if supported.  
Exit: Search Console plan; app/partner Disallow verified.

#### Tasks
**P8-T1** Marketing metadata/structured data audit  
**P8-T2** App/partner noindex + robots  

---

# PHASE 9 — Vercel deployment

### 1. Objective
Production-ready Vercel static SPAs for `app.` and `partner.`.

### 2. Preconditions
Phases 5–6 feature-complete on preview; secrets ready.

### 3. Inspect
Export output path from `expo export -p web`; existing `vercel.json`; portal Vercel patterns in `project-docs/VERCEL.md`.

### 4–5. Change/create
- `apps/customer-app/vercel.json` and/or root project configs (SPA rewrites)  
- `apps/technician-app/vercel.json`  
- CI workflow job for web export (optional)  
- `project-docs/WEB-UNIVERSAL.md` deploy section  

### 6. Forbidden
- Cloudflare  
- Express  
- Service-role in Vercel env  
- Changing EAS store profiles  

### 7. Dependencies
None runtime; Vercel project settings.

### 8. Steps
1. Confirm `dist` output.  
2. Create two Vercel projects.  
3. Set env; SPA fallback; headers.  
4. Attach domains.  
5. Preview protection.  

### 9–15.
Rollback = previous deployment. Exit: HTTPS prod URLs serve client router; env verified; Mobile Safety Gate still green on same git SHA.

#### Tasks
**P9-T1** Customer Vercel project + SPA + env  
**P9-T2** Technician Vercel project + SPA + env  
**P9-T3** Custom domains + headers + rollback runbook  

---

# PHASE 10 — Production validation

### 1. Objective
Go-live evidence against parity contracts + native regression battery.

### 2. Preconditions
Phase 9 prod/staging.

### 3–15.
Playwright against prod/staging; Razorpay test then live carefully; Maps referrer; Auth allowlist; CSP; document go-live in `project-docs/`.  
Exit: signed go-live; IMPLEMENTATION STATUS can move to COMPLETE only after this phase.

#### Tasks
**P10-T1** Customer parity sign-off  
**P10-T2** Technician parity sign-off (mobile browser primary)  
**P10-T3** Mobile Safety Gate full  
**P10-T4** Security/env/rollback drill  

---

# MOBILE SAFETY GATE (detail)

Before merge of any phase touching shared/mobile code:

1. Customer iOS smoke  
2. Customer Android smoke  
3. Technician iOS smoke  
4. Technician Android smoke  
5. Customer web `/login`  
6. Technician web `/login`  

Record SHA, tester, result in PR. Fail gate → no merge.

During App Store / Play review: **prefer web-only files** (`.web.ts`) and avoid `@oorjaman/ui` peer bumps unless emergency.

---

# CURSOR EXECUTION ORDER

Paste prompts **in order**. Each is self-contained. Agent must STOP if scope expands.

---

### PROMPT 01 — P0-T1 Document hosts

```text
You are implementing OorjaMan Universal Web Phase 0 task P0-T1 only.

Read:
- ORJ_WEB_UNIVERSAL_IMPLEMENTATION_PLAN.md
- ORJ_WEB_UNIVERSAL_ARCHITECTURE_FINAL_REVIEW.md

LOCKED: TypeScript; Vercel static; partner.oorjaman.com; parity contracts binding; no Expo SSR; no JS migration; no Express; native apps in store review — do not change bundle IDs, schemes, or EAS project IDs.

TASK P0-T1: Create project-docs/WEB-UNIVERSAL.md documenting locked hosts (oorjaman.com, app.oorjaman.com, partner.oorjaman.com), Vercel project naming, Supabase Auth URL allowlist human checklist, and never put service-role in Expo web.

ALLOWED FILES: create project-docs/WEB-UNIVERSAL.md; optionally update project-docs/ENVIRONMENT.md and project-docs/README.md to link it.
FORBIDDEN: any app source, packages, supabase, eas.json identity fields, app.config bundle/scheme.

Inspect before writing. No package installs. No unrelated refactors.
After: list files changed; confirm no runtime code changed.
STOP if you need files outside scope.
```

---

### PROMPT 02 — P0-T2 Env examples

```text
Phase 0 task P0-T2 only. Read ORJ_WEB_UNIVERSAL_IMPLEMENTATION_PLAN.md.

Add placeholders (no secrets) to apps/customer-app/.env.example and apps/technician-app/.env.example:
EXPO_PUBLIC_WEB_ORIGIN, EXPO_PUBLIC_WEB_PAYMENTS, and customer maps key comment as needed.

FORBIDDEN: changing .env (secrets), app.config identities, business logic.
Report diff. STOP if scope expands.
```

---

### PROMPT 03 — P1-T1 Customer web boot

```text
Phase 1 task P1-T1 only. Read ORJ_WEB_UNIVERSAL_IMPLEMENTATION_PLAN.md.

Goal: apps/customer-app boots on web to login without crashing; native behavior unchanged.

Inspect app/_layout.tsx and push/notification/keyboard imports.
Create *.web.ts / *.native.ts shims under apps/customer-app/lib/platform/ for notifications and keyboard as needed.
Prefer moving native code into .native.ts unchanged.

ALLOWED: customer-app layout imports, new platform shim files, minimal app.config.ts web section WITHOUT changing ios/android bundleId, package, scheme, or EAS projectId.
FORBIDDEN: payments, maps, api rewrite, technician-app, portals.

Validate: expo start --web reaches login; state native smoke if possible.
Report files changed, unexpected deps (should be none). STOP if outside scope.
```

---

### PROMPT 04 — P1-T2 Technician web boot

```text
Phase 1 task P1-T2 only. Same rules as P1-T1 for apps/technician-app.
Also no-op location tracker on web if it crashes boot.
Do not change en-route business rules yet (Phase 6).
FORBIDDEN: weakening GPS rules, payments, customer-app.
Validate web login boot + native smoke. Report and STOP if scope expands.
```

---

### PROMPT 05 — P1-T3 Web config identity check

```text
Phase 1 task P1-T3. Ensure both app.config.ts web sections exist if needed.
Run git diff and prove scheme, bundleIdentifier, package, extra.eas.projectId unchanged.
If any identity drift occurred in prior tasks, REVERT identity fields immediately.
No feature work. Report proof. STOP.
```

---

### PROMPT 06 — P3-T1 Customer Razorpay adapters

```text
Phase 3 task P3-T1. Read implementation plan payments architecture.

Split apps/customer-app/lib/razorpay-checkout.ts into .native.ts (current behavior) and .web.ts (clear stub: not enabled / throws until Phase 5).
Wire imports for Metro platform resolution.
Native checkout behavior must remain identical.
FORBIDDEN: Edge function changes, enabling web checkout, api payment rule changes.
Validate native path still compiles. Report files. STOP if scope expands.
```

---

### PROMPT 07 — P3-T2 Customer maps adapters

```text
Phase 3 task P3-T2. Extract live map UI into maps-live.native.tsx (current react-native-maps) and maps-live.web.tsx stub that fails clearly until Phase 5.
Do not leave booking-track on web as a silent empty success.
Shared bookingApi calls stay shared.
FORBIDDEN: production stub shipping claims; technician changes.
Report. STOP if outside scope.
```

---

### PROMPT 08 — P3-T3 Customer media + invoice adapters

```text
Phase 3 task P3-T3. Create pick-image and share-invoice/pdf adapters (.native/.web) for customer site photos and tax invoice flows.
Web can be incomplete stubs that throw “not implemented” until Phase 5 — but native must be move-as-is.
Preserve Supabase storage business rules; do not rewrite @oorjaman/api.
STOP if you need api payment/booking logic changes.
```

---

### PROMPT 09 — P3-T4 Location adapters

```text
Phase 3 task P3-T4. Create location.native.ts / location.web.ts used by customer geo-assist and technician en-route/tracker call sites.
Web Geolocation API wrapper must be able to signal PERMISSION_DENIED.
Do NOT yet change En Route UI gating (Phase 6) except ensuring adapter can express denial.
Native expo-location behavior unchanged.
Touch both apps only for adapter wiring if required; minimize.
Report. STOP if rewriting job business rules.
```

---

### PROMPT 10 — P3-T5 Technician media/docs/pdf adapters

```text
Phase 3 task P3-T5. Technician pick-image, pick-document, pdf-viewer .native/.web adapters.
Native = current ImagePicker/DocumentPicker/WebView behavior moved as-is.
Web stubs until Phase 6.
Preserve job-photos and technician-documents buckets/path rules via existing helpers.
FORBIDDEN: execute wizard behavior changes beyond imports.
Report. STOP if outside scope.
```

---

### PROMPT 11 — P3-T6 Auth storage web alignment

```text
Phase 3 task P3-T6. Inspect lib/supabase.ts in both apps.
If web session fails due to storage, add auth storage adapter (.native AsyncStorage / .web localStorage) without cookie SSR.
Do not introduce @supabase/ssr.
Do not put service-role anywhere.
Validate web login still boots; native session unchanged.
STOP if requiring api package redesign.
```

---

### PROMPT 12 — P2-T1 Customer responsive shell

```text
Phase 2 task P2-T1. Implement web/desktop shell (≥1024 or Platform web) for customer-app (main) tabs without changing native phone tab bar.
Create apps/customer-app components for shell; use @oorjaman/config tokens.
FORBIDDEN: payment/map features; mobile tab IA changes.
Validate 390 vs 1280 layouts; native phone unchanged.
Mobile Safety Gate. Report. STOP if scope expands.
```

---

### PROMPT 13 — P2-T2 Technician responsive shell

```text
Phase 2 task P2-T2. Same as P2-T1 for technician-app.
FORBIDDEN: GPS rule changes; execute redesign beyond shell.
Mobile Safety Gate. Report. STOP if outside scope.
```

---

### PROMPT 14 — P5-T1 Customer web auth

```text
Phase 5 task P5-T1. Customer web Email OTP + Play Review path working end-to-end on web.
Use existing authApi. No cookie SSR. No service-role.
ALLOWED: customer login components/screens, auth storage adapter.
Validate OTP on web. Native unchanged. Report. STOP if outside scope.
```

---

### PROMPT 15 — P5-T2 Registration + addresses

```text
Phase 5 task P5-T2. Customer registration + address book + browser geolocation assist + manual fallback on web.
Do not block registration solely because geo denied — allow manual entry (geo is assist).
FORBIDDEN: inventing new address schema; api rewrite.
Validate web flow. Report. STOP if outside scope.
```

---

### PROMPT 16 — P5-T3 Razorpay web checkout

```text
Phase 5 task P5-T3. Implement Razorpay Checkout.js in razorpay-checkout.web.ts.
Reuse paymentApi + Edge verify. Feature-flag EXPO_PUBLIC_WEB_PAYMENTS.
Native react-native-razorpay path must remain untouched.
FORBIDDEN: duplicating order/amount rules; service-role; production enable without verify proof.
Validate test-mode payment on web. Report deps if any added. STOP if Edge HMAC changes required without documenting halt.
```

---

### PROMPT 17 — P5-T4 Book + pricing

```text
Phase 5 task P5-T4. Make /book one-time booking + pricing/quote usable on web with responsive layout.
Shared booking/payment domain only.
Validate create booking path on web (test). Mobile Safety Gate. STOP if outside scope.
```

---

### PROMPT 18 — P5-T5 AMC parity

```text
Phase 5 task P5-T5. AMC view, subscribe, manage, and pause/resume/cancel where present on mobile — on web.
Include web checkout via adapter where mobile charges.
FORBIDDEN: changing subscription business rules in api beyond bugfix.
Validate against mobile feature set. Report. STOP if outside scope.
```

---

### PROMPT 19 — P5-T6 Bookings + credits + cancel/refund/postpaid + reschedule

```text
Phase 5 task P5-T6. Credits, bookings list/detail, cancel/refund/postpaid, reschedule on web — parity with mobile.
Use existing apis. Responsive only as needed.
Mobile Safety Gate. Report. STOP if outside scope.
```

---

### PROMPT 20 — P5-T7 Preferred partner

```text
Phase 5 task P5-T7. Preferred partner flow on web.
No api redesign. Report. STOP if outside scope.
```

---

### PROMPT 21 — P5-T8 Functional live map

```text
Phase 5 task P5-T8. CRITICAL: Implement Google Maps JavaScript API live tracking for customer web.
NO production stub. Shared booking location fetching; only MapView is .web.
Configure key via EXPO_PUBLIC_GOOGLE_MAPS_API_KEY; document referrer restriction need.
Native react-native-maps unchanged.
Validate map renders technician/job context on web. Report. STOP if you cannot implement functional map — do not fake success.
```

---

### PROMPT 22 — P5-T9 Support + realtime

```text
Phase 5 task P5-T9. Support chat + client realtime on web.
Push remains deferred. No Web Push.
Validate messages. Report. STOP if outside scope.
```

---

### PROMPT 23 — P5-T10 Site photos + invoice

```text
Phase 5 task P5-T10. Site photo upload/view and tax invoice preview/download/print on web via adapters.
Preserve storage rules. Native paths unchanged.
Validate. Mobile Safety Gate for Phase 5. Report. STOP if outside scope.
```

---

### PROMPT 24 — P6-T1 Technician auth + KYC

```text
Phase 6 task P6-T1. Technician web Email OTP, Play Review, KYC, document upload via web adapters.
Preserve technician-documents bucket rules.
Validate. STOP if outside scope.
```

---

### PROMPT 25 — P6-T2 Technician gates

```text
Phase 6 task P6-T2. pending-vendor-review, vendor-not-onboarded, wrong-role on web.
No business rule weakening. Report. STOP if outside scope.
```

---

### PROMPT 26 — P6-T3 Home jobs

```text
Phase 6 task P6-T3. Home, availability, jobs list, job detail on web.
Responsive shell already exists. Validate. STOP if outside scope.
```

---

### PROMPT 27 — P6-T4 En-route GPS gate

```text
Phase 6 task P6-T4. CRITICAL: En Route must call location adapter; if browser geolocation denied, BLOCK En Route (do not silently continue).
Google Maps navigation via URL remains.
Native en-route behavior unchanged.
Validate deny path and allow path on mobile browser. Report. STOP if tempted to bypass GPS.
```

---

### PROMPT 28 — P6-T5 Execute wizard

```text
Phase 6 task P6-T5. Full execute wizard on web: verify, safety, selfie, start, before, after, issues, submit with job-photos uploads.
Use media adapters. Do not skip safety/codes.
Primary validation: mobile browser. Also smoke desktop.
Native camera path unchanged.
Mobile Safety Gate. Report. STOP if outside scope.
```

---

### PROMPT 29 — P6-T6 Collect

```text
Phase 6 task P6-T6. Collect payment link, QR, partner-collected on web.
No react-native-razorpay on technician. Report. STOP if outside scope.
```

---

### PROMPT 30 — P6-T7 Profile docs + feedback/activity/profile

```text
Phase 6 task P6-T7. Profile documents PDF view/download (web iframe/download), feedback, activity, profile on web.
Report. STOP if outside scope.
```

---

### PROMPT 31 — P6-T8 Foreground tracker (optional degrade)

```text
Phase 6 task P6-T8. While job trackable and tab visible, best-effort location upload on web (approved degrade vs native periodic tracker).
Must not replace En Route GPS gate.
If too risky during store review, implement behind flag and document.
Report. STOP if changing native tracker semantics.
```

---

### PROMPT 32 — P4-T1 Marketing customer CTA

```text
Phase 4 task P4-T1. Update apps/oorjaman-web CTAs to link to customer web login using NEXT_PUBLIC_CUSTOMER_WEB_URL (or equivalent).
Do not rebuild marketing in Expo. Preserve SEO metadata.
FORBIDDEN: app.oorjaman.com SEO landing pages for services.
Report. STOP if outside scope.
```

---

### PROMPT 33 — P4-T2 Marketing partner CTA

```text
Phase 4 task P4-T2. Where partner CTAs exist, link to https://partner.oorjaman.com (env-driven).
No Expo SSR. Report. STOP if outside scope.
```

---

### PROMPT 34 — P8-T1 SEO audit

```text
Phase 8 task P8-T1. Audit apps/oorjaman-web metadata, canonical, OG, structured data, sitemap, robots per project-docs/SEO.md.
Fix only clear gaps. Do not touch Expo apps.
Report findings + changes. STOP if outside scope.
```

---

### PROMPT 35 — P8-T2 App host noindex

```text
Phase 8 task P8-T2. Ensure customer-app and technician-app web exports include robots.txt Disallow and/or noindex meta for all routes.
Document Vercel header approach if needed.
FORBIDDEN: indexing authenticated apps. Report. STOP if outside scope.
```

---

### PROMPT 36 — P9-T1 Customer Vercel

```text
Phase 9 task P9-T1. Add SPA vercel config for customer Expo web static export; document build/output/env in project-docs/WEB-UNIVERSAL.md.
Do not add Cloudflare or Express. Never service-role env.
Do not change EAS store profiles.
Report. STOP if export path unknown — discover via expo export then document.
```

---

### PROMPT 37 — P9-T2 Technician Vercel

```text
Phase 9 task P9-T2. Same as P9-T1 for technician-app → partner.oorjaman.com.
Report. STOP if outside scope.
```

---

### PROMPT 38 — P9-T3 Domains headers rollback

```text
Phase 9 task P9-T3. Document custom domains, security headers, caching, preview protection, rollback in project-docs/WEB-UNIVERSAL.md.
No Cloudflare. Report. STOP if outside scope.
```

---

### PROMPT 39 — P10-T1 Customer sign-off

```text
Phase 10 task P10-T1. Execute Customer Parity Contract checklist from ORJ_WEB_UNIVERSAL_IMPLEMENTATION_PLAN.md against deployed/staging web.
Produce project-docs/WEB-UNIVERSAL-CUSTOMER-SIGNOFF.md with pass/fail per bullet.
No feature coding unless critical blocker fix in declared files — prefer report-only.
STOP and list blockers if any fail.
```

---

### PROMPT 40 — P10-T2 Technician sign-off

```text
Phase 10 task P10-T2. Execute Technician Parity Contract on mobile browser primarily; note desktop.
Include GPS deny blocks En Route proof.
Write project-docs/WEB-UNIVERSAL-TECHNICIAN-SIGNOFF.md.
STOP if any binding bullet fails.
```

---

### PROMPT 41 — P10-T3 Mobile Safety Gate

```text
Phase 10 task P10-T3. Run/record Mobile Safety Gate: Customer iOS/Android, Technician iOS/Android, both web logins on release SHA.
Document results in project-docs/WEB-UNIVERSAL-MOBILE-GATE.md.
If any fail, mark NOT READY. No drive-by fixes outside failing scope without new task.
```

---

### PROMPT 42 — P10-T4 Go-live security drill

```text
Phase 10 task P10-T4. Verify Auth allowlist, no service-role in Vercel, maps referrer restrictions, payment flag state, rollback drill notes.
Update project-docs/WEB-UNIVERSAL.md go-live section.
Do not implement Cloudflare/Express/JS migration.
Final statement: IMPLEMENTATION STATUS recommendation COMPLETE or BLOCKED with reasons.
```

---

## Agent operating rules (all prompts)

1. Inspect before modify.  
2. Modify only permitted files.  
3. No unrelated refactors.  
4. No native behavior change unless task explicitly requires.  
5. Validate after changes.  
6. Report: files changed, tests run, unexpected dependency changes.  
7. **STOP** if implementation requires undeclared scope.  

---

## Final status

| Field | Value |
|-------|--------|
| **ARCHITECTURE STATUS** | **LOCKED** |
| **IMPLEMENTATION STATUS** | **NOT STARTED** |
| **READY FOR PHASE 0** | **YES** |

**STOP.** Do not implement source changes in this step.
