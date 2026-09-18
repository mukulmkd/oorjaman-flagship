# OorjaMan Universal Web Architecture Plan

**Document:** `ORJ_WEB_UNIVERSAL_ARCHITECTURE_PLAN.md`  
**Status:** Analysis & planning only (no implementation in this change)  
**Date:** 2026-09-18  
**Scope:** Production-grade web for Customer + Technician Expo apps via React Native Web, without destabilizing iOS/Android App Store / Play Store releases  
**Constraint noted:** Request asked for “JavaScript only / no TypeScript.” The monorepo is TypeScript-first today — see §9 and Open Questions.

---

## 1. Executive Summary

OorjaMan already runs a **six-app monorepo**:

| Surface | Path | Stack today |
|---------|------|-------------|
| Customer mobile | `apps/customer-app` | Expo SDK **57**, Expo Router **~57.0.11**, RN **0.86.3**, React **19.2.3** |
| Technician (Partner) mobile | `apps/technician-app` | Same Expo stack |
| Marketing / SEO site | `apps/oorjaman-web` | **Next.js 15** App Router (`https://oorjaman.com`) |
| Admin / Vendor / Support portals | `apps/{admin,vendor,support}-web` | **Vite 8** SPA + `@oorjaman/web-ui` |
| Shared domain API | `packages/api` | Supabase JS client + RLS-backed domain modules |
| Shared mobile UI | `packages/ui` | RN/Expo components |
| Shared web portal UI | `packages/web-ui` | DOM React for Vite portals |

**Critical finding:** `react-native-web` **^0.21.0** and `react-dom` **19.2.3** are already in `@oorjaman/mobile-deps`. Both mobile apps already have `"web": "expo start --web"` and customer has an `expo export -p web` deploy script. Web is **not greenfield enablement** — it is **productization of an incomplete, client-only Expo web path** with hard native blockers (Razorpay, maps, camera, push, FileSystem).

**Recommended target architecture (based on this repo, not generic Expo advice):**

1. **Keep Customer and Technician as separate Expo apps** (do not merge into one universal binary).
2. **Keep `apps/oorjaman-web` as the public SEO / SSR–SSG surface** at `https://oorjaman.com`.
3. **Ship authenticated Customer Web and Technician Web as Expo Router + React Native Web SPAs** (CSR) on dedicated hostnames (e.g. `https://app.oorjaman.com`, `https://partner.oorjaman.com`).
4. **Do not rebuild marketing SEO inside Expo Router SSR** while Next.js marketing already exists and is documented in `project-docs/SEO.md`.
5. **Extract platform adapters** (`.web.ts` / `.native.ts`) for payments, maps, media, storage, notifications — without rewriting `@oorjaman/api` business logic.
6. **Preserve mobile release trains** via shared packages + adapters; never couple App Store builds to web-only dependency upgrades without dual validation.

**Priority order (as requested):** mobile stability → reuse → clean architecture → SSR correctness → SEO → security → maintainability → deploy simplicity → performance.

---

## 2. Current Repository Architecture

```
oorjaman-flagship/
├── apps/
│   ├── customer-app/          Expo 57 + Expo Router (scheme: oorjaman-customer)
│   ├── technician-app/        Expo 57 + Expo Router (scheme: oorjaman-technician)
│   ├── oorjaman-web/          Next 15 marketing/SEO (oorjaman.com)
│   ├── admin-web/             Vite portal (ops)
│   ├── vendor-web/            Vite portal (partners)
│   └── support-web/           Vite portal (support desk)
├── packages/
│   ├── api/                   Supabase domain layer (auth, bookings, payments, …)
│   ├── ui/                    Mobile RN UI
│   ├── web-ui/                Portal DOM UI
│   ├── config/                Brand + semantic colors + public-site helpers
│   ├── utils/                 Booking slots, datetime, brand-print
│   ├── mobile-deps/           Shared Expo/RN deps (includes RN Web)
│   ├── mobile-config/         Expo plugins, Metro, rebuild scripts
│   ├── portal-deps/           Shared Vite portal deps
│   └── vite-portal-config/    Shared Vite/ESLint/tsconfig
├── supabase/                  schema, policies, migrations, Edge Functions
├── project-docs/              SEO, Vercel, Razorpay, Environment, …
└── package.json               npm workspaces: apps/*, packages/*
```

**Workspace:** npm workspaces, Node `>=22.13.0`, `packageManager: npm@10.9.2`.

**Backend doctrine (from workspace rules + code):** no custom Express product API. Frontends use `@oorjaman/api` → Supabase (Postgres + RLS + Edge Functions). Service role stays in Edge Functions / scripts — not in client packages.

**Deployment today:**
- Marketing: Next (often static export for UAT/GoDaddy); see `project-docs/VERCEL.md`, `SEO.md`.
- Portals: Vite SPA; root `vercel.json` SPA rewrite + security headers.
- Mobile: EAS (`eas.json` profiles: development / uat / production).
- No Cloudflare Workers/`wrangler.toml` found for product apps.

**TypeScript:** Entire product surface is TypeScript (apps + `packages/api|ui|config|utils|web-ui`). “JS only” would be a **policy reversal**, not the current reality.

---

## 3. Customer App Architecture Audit

**Location:** `apps/customer-app`  
**Config:** `apps/customer-app/app.config.ts`  
**Package IDs:** `com.oorjaman.customer` / `.uat`  
**Scheme:** `oorjaman-customer` / `oorjaman-customer-uat`

### Architecture pattern

- Expo Router file routes under `app/`
- Root Stack + `(main)` Tabs
- Many high-value flows are **root Stack modals** (`/book`, `/booking-detail`, `/booking-track`, …) outside the tab layout
- Server state: **TanStack React Query** (`providers/query-provider.tsx`)
- No Zustand
- Auth persistence: **AsyncStorage** via `createSupabaseMobileClient` (`lib/supabase.ts`) — **not** SecureStore (despite older rule text)
- Shared UI: `@oorjaman/ui`; domain: `@oorjaman/api`

### Auth / onboarding

```
/ → splash → session?
  yes → resolveCustomerAppPostAuthPath → /(main) | /customer-registration | /wrong-role
  no  → /onboarding → /permissions → /login
```

- Email OTP primary (`authApi.requestEmailOtp` / `verifyEmailOtp`)
- Phone OTP gated behind dummy auth / “coming soon”
- Play Review password path for designated emails
- `(main)/_layout` enforces customer role + `onboarding_completed_at` + mandatory service address gate

### Native coupling hotspots

| Area | Implementation | Web status today |
|------|----------------|------------------|
| Payments | `react-native-razorpay` + `lib/razorpay-checkout.ts` | Explicitly **disabled** when `Platform.OS === "web"` |
| Live track | `react-native-maps` + Directions | Web shows unsupported stub |
| Site photos | `expo-image-picker` + location stamping + FileSystem/manipulator | Needs browser MediaDevices + canvas adapters |
| Push | `expo-notifications` + customer push upsert | UI package already skips push on web |
| Invoice | print / sharing / WebView preview / view-shot | Needs browser print / download |
| UPI deep links | iOS `LSApplicationQueriesSchemes` | N/A on web; use Razorpay hosted methods |

### Strengths for RN Web

- Domain logic already centralized in `@oorjaman/api`
- Many list/detail/profile screens are API + layout
- RN Web already a transitive dependency
- Some web guards already exist (Razorpay, maps, notifications)

### Blockers

- No `.web.ts` / `.native.ts` module graph — only inline `Platform.OS` branches
- `@oorjaman/ui` peers assume Expo Router / keyboard-controller / reanimated / Alert
- Modal-heavy navigation is phone-shaped; desktop needs shell redesign
- Absolute / phone dimensions and keyboard offsets common

---

## 4. Technician App Architecture Audit

**Location:** `apps/technician-app`  
**Config:** `apps/technician-app/app.config.ts`  
**Package IDs:** `com.oorjaman.technician` / `.uat`  
**Scheme:** `oorjaman-technician` / `oorjaman-technician-uat`  
**Product name:** OorjaMan Partner

### Architecture pattern

- Parallel Expo Router structure to customer-app
- Tabs: Home / Jobs / Feedback / Activity / Profile
- Field visit nested under `/(main)/jobs/execute/[bookingId]` (8-step wizard)
- React Query; AsyncStorage auth; duplicated login/help components (not extracted to a shared package beyond `@oorjaman/ui`)

### Auth / onboarding

```
/ → splash → resolveTechnicianAppPostAuthPath
  → /(main) | /technician-onboarding | /pending-vendor-review
  | /vendor-not-onboarded (signs out) | /wrong-role
```

KYC onboarding uploads to `technician-documents` via DocumentPicker / ImagePicker / DateTimePicker.

### Job execution (native-critical)

Steps: `verify → safety → selfie → start → before → after → issues → submit`  
Evidence bucket: `job-photos`  
Codes typed (no barcode scanner).  
En-route: GPS fix + **Linking to Google Maps URLs** (no Maps SDK).  
Collect: payment **link** + QR image URL + partner-collected — **no** `react-native-razorpay`.

### Native coupling hotspots

| Area | Implementation | Web approach |
|------|----------------|--------------|
| Evidence photos | Camera / library | `<input type="file" accept="image/*" capture>` + compress |
| KYC docs | DocumentPicker + camera | File input + PDF viewer |
| Location gate + tracker | `expo-location` periodic upload | Browser Geolocation API; degrade tracker when denied |
| Navigation | Google Maps URL via Linking | Same URLs in new tab |
| Push | Expo push token | Web Push optional later; not required for MVP parity of core jobs |
| PDF preview | WebView | iframe / object / download |

### Empty / quirks

- `app/field-visit/` directory empty (no routes)
- Phone OTP production-blocked without dummy auth (same pattern as customer)

---

## 5. Complete Route / Screen Inventory

Classification key:

| Code | Meaning |
|------|---------|
| **A** | Public + SEO + SSR/SSG |
| **B** | Authenticated web application |
| **C** | Client-only app functionality (CSR OK) |
| **D** | Native-only (or native-primary) |
| **E** | Shared universal component/screen |
| **F** | Platform-specific implementation required |

### 5.1 Customer app routes

| Route | File | Purpose | Auth | Class | Web | SEO | Risk | Approach |
|-------|------|---------|------|-------|-----|-----|------|----------|
| `/` | `app/index.tsx` | Splash / bootstrap | Public | C | Share + web splash | noindex | Low | Shared; shorter splash on web |
| `/onboarding` | `app/onboarding.tsx` | Intro slides | Public | C | Share | noindex | Low | Optional skip if web CTA from marketing |
| `/permissions` | `app/permissions.tsx` | Location primer | Public | F | `.web` soft-prompt or skip | noindex | Med | Don’t block web login on OS permission UX |
| `/login` | `app/login.tsx` | OTP tabs | Public | E/F | Share UI; storage adapter | noindex | Med | Cookie/localStorage adapter |
| `/customer-registration` | `app/customer-registration.tsx` | Site profile | Session | B/F | Share + geolocation web | noindex | High | Address/GPS web path |
| `/wrong-role` | `app/wrong-role.tsx` | Wrong app role | Session | E | Share | noindex | Low | Shared |
| `/(main)` | `app/(main)/index.tsx` | Home | Customer | B | Responsive shell | noindex | Med | Desktop layout |
| `/(main)/bookings` | `…/bookings/index.tsx` | Booking list | Customer | B | Table/cards responsive | noindex | Med | FlashList → FlatList/web virtualized |
| `/(main)/subscription` | `…/subscription.tsx` | AMC | Customer | B/F | Share + Razorpay.js | noindex | High | Payment adapter |
| `/(main)/activity` | `…/activity.tsx` | Activity feed | Customer | B | Share | noindex | Low | Shared |
| `/(main)/profile` | `…/profile.tsx` | Profile / addresses / photos | Customer | B/F | Share + media web | noindex | High | Site photos adapter |
| `/book` | `app/book.tsx` | Booking wizard | Soft | B/F | Desktop wizard | noindex | High | Payment + address |
| `/preferred-partner` | `app/preferred-partner.tsx` | Partner picker | Soft | B | Modal→panel | noindex | Low | Responsive sheet |
| `/booking-detail` | `app/booking-detail.tsx` | Detail / pay / cancel | Soft | B/F | Share + pay web | noindex | High | Payment + invoice |
| `/booking-track` | `app/booking-track.tsx` | Live map | Soft | F | Map JS / embed | noindex | High | Replace RN Maps |
| `/booking-reschedule` | `app/booking-reschedule.tsx` | Reschedule | Soft | B | Share | noindex | Low | Shared |
| `/credits` | `app/credits.tsx` | Credits ledger | Soft | B | Share | noindex | Low | Shared |
| `/support-chat` | `app/support-chat.tsx` | Support | Soft | B | Share | noindex | Med | Realtime CSR only |

**Layouts:** `app/_layout.tsx`, `app/(main)/_layout.tsx`, `app/(main)/bookings/_layout.tsx` — all need web-safe providers (no push registration crash; keyboard controller shim).

### 5.2 Technician app routes

| Route | File | Purpose | Auth | Class | Web | SEO | Risk | Approach |
|-------|------|---------|------|-------|-----|-----|------|----------|
| `/` | `app/index.tsx` | Splash | Public | C | Share | noindex | Low | Shared |
| `/onboarding` | `app/onboarding.tsx` | Partner intro | Public | C | Share | noindex | Low | Shared |
| `/permissions` | `app/permissions.tsx` | Location primer | Public | F | Soft geolocation | noindex | Med | Don’t hard-block |
| `/login` | `app/login.tsx` | OTP | Public | E/F | Share + storage | noindex | Med | Adapter |
| `/technician-onboarding` | `app/technician-onboarding.tsx` | KYC | Session | B/F | File inputs | noindex | High | Document/camera web |
| `/pending-vendor-review` | `app/pending-vendor-review.tsx` | Waiting | Session | B | Share | noindex | Low | Shared |
| `/vendor-not-onboarded` | `app/vendor-not-onboarded.tsx` | No invite | Transient | E | Share | noindex | Low | Shared |
| `/wrong-role` | `app/wrong-role.tsx` | Wrong role | Session | E | Share | noindex | Low | Shared |
| `/profile-documents` | `app/profile-documents.tsx` | Doc preview | Session | B/F | iframe PDF | noindex | Med | Replace WebView |
| `/(main)` | `app/(main)/index.tsx` | Home | Tech | B | Desktop shell | noindex | Med | Responsive |
| `/(main)/jobs` | `…/jobs/index.tsx` | Job list | Tech | B | Table/cards | noindex | Med | Shared logic |
| `/(main)/jobs/[id]` | `…/jobs/[id].tsx` | Detail / en route | Tech | B/F | Geolocation + maps URL | noindex | High | Location adapter |
| `/(main)/jobs/execute/[bookingId]` | `…/execute/…` | Field wizard | Tech | B/F | Camera/file | noindex | **Critical** | Media adapters; outdoor UX → desktop guided flow |
| `/(main)/jobs/collect/[bookingId]` | `…/collect/…` | Collect pay | Tech | B | Share/link | noindex | Med | Web Share / clipboard |
| `/(main)/feedback` | `app/(main)/feedback.tsx` | Ratings | Tech | B | Share | noindex | Low | Shared |
| `/(main)/activity` | `app/(main)/activity.tsx` | Activity | Tech | B | Share | noindex | Low | Shared |
| `/(main)/profile` | `app/(main)/profile.tsx` | Profile | Tech | B | Share | noindex | Low | Shared |

### 5.3 Public marketing routes (already exist — do not rebuild in Expo)

From `apps/oorjaman-web/app/**/page.tsx` (classification **A**):

Home, about, pricing, how-it-works, FAQ, contact, download, partners, safety, legal (+ `[slug]`), cities (+ `[slug]`), blog (+ `[slug]`), stories (+ `[slug]`), for-homeowners / for-businesses / for-societies / for-business, services/panel-cleaning, services/amc-maintenance, panel-cleaning, amc-maintenance.

These are the **correct** SSR/SSG SEO surface today (`project-docs/SEO.md`: canonical `https://oorjaman.com`).

---

## 6. Feature Parity Matrix

| Feature | Customer mobile | Customer web target | Technician mobile | Technician web target |
|---------|-----------------|---------------------|-------------------|------------------------|
| Email OTP login | ✅ | ✅ MVP | ✅ | ✅ MVP |
| Phone OTP | Gated | Same policy | Gated | Same policy |
| Registration / KYC | Customer site profile | ✅ | Technician docs | ✅ with file API |
| Home dashboard | ✅ | ✅ responsive | ✅ | ✅ responsive |
| Book one-time | ✅ | ✅ | — | — |
| AMC subscribe / manage | ✅ | ✅ | — | — |
| Razorpay checkout | Native SDK | **Razorpay.js / hosted** | — | — |
| Postpaid collect | Customer pay | Web checkout | Link + cash mark | ✅ |
| Booking history / detail | ✅ | ✅ | Jobs list / detail | ✅ |
| Live technician map | RN Maps | Google Maps JS | — | — |
| En-route GPS | — | — | ✅ upload | Browser geo (best-effort) |
| Start selfie + before/after | — | — | Camera | File/camera input |
| Safety checklist + codes | — | — | ✅ | ✅ |
| Credits | ✅ | ✅ | — | — |
| Support chat + realtime | ✅ | ✅ CSR | ✅ | ✅ CSR |
| Push notifications | ✅ | Optional later | ✅ | Optional later |
| Site photo gallery | ✅ | File upload | Read-only on job | ✅ |
| Tax invoice share | Print/share | Download/print | — | — |
| Preferred partner | ✅ | ✅ | — | — |

**Parity definition for MVP web:** all authenticated flows that do not require background GPS or OS push. Push and background tracking are **enhancements**, not launch blockers for customer web; technician web should support **foreground** geolocation for en-route and degrade gracefully.

---

## 7. React Native Web Compatibility Matrix

| Dependency / API | In repo | RN Web support | Action |
|------------------|---------|----------------|--------|
| `expo-router` | ✅ | Good for SPA | Use for app hosts |
| `react-native-web` | ✅ mobile-deps | Good | Keep version aligned |
| `@tanstack/react-query` | ✅ | Excellent | Shared |
| `@oorjaman/api` | ✅ | Excellent (isomorphic) | Shared |
| `@oorjaman/config` / `utils` | ✅ | Excellent | Shared |
| `@oorjaman/ui` | ✅ | Partial | Shim native peers; extract web variants gradually |
| `@shopify/flash-list` | ✅ | Limited | Fallback FlatList on web |
| `react-native-reanimated` | ✅ | Partial | Prefer CSS / LayoutAnimation on web critical paths |
| `react-native-keyboard-controller` | ✅ | Poor | `.web` no-op / KeyboardAvoidingView |
| `expo-image-picker` | ✅ | Partial | `.web` file input adapter |
| `expo-location` | ✅ | Partial | Geolocation API wrapper |
| `expo-notifications` | ✅ | Stubbed in UI | Keep no-op on web MVP |
| `expo-document-picker` | tech | Partial | File input |
| `@react-native-community/datetimepicker` | tech | Partial | Already text fallback on web in onboarding |
| `react-native-maps` | customer | Poor | `.web` Maps JavaScript API |
| `react-native-razorpay` | customer | None | `.web` Razorpay Checkout.js |
| `expo-file-system` | customer | Poor | Blob / fetch adapters |
| `expo-image-manipulator` | customer | Poor | Canvas compress |
| `react-native-webview` | both | Awkward | iframe / new tab |
| `react-native-view-shot` | customer | None | html2canvas or server PDF later |
| `expo-print` / `expo-sharing` | both | Poor | `window.print` / download |
| AsyncStorage | ✅ | Uses localStorage | OK for CSR; not SSR cookies |
| `expo-secure-store` | **Absent** | — | Optional native upgrade later; not blocking web |

---

## 8. Native-only Functionality Matrix

| Capability | Keep native | Web equivalent | Notes |
|------------|-------------|----------------|-------|
| Razorpay native SDK | ✅ | Checkout.js / payment link | Same Edge verify/webhook |
| Background / frequent GPS tracker | ✅ | Foreground-only / manual “I’m en route” | Privacy + browser limits |
| Expo push | ✅ | Web Push phase 8+ | Realtime in-app can cover many cases |
| UPI app queries (iOS schemes) | ✅ | Razorpay web methods | |
| Adaptive icon / splash native | ✅ | PWA icons / web splash | |
| Phone-only Android plugin | ✅ | Responsive web | |
| Camera quality for outdoor evidence | Prefer native | Accept web camera with guidance | Field techs may still prefer phone |
| App Store / Play distribution | ✅ | — | Unaffected if adapters isolated |

---

## 9. Proposed Universal Architecture

### Decision: Option A — separate Expo apps + shared packages (+ keep Next marketing)

**Compare against this codebase:**

| Option | Fit to OorjaMan repo | Verdict |
|--------|----------------------|---------|
| **A. Separate Expo apps + shared packages** | Matches current `customer-app` / `technician-app`, separate schemes, EAS, branding (“Partner”), divergent deps (maps/razorpay vs docs/GPS). Lowest mobile regression risk. | **Recommended** |
| **B. One universal Expo app + role routing** | Would merge bundle IDs, onboarding trees, tab IAs, store listings, and risk App Review during web work. Massive rewrite of post-auth resolvers. | Reject for near-term |
| **C. New standalone React web apps** | Duplicates UI vs RN; fights “maximum reuse”; portals already cover ops — product apps would fork from `@oorjaman/ui`. | Reject as primary product web |

### Target diagram

```
                    OorjaMan
                         |
         +---------------+----------------+
         |                                |
  apps/oorjaman-web                 Shared core
  (Next SSR/SSG SEO)                packages/api, config, utils
  https://oorjaman.com                     |
                                           |
                    +----------------------+----------------------+
                    |                                             |
           apps/customer-app                            apps/technician-app
           Expo Router + RN                             Expo Router + RN
                    |                                             |
     +--------------+--------------+               +--------------+--------------+
     |              |              |               |              |              |
   iOS           Android      Web CSR            iOS           Android      Web CSR
                           app.oorjaman.com                  partner.oorjaman.com
```

**JavaScript-only constraint:** Implementing new web code as plain JS while `@oorjaman/api` and both apps are TS creates a dual toolchain and weakens `npm run validate` typecheck. **Recommendation:** continue TypeScript for all product code (status quo). If a hard JS mandate is required, limit it to new thin adapter files with JSDoc — do **not** rewrite `packages/api` to JS.

---

## 10. Customer Web Architecture

**Host:** `https://app.oorjaman.com` (recommended)  
**Source:** same `apps/customer-app` Expo Router tree  
**Rendering:** CSR SPA (Expo export / Metro web)  
**Auth:** Supabase anon + RLS; session in browser storage via platform auth storage adapter  
**Shell:** desktop sidebar or top-nav mapping to existing tabs; modals become centered dialogs / right drawers on large screens  
**Payments:** `lib/razorpay-checkout.web.ts` loading Checkout.js; reuse `paymentApi` + Edge verify  
**Maps:** `booking-track.web.tsx` or maps adapter using Google Maps JS (reuse existing Maps API keys pattern from customer `app.config` / env)  
**SEO:** all authenticated routes `noindex, nofollow`; login may be linked from marketing CTAs but should not compete with marketing pages

**CTA bridge from marketing:** `oorjaman-web` `/download` and pricing CTAs gain “Open web app” → `app.oorjaman.com/login` without removing store badges.

---

## 11. Technician Web Architecture

**Host:** `https://partner.oorjaman.com` (recommended; clearer than nesting under `app.`)  
**Source:** same `apps/technician-app`  
**Rendering:** CSR SPA  
**Critical path:** Jobs list → detail → execute wizard with web media uploads to `job-photos`  
**Location:** request browser geolocation on “Mark en route”; tracker becomes best-effort  
**Collect:** keep payment link / QR / partner-collected (already web-friendly)  
**SEO:** fully noindex (partner tool)

---

## 12. Public SEO Architecture

**Do not migrate marketing into Expo.** Keep and harden `apps/oorjaman-web`:

- Canonical: `https://oorjaman.com` (`project-docs/SEO.md`)
- Existing routes cover services, cities, blog, legal, download, partners
- UAT marketing already non-indexed via `NEXT_PUBLIC_DEPLOY_ENV=uat`
- Legal URLs already consumed by mobile via `EXPO_PUBLIC_SITE_URL` / `packages/config` public legal helpers

**Auth app domains must not steal organic rankings** from service/city pages.

---

## 13. SSR / SSG / CSR Rendering Strategy

| Surface | Mode | Why |
|---------|------|-----|
| Marketing pages (`oorjaman-web`) | **SSG preferred / SSR where dynamic** | Crawlable HTML, OG, already Next |
| Customer authenticated app | **CSR** | Session-bound, realtime, no SEO value |
| Technician authenticated app | **CSR** | Same |
| Login pages on app hosts | **CSR** | Token handling; optional soft SSR later — **not required for MVP** |
| Edge Functions | Server | Payments, webhooks, privileged ops |

**Explicit non-goal:** SSR for authenticated dashboards “for its own sake.”

**Expo Router SSR (`@expo/server`):** technically possible later for a thin public slice, but **duplicates** Next marketing and increases mobile CI complexity. Defer indefinitely unless marketing is abandoned (not recommended).

---

## 14. Routing Architecture

### Domains

| Hostname | App | Notes |
|----------|-----|-------|
| `oorjaman.com` / `www` → apex | `oorjaman-web` | Public SEO |
| `app.oorjaman.com` | `customer-app` web | Authenticated customer |
| `partner.oorjaman.com` | `technician-app` web | Authenticated technician |
| Existing portal hosts | admin/vendor/support | Unchanged Vite |

**Evaluation of proposed `oorjaman.com` + `app.oorjaman.com`:** **Appropriate**, with the addition of a **separate partner host** (or `app.oorjaman.com` with path `/partner` only if cookie isolation and role confusion are carefully handled — separate host is cleaner given separate Supabase role post-auth resolvers).

### Expo Router mapping

- Keep file routes identical between native and web for maximum reuse.
- Use `expo-router` linking config / HTTPS associated domains when adding universal links later.
- Deep link parity: map `oorjaman-customer://booking-detail?id=` → `https://app.oorjaman.com/booking-detail?id=`.

### robots / sitemap

- Marketing: existing sitemap/robots on Next.
- `app.` / `partner.`: `Disallow: /` (or allow only `/login` with noindex meta).

---

## 15. Authentication Architecture

**Current:**

- Mobile: `createSupabaseMobileClient` + AsyncStorage; `detectSessionInUrl: false`; `autoRefreshToken: false` (custom refresh handling in UI guards).
- Portals: `createSupabaseBrowserClient` + localStorage.
- No cookie SSR auth adapter in `packages/api`.

**Target for Expo web CSR:**

1. Add `packages/api` (or app `lib`) **auth storage interface** already implied by `NativeAuthStorage`.
2. Web implementation: `localStorage` (or `@supabase/ssr` cookie only if SSR login is introduced later).
3. Keep OTP flows via existing `authApi.*`.
4. Preserve Play Review / dummy auth env gates.
5. Ensure `MobileAuthSessionGuard` web path uses browser-safe alerts (not RN `Alert` only).

**Do not** put service role keys in any Expo web bundle.

---

## 16. Supabase Architecture

| Concern | Guidance |
|---------|----------|
| Anon key | OK in web + mobile (`EXPO_PUBLIC_*`) with RLS |
| Service role | Edge Functions + trusted scripts only |
| Storage buckets | `job-photos`, technician docs, site photos — signed URLs already used |
| Realtime | Client-only subscribe after mount; never during SSR |
| RLS | Remains security boundary for browser origins — audit CORS/site URL allowlists in Supabase Auth settings when adding web hosts |
| Auth redirect URLs | Add `https://app.oorjaman.com/*`, `https://partner.oorjaman.com/*` to Supabase Auth allow list |

---

## 17. Data Access / Service Layer Proposal

**Keep `@oorjaman/api` as the single domain layer** (already true).

Proposed thin additions (names illustrative):

```
packages/api/          # unchanged domain functions
packages/platform/     # NEW optional: storage, file, location, payments facades
  OR apps/*/lib/*.web.ts / *.native.ts  # pragmatic first step
```

**Phased approach (lower risk):** start with **per-app** `.web.ts` / `.native.ts` next to existing libs (`razorpay-checkout`, `job-photos`, `location-access`), then extract cross-app duplicates into `packages/platform` only when stable.

**Do not** move Supabase calls out of `@oorjaman/api` into random UI — the problem is **native I/O**, not missing repositories.

---

## 18. Responsive Design Strategy

**Do not stretch phone layouts to 1440px.**

| Breakpoint (suggested) | Shell |
|------------------------|-------|
| `<768` | Current tab bar patterns |
| `768–1023` | Tabs or compact top nav |
| `≥1024` | Persistent sidebar (Customer: Home, Bookings, AMC, Activity, Profile; Technician: Home, Jobs, Feedback, Activity, Profile) + content canvas |

**Needs redesign for desktop:**

- Booking wizard (`/book`) — multi-column summary + form
- AMC subscription — plan comparison table
- Job execute wizard — stepper with large preview pane for photos
- Booking list / jobs list — responsive table with filters
- Live track — map 60% + detail 40%
- Modals — become drawers/dialogs with focus trap

**Design tokens:** continue `@oorjaman/config` + existing OorjaMan UI rules (no new random palettes). Optionally align with `design-system/` tokens already in repo.

---

## 19. Platform-specific Component Strategy

| Module | Shared | `.native` | `.web` | Why |
|--------|--------|-----------|--------|-----|
| `razorpay-checkout` | types + enablement | RN Razorpay | Checkout.js | Native module absent on web |
| Maps / live track | booking fetch | `react-native-maps` | Google Maps JS | Native maps |
| Image pick / evidence | upload to Supabase via api helpers | ImagePicker | `<input capture>` | Different acquisition |
| Document pick | upload helpers | DocumentPicker | file input | Same |
| Location | permission semantics | expo-location | Geolocation | API difference |
| Notifications register | no-op interface | Expo push | stub / Web Push later | |
| Auth storage | interface | AsyncStorage | localStorage | |
| KeyboardFormScreen | — | keyboard-controller | simple form | Peer missing |
| PDF viewer | — | WebView | iframe | |
| Share invoice | — | print/share | download/print | |
| FlashList screens | data hooks | FlashList | FlatList | |

**Rule:** business decisions (what to upload, which RPC, validation) stay shared; only I/O and chrome fork.

---

## 20. SEO Strategy

| Property | Owner |
|----------|-------|
| Title / description / canonical / OG / Twitter | `oorjaman-web` metadata APIs |
| Sitemap / robots | `oorjaman-web` |
| Structured data (LocalBusiness / Service / FAQ) | `oorjaman-web` (extend existing) |
| App hosts | `noindex` globally |
| Store listing assets | `apps/customer-app/store-listing/` (not SEO HTML) |

Marketing CTAs should deep-link to web app login **without** making `/login` an SEO landing page for “solar panel cleaning.”

---

## 21. Structured Data Strategy

Owned by Next marketing:

- Organization / LocalBusiness on home and city pages
- Service schema on panel-cleaning / AMC pages
- FAQPage on `/faq`
- Article on blog/stories
- BreadcrumbList on nested routes

**Not** on Expo web app shells.

---

## 22. Security Considerations

| Item | Finding | Web implication |
|------|---------|-----------------|
| Anon key in client | Expected | OK with RLS |
| Service role in `@oorjaman/api` | **Not present** | Keep it that way |
| Razorpay secret | Edge only (`project-docs/RAZORPAY.md`) | Web Checkout uses key id only |
| Session in AsyncStorage/localStorage | XSS risk | Strict CSP on app hosts; sanitize; no `dangerouslySetInnerHTML` from user content |
| Auth redirect allowlist | Must update Supabase | Prevent open redirects |
| Realtime | Client | Authz via RLS |
| `api.qrserver.com` QR in tech collect | Third party | Prefer first-party QR lib later |
| Env examples | Good separation EXPO/VITE/NEXT | Don’t mix service keys into Expo web env |
| Portal vs app cookies | Separate hosts | Prefer separate hostnames to isolate XSS blast radius |

---

## 23. Cloudflare / Vercel / Node Deployment Comparison

| Criterion | Cloudflare (Pages/Workers) | Vercel | Node/Express on VPS |
|-----------|----------------------------|--------|---------------------|
| Expo CSR static export | Excellent | Excellent | Excellent |
| Next marketing SSR | Pages Functions / Workers limited vs Node | Excellent (current docs) | Possible |
| Vite portals | Excellent static | Already used | Possible |
| Env / secrets | Good | Good | DIY |
| Complexity | Low for static Expo web; higher if forcing Expo SSR on Workers | Low given existing Vercel usage | Highest ops |
| Caching | Strong CDN | Strong CDN | DIY |
| Fit to repo today | Good for **static app hosts** | Best continuity for marketing + portals | Not needed |

---

## 24. Recommended Deployment Architecture

1. **`oorjaman.com`** — continue Next deploy path already documented (Vercel and/or GoDaddy static export).
2. **`app.oorjaman.com`** — Cloudflare Pages **or** Vercel static hosting of `expo export -p web` for `customer-app`.
3. **`partner.oorjaman.com`** — same for `technician-app`.
4. **SPA fallback** — host config rewrite all paths to `index.html` (Expo Router client routes).
5. **Headers** — reuse security header ideas from root `vercel.json` / Next config (XFO, nosniff, referrer).
6. **Do not** introduce Express for product SSR unless a future requirement exceeds static+Edge.

**Preferred direction for authenticated Expo web:** Cloudflare Pages (static) **if** DNS/CDN strategy moves that way; otherwise Vercel static is acceptable and lower process friction given existing portal deploys.

---

## 25. Migration Strategy

1. **Freeze mobile release behavior** — adapters must be additive; native paths default.
2. **Introduce platform files** without changing call sites’ business logic.
3. **Enable web CI smoke** (boot + login screen) before feature parity.
4. **Feature-flag web payments** behind env until verify webhook proven from browser.
5. **Do not** delete Vite portals or Next marketing as part of this program.
6. **Extract shared login components** from duplicated customer/technician files only when web work touches them (avoid drive-by refactors).

---

## 26. Phased Implementation Plan

### PHASE 0 — Architecture preparation

- **Objective:** Align team + tooling; no user-facing web yet.
- **Affected:** docs, env examples, Supabase Auth URL allowlist prep, branch strategy.
- **Deps:** none.
- **Changes:** confirm hosts; document `EXPO_PUBLIC_WEB_ORIGIN`; add CI job placeholders.
- **Risks:** low.
- **Validation:** plan review sign-off.
- **Exit:** ADRs accepted; hosts reserved.

### PHASE 1 — React Native Web enablement

- **Objective:** Both apps boot on web without crashing providers.
- **Affected:** `app/_layout.tsx`, notification init, keyboard controller, metro/babel if needed, `app.config` `web` section.
- **Deps:** Phase 0.
- **Changes:** shims for push/keyboard; guard location tracker; fix splash.
- **Risks:** subtle native regression if shims leak — use platform extensions.
- **Validation:** `npx expo start --web` login screen both apps; iOS/Android smoke.
- **Exit:** deterministic web boot; native smoke green.

### PHASE 2 — Responsive design system

- **Objective:** Desktop shell without reflow disasters.
- **Affected:** `@oorjaman/ui` AppScaffold / tab bar; app `(main)/_layout`.
- **Deps:** Phase 1.
- **Changes:** breakpoint hooks; sidebar; modal→dialog mapping.
- **Risks:** visual churn on mobile if shared carelessly — gate by platform/width.
- **Validation:** screenshot matrix mobile/tablet/desktop.
- **Exit:** main tabs usable at 1280px and 390px.

### PHASE 3 — Shared business/service layer hardening

- **Objective:** Isolate I/O adapters; keep `@oorjaman/api` pure.
- **Affected:** `lib/razorpay-checkout`, job photos, location, supabase storage factories.
- **Deps:** Phase 1.
- **Changes:** `.web.ts` / `.native.ts` pairs.
- **Risks:** import resolution mistakes — Metro tests both platforms.
- **Validation:** unit tests on pure helpers; native payment still works.
- **Exit:** no `Platform.OS` payment/map branches left inline in screens.

### PHASE 4 — Public SEO pages

- **Objective:** Marketing readiness for web-app CTAs (not rebuild).
- **Affected:** `apps/oorjaman-web` CTA components, SEO metadata, download page.
- **Deps:** Phase 0 hosts.
- **Changes:** “Use web app” links; ensure robots unchanged for app hosts.
- **Risks:** accidental indexation of app — configure robots on app CDN.
- **Validation:** Lighthouse SEO on marketing; app host robots deny.
- **Exit:** marketing links to staging web apps.

### PHASE 5 — Customer Web

- **Objective:** Feature parity MVP for authenticated customer.
- **Affected:** customer routes; Razorpay web; maps web; site photos web.
- **Deps:** Phases 1–3.
- **Risks:** payment verify edge cases; address GPS.
- **Validation:** book → pay test mode → AMC → track → support chat.
- **Exit:** checklist in §36 for customer.

### PHASE 6 — Technician Web

- **Objective:** Feature parity MVP for partner field flows on browser.
- **Affected:** execute wizard media; en-route geo; documents.
- **Deps:** Phases 1–3.
- **Risks:** evidence quality; geolocation denial.
- **Validation:** full job execute on desktop + mobile browser; collect payment.
- **Exit:** checklist for technician.

### PHASE 7 — SSR

- **Objective:** Only if still needed after Phase 4.
- **Affected:** primarily `oorjaman-web` SSR mode (disable static export where SEO needs runtime).
- **Deps:** Phase 4.
- **Recommendation:** **Skip Expo SSR.** Improve Next SSR/SSG instead.
- **Exit:** marketing Core Web Vitals + crawl OK.

### PHASE 8 — SEO hardening

- **Objective:** Structured data, canonical discipline, city/service coverage.
- **Affected:** `oorjaman-web`, `project-docs/SEO.md` execution.
- **Exit:** Search Console clean; no app host indexing.

### PHASE 9 — Cloudflare/Vercel deployment

- **Objective:** Production app hosts + previews.
- **Affected:** CI deploy workflows, DNS, env.
- **Exit:** HTTPS prod apps; rollback documented.

### PHASE 10 — Production validation

- **Objective:** Load, security headers, payment webhook from web origins, mobile regression battery.
- **Exit:** Go-live approval.

---

## 27. Dependency Changes Required

| Add / adopt | Where | Purpose |
|-------------|-------|---------|
| Razorpay Checkout.js (script) | customer web adapter | Payments |
| Google Maps JavaScript API | customer web maps | Live track |
| Optional: `@supabase/ssr` | only if cookie SSR later | Not MVP |
| Optional: PWA / workbox | later | Installability |
| Dev: Playwright | CI | Web e2e |

| Avoid adding | Why |
|--------------|-----|
| Duplicate Axios API layer | `@oorjaman/api` exists |
| New Express BFF | Contradicts architecture |
| Merging apps into one Expo binary | Mobile risk |
| Rewriting portals into Expo | Wrong tool |

**Note:** `react-native-web` already present — do not duplicate versions.

---

## 28. Files That Will Need Modification (future implementation)

*(Planning only — not modified by this document’s creation beyond this plan file.)*

**High likelihood:**

- `apps/customer-app/app/_layout.tsx`, `(main)/_layout.tsx`
- `apps/customer-app/lib/razorpay-checkout.ts` → split native/web
- `apps/customer-app/app/booking-track.tsx` (+ web map)
- `apps/customer-app/lib/site-photo-capture.ts` and related
- `apps/technician-app/app/_layout.tsx`, `(main)/_layout.tsx`
- `apps/technician-app/lib/job-photos.ts` / evidence picker
- `apps/technician-app/components/mandatory-location-gate.tsx`, `technician-location-tracker.tsx`
- `packages/ui` keyboard / notification entry points (web-safe)
- `apps/*/app.config.ts` — `web` icons/name
- `apps/oorjaman-web` CTA pages
- Env examples + Supabase Auth config (dashboard)
- CI workflow `.github/workflows/quality.yml`

---

## 29. Files That Should Be Created (future)

- `**/razorpay-checkout.web.ts` / `.native.ts`
- `**/maps-live.web.tsx` / `.native.tsx`
- `**/pick-image.web.ts` / `.native.ts`
- `**/auth-storage.web.ts` / `.native.ts`
- Web `robots.txt` for app hosts
- Playwright specs under `apps/customer-app/e2e-web/` (or repo `e2e/`)
- Deploy workflow for app/partner hosts
- Optional `packages/platform` after adapters stabilize

---

## 30. Files That Should NOT Be Modified (during web program)

- App Store / Play listing binaries pipelines without need
- `supabase/functions` Razorpay HMAC logic (unless web checkout requires documented extension)
- RLS policies casually (security-sensitive)
- Vite portal apps (unless shared auth storage extraction)
- Rewriting `packages/api` to JavaScript
- Deleting `apps/oorjaman-web` in favor of Expo SSR
- Merging customer + technician apps
- Service role into client bundles

---

## 31. Risk Register

| ID | Risk | Impact | Mitigation |
|----|------|--------|------------|
| R1 | Mobile regression from shared UI changes | **Critical** | Platform extensions; native snapshot tests; release branch freeze |
| R2 | Razorpay web verify mismatches | High | Mirror native session APIs; test mode matrix |
| R3 | XSS on app host steals localStorage session | High | CSP; dependency hygiene; separate partner host |
| R4 | FlashList / Reanimated web crashes | Med | Fallbacks |
| R5 | Technician outdoor UX poor on desktop | Med | Mobile-web first for execute; desktop guided |
| R6 | Accidental SEO indexing of app | Med | robots + noindex |
| R7 | Dual TS/JS policy chaos | Med | Keep TypeScript |
| R8 | Scope creep into portal rewrite | Med | Explicit non-goals |
| R9 | Maps key billing / referrer restrictions | Med | HTTP referrer allowlist for app host |
| R10 | Store review confusion if web deep links break | Low | Keep native schemes untouched |

---

## 32. Testing Strategy

| Layer | Native | Web |
|-------|--------|-----|
| Unit | utils, pricing, otp helpers | same |
| Component | RN Testing Library where present | web variants |
| Integration | Detox/Maestro optional | Playwright: login, book, pay test, execute upload |
| Contract | Edge payment verify fixtures | same |
| Regression | EAS UAT builds every adapter PR | |
| Visual | — | Percy/Chromatic optional for shells |

---

## 33. Mobile Regression Strategy

1. **Branching:** `main` protected; feature branches `web/*`; require green native smoke before merge.
2. **Adapters first:** never `Platform.OS === 'web'` inside payment verify business logic.
3. **Feature flags:** `EXPO_PUBLIC_WEB_PAYMENTS=1` etc.
4. **Build verification:** `eas build --profile uat` customer + technician on adapter PRs touching shared packages.
5. **Store freeze window:** no `@oorjaman/ui` peer bumps during App Review without explicit approval.
6. **Rollback:** revert web host deploy independently of native store versions.

---

## 34. CI/CD Considerations

- Extend `.github/workflows/quality.yml` with web typecheck + Playwright smoke.
- Separate deploy workflows for `app.` and `partner.` static exports.
- Cache Metro/Expo.
- Never upload `.env` ; use CI secrets for `EXPO_PUBLIC_*` web builds.
- Keep portal and marketing pipelines independent.

---

## 35. Rollback Strategy

| Layer | Rollback |
|-------|----------|
| App host static deploy | Prior Cloudflare/Vercel deployment |
| Marketing CTA | Revert Next deploy |
| Shared package bug hitting mobile | Revert package commit; ship OTA (`expo-updates`) if configured for customer |
| Payment web flag | Disable `EXPO_PUBLIC_WEB_PAYMENTS` without native rebuild |
| DNS | Point host back to maintenance page |

Native store builds remain on prior binary if web-only change.

---

## 36. Definition of Done

**Customer Web MVP**

- [ ] Login email OTP on `app.` host
- [ ] Registration / address management
- [ ] Book one-time with test Razorpay web checkout + verify
- [ ] AMC plan view + test checkout
- [ ] Bookings list/detail/reschedule/credits
- [ ] Live track with web map (or documented degraded mode)
- [ ] Support chat realtime
- [ ] Responsive shell ≥1024 and ≤390
- [ ] robots noindex
- [ ] Native UAT regression green

**Technician Web MVP**

- [ ] Login + onboarding document upload
- [ ] Jobs list/detail/en-route with geolocation permission path
- [ ] Full execute wizard with before/after/selfie uploads visible in storage
- [ ] Collect flow
- [ ] Feedback/activity/profile
- [ ] Native UAT regression green

**Program Done**

- [ ] Phases 0–6 + 8–10 complete; Phase 7 explicitly waived or Next-only
- [ ] Security review of CSP + Auth URLs
- [ ] Runbooks in `project-docs/`

---

## 37. Recommended Implementation Order

1. Phase 0 decisions + hosts  
2. Phase 1 web boot shims  
3. Phase 3 adapters (payments/media/location) in parallel with Phase 2 shell  
4. Phase 5 customer MVP  
5. Phase 6 technician MVP  
6. Phase 4/8 marketing CTAs + SEO  
7. Phase 9/10 production  

---

# A. DO FIRST

Exact first 10 implementation tasks (after this plan is approved):

1. Confirm production hostnames (`app.` / `partner.`) and add them to Supabase Auth redirect allowlist (dashboard).
2. Add `web` section (name, icons, bundler) to both `app.config.ts` files without changing native IDs.
3. Introduce no-op `.web.ts` shims for push registration and keyboard-controller usage so `_layout` boots.
4. Split `razorpay-checkout` into `.native.ts` / `.web.ts` stubs (web stub can throw “not enabled” initially).
5. Guard technician location tracker behind `.native.ts`; web returns null component.
6. Add CI step: `expo export -p web` for both apps on a branch (artifact only).
7. Implement responsive `(main)` shell behind `Platform.OS === 'web' || width≥1024` without changing mobile tab bar.
8. Wire customer web map stub → Google Maps JS for `/booking-track` only.
9. Enable Razorpay.js test checkout on `/book` behind env flag; verify Edge path.
10. Playwright smoke: load `/login` on exported web for both apps.

---

# B. DO NOT DO

- Do **not** merge customer-app and technician-app.
- Do **not** replace `apps/oorjaman-web` with Expo Router SSR for marketing.
- Do **not** put `SUPABASE_SERVICE_ROLE_KEY` in Expo web env.
- Do **not** enable Razorpay web in production without webhook + verify test evidence.
- Do **not** rewrite `@oorjaman/api` to JavaScript.
- Do **not** delete Vite admin/vendor/support portals.
- Do **not** SSR authenticated dashboards.
- Do **not** index `app.` / `partner.` in search engines.
- Do **not** “fix” mobile layouts with CSS zoom for desktop.
- Do **not** change native bundle IDs, schemes, or EAS project IDs for web work.
- Do **not** implement web by copying screens into a new CRA/Vite React app.
- Do **not** drive-by refactor unrelated booking business rules during adapter PRs.

---

# C. ARCHITECTURE DECISIONS

1. **Separate Expo apps remain** (Customer vs Technician).
2. **Authenticated product web = Expo Router + RN Web CSR** on dedicated hosts.
3. **Public SEO = existing Next.js `oorjaman-web`**, not Expo SSR.
4. **`@oorjaman/api` stays the domain layer**; platform I/O uses `.web` / `.native` adapters.
5. **TypeScript remains** the product language (status quo); JS-only would be an explicit exception policy.
6. **Payments:** native Razorpay SDK + web Checkout.js; shared Edge verify/webhooks.
7. **Maps:** native `react-native-maps` + web Maps JavaScript API.
8. **Portals (admin/vendor/support) stay Vite** — out of scope for RN Web migration.
9. **Preferred app CDN:** Cloudflare Pages or Vercel **static** for Expo exports; Next continues current path.
10. **Mobile stability outranks web elegance** on every shared-package change.

---

# D. OPEN QUESTIONS

1. **Hard “JavaScript only” mandate vs TypeScript monorepo** — confirm exception to keep TS.
2. Final hostname choice: `partner.oorjaman.com` vs `app.oorjaman.com/technician` (cookie/UX tradeoff).
3. Is technician field-execution on **desktop browsers** a launch requirement, or is **mobile web** sufficient for MVP?
4. Web Push required for MVP or defer?
5. Google Maps JS billing account / referrer restrictions for `app.oorjaman.com`?
6. Should Play/App Store reviews mention web app URLs in listing, or keep download-only CTAs initially?
7. Cloudflare vs Vercel as **org standard** for static app hosts (DNS currently GoDaddy-oriented per docs)?
8. Any legal requirement for web session timeout / SecureStore-equivalent beyond localStorage?

---

# E. ESTIMATED CHANGE SURFACE

| Category | Examples |
|----------|----------|
| **No change** | Most `@oorjaman/api` domain modules; Supabase schema (initially); Vite portals; native EAS profile structure |
| **Minor change** | Layout guards; env examples; marketing CTAs; `app.config` web icons |
| **Moderate refactor** | Login duplication cleanup; responsive shells; location/photo helpers → adapters |
| **Major refactor** | Customer payment + maps web; technician execute media pipeline; desktop navigation IA |
| **New files** | `*.web.ts(x)` / `*.native.ts(x)`; Playwright; deploy workflows; optional `packages/platform` |

---

# F. CURSOR IMPLEMENTATION PROMPTS

Use these **verbatim** as Agent prompts per phase. Each prompt assumes this plan is already in the repo.

### Prompt — PHASE 0

```text
Read ORJ_WEB_UNIVERSAL_ARCHITECTURE_PLAN.md. Execute PHASE 0 only: architecture preparation.
Do not implement web features. Update only documentation/env examples if needed for hostnames and EXPO_PUBLIC_WEB_ORIGIN placeholders.
Do not modify native bundle IDs, schemes, or business logic.
Deliver: short checklist of dashboard actions (Supabase Auth allowlist) for humans, and any doc edits required.
```

### Prompt — PHASE 1

```text
Read ORJ_WEB_UNIVERSAL_ARCHITECTURE_PLAN.md Phase 1. Enable Expo web boot for apps/customer-app and apps/technician-app without breaking iOS/Android.
Add platform-safe shims for push registration and keyboard-controller so app/_layout boots on web.
Prefer .web.ts/.native.ts over inline Platform.OS sprawl.
Validate: expo start --web shows login; do not implement payments/maps yet.
```

### Prompt — PHASE 2

```text
Read ORJ_WEB_UNIVERSAL_ARCHITECTURE_PLAN.md Phase 2. Implement responsive shells for customer-app and technician-app (main tabs) for width ≥1024 while preserving existing mobile tab bars unchanged on native phone sizes.
Use @oorjaman/config tokens. No payment/map work.
```

### Prompt — PHASE 3

```text
Read ORJ_WEB_UNIVERSAL_ARCHITECTURE_PLAN.md Phase 3. Extract platform adapters for: Razorpay checkout, image/document picking, location, auth storage.
Keep @oorjaman/api domain functions intact. Native behavior must remain default and regression-safe.
```

### Prompt — PHASE 4

```text
Read ORJ_WEB_UNIVERSAL_ARCHITECTURE_PLAN.md Phase 4. Update apps/oorjaman-web CTAs to link to staging/prod customer web login without harming SEO.
Do not rebuild marketing in Expo. Ensure guidance for app-host robots noindex is documented.
```

### Prompt — PHASE 5

```text
Read ORJ_WEB_UNIVERSAL_ARCHITECTURE_PLAN.md Phase 5. Implement Customer Web MVP feature parity on Expo RN Web: auth, registration, book, AMC, bookings, credits, support, web Razorpay behind env flag, web map for booking-track.
Do not change technician-app except shared packages if required. Protect mobile Razorpay native path.
```

### Prompt — PHASE 6

```text
Read ORJ_WEB_UNIVERSAL_ARCHITECTURE_PLAN.md Phase 6. Implement Technician Web MVP: jobs, en-route geolocation, execute wizard uploads to job-photos, collect, profile documents preview without RN WebView.
Preserve native camera flows via .native adapters.
```

### Prompt — PHASE 7

```text
Read ORJ_WEB_UNIVERSAL_ARCHITECTURE_PLAN.md Phase 7. Do NOT implement Expo SSR. If SSR work is required, improve apps/oorjaman-web Next SSR/SSG only per project-docs/SEO.md. Document waiver of Expo SSR.
```

### Prompt — PHASE 8

```text
Read ORJ_WEB_UNIVERSAL_ARCHITECTURE_PLAN.md Phase 8. SEO hardening on apps/oorjaman-web only: metadata, structured data, sitemap/robots discipline, confirm app/partner hosts remain noindex.
```

### Prompt — PHASE 9

```text
Read ORJ_WEB_UNIVERSAL_ARCHITECTURE_PLAN.md Phase 9. Add CI/CD to build expo export -p web for customer-app and technician-app and deploy static artifacts to the chosen host (Cloudflare Pages or Vercel), with SPA fallback and security headers. Do not alter native EAS store profiles.
```

### Prompt — PHASE 10

```text
Read ORJ_WEB_UNIVERSAL_ARCHITECTURE_PLAN.md Phase 10. Production validation: Playwright critical paths, payment test-mode evidence, mobile UAT regression checklist, CSP/auth allowlist review, rollback drill. Produce a go-live report in project-docs/ (markdown only).
```

---

## Appendix — Evidence anchors (inspected)

- Root workspaces / engines: `package.json`
- Mobile deps (Expo 57, RN Web): `packages/mobile-deps/package.json`
- Customer routes: `apps/customer-app/app/**`
- Technician routes: `apps/technician-app/app/**`
- Razorpay web disabled: `apps/customer-app/lib/razorpay-checkout.ts`
- API client factories: `packages/api/src/client.ts`
- Marketing SEO: `apps/oorjaman-web/app/**/page.tsx`, `project-docs/SEO.md`
- Payments doctrine: `project-docs/RAZORPAY.md`
- Portals: `packages/web-ui`, `apps/admin-web|vendor-web|support-web`

---

*End of planning document. No application source or configuration was modified to produce this plan beyond adding this file.*
