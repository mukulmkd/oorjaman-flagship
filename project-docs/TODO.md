# OorjaMan — dated TODO

Pick up the **latest open date** section when you resume work. Check boxes as you go.

---

## 2026-05-19 (Tuesday) — Admin web: duplicate API calls

**Symptom:** Supabase REST calls repeat on sidebar navigation — e.g.  
`rest/v1/users?select=id,full_name,email&id=in.(…)` fires multiple times on **Operations desk** (often ~5× in dev).

**Root cause (summary):** Technician display names come from `enrichBookingsWithVendorTechnicianLabels()` in `packages/api/src/bookings/booking-api.ts` (loads `users` by technician `user_id`). Several admin pages/queries call enrichment independently; React Query keys differ so work is not shared. React StrictMode in dev can multiply visible requests.

### Partial fixes already in tree (keep; do not revert)

- [x] Shared session/profile: `apps/admin-web/src/hooks/use-admin-portal-session.ts` (one cached fetch for gates + top bar)
- [x] Narrow booking invalidation: `apps/admin-web/src/lib/invalidate-admin-queries.ts` (avoid `queryKeys.bookings.all()` storms)
- [x] Query defaults: `packages/web-ui/src/create-web-query-client.ts` — `staleTime: 60s`, `refetchOnWindowFocus: false`
- [x] Notification bell: longer poll + `staleTime` in `apps/admin-web/src/hooks/use-notification-center.ts`
- [x] Renewal reminders: only fetch active tab candidates (`SubscriptionRenewalsPage`)
- [x] Ops desk KPI split: `adminFetchOpsDeskSummaryLight` + `buildOpsDeskSummary` — summary no longer re-fetches monitor rows (`packages/api/src/operations/ops-desk-api.ts`, `OperationsDeskPage.tsx`)
- [x] In-memory user label cache + in-flight dedupe: `loadUserDisplayLabels()` in `booking-api.ts`

### TODO — tackle in a dedicated pass (still noisy in Network tab)

- [ ] **Operations desk:** confirm single `adminGetBookingMonitoringRows` per visit; audit remaining parallel queries (`exceptionsSample`, `vendors`, `summaryLight`, StrictMode)
- [ ] **Bookings page:** paged table + 800-row summary both call `enrichBookingsWithVendorTechnicianLabels` — share one query or derive KPIs from paged data (`BookingMonitoringPage.tsx`)
- [ ] **Promote label lookups to React Query** — stable keys e.g. `users.displayLabels(sortedIds)` with long `staleTime`; replace module-level `Map` cache in `booking-api.ts`
- [ ] **Move notification query keys** out from under `queryKeys.bookings.all()` prefix so booking mutations do not refetch inbox/unread (`packages/api/src/query-keys.ts`)
- [ ] **Audit invalidate + refetch pairs** — remove redundant `.refetch()` after `invalidateQueries` (Bookings, Renewals, Notification health, Ops intervention)
- [ ] **Unify `vendors.adminList("approved")` queryFn** — `FinanceSettlementsPage` vs other pages use different functions for same key (cache corruption risk)
- [ ] **Technician list keys** — `PartnerQualityPage` vs `TechnicianVerificationPage` duplicate `adminListVendorApprovedTechnicians` under different keys
- [ ] **Technician verification:** lazy-load job history (currently bulk fetch for all directory IDs)
- [ ] **Ops desk refresh:** verify `refreshDesk()` / `overdueScanMut` invalidation does not double-refetch
- [ ] **Dev vs prod:** document expected StrictMode double-fetch in dev; verify production build shows acceptable counts
- [ ] **Acceptance test:** open Operations desk → Network filter `users` → expect ≤1 `id=in.(…)` per technician user id per navigation (after full fix)

**Refs:** `packages/api/src/bookings/booking-api.ts` (`enrichBookingsWithVendorTechnicianLabels`, `loadUserDisplayLabels`), `packages/api/src/operations/ops-desk-api.ts`, `apps/admin-web/src/pages/OperationsDeskPage.tsx`, `apps/admin-web/src/pages/BookingMonitoringPage.tsx`, `apps/admin-web/src/lib/invalidate-admin-queries.ts`

---

## 2026-05-20 (Wednesday) — Android UAT builds

### 1. Android UAT builds for teammates ✓

- [ ] EAS secrets (per app, **uat** profile) — UAT Supabase URL + anon + `EXPO_PUBLIC_EAS_PROJECT_ID`
- [ ] Dummy auth secrets on UAT if QA needs them (`EXPO_PUBLIC_USE_DUMMY_AUTH`, etc.)
- [ ] Customer app:

  ```bash
  cd apps/customer-app
  npx eas-cli build --profile uat --platform android
  ```

- [ ] Partner app:

  ```bash
  cd apps/technician-app
  npx eas-cli build --profile uat --platform android
  ```

- [ ] Share internal distribution links with teammates
- [ ] Smoke test on real device: login, core flows, push (if enabled)
- [ ] Package IDs: `com.oorjaman.customer.uat` (UAT) vs `com.oorjaman.customer` (prod)

**Note:** Local APK path (`npm run android:apk:uat:customer` / `technician`) works for on-machine QA without EAS cloud.

**Refs:** [ENVIRONMENT.md](ENVIRONMENT.md), [DEPLOYMENT.md](DEPLOYMENT.md), [docs/android-local-apk.md](../docs/android-local-apk.md), `apps/*/eas.json`

---

## Template — next session

```markdown
## YYYY-MM-DD (Day) — Title

### 1. …

- [ ] …

**Refs:** …
```

---

## Completed (archive)

### 2026-05-20 — Documentation sync ✓

- [x] All repo `*.md` synced: root docs, `docs/`, `brand/`, app READMEs — Vercel UAT + dual Supabase + `.env.uat.local` seed path

**Refs:** all `*.md` at repo root and `docs/`

---

### 2026-05-20 — Deploy UAT admin apps on Vercel ✓

- [x] Push latest code to GitHub
- [x] Create 3 Vercel projects from this repo (same root, different build/output):
  - [x] `oorjaman-admin` → `npm run build:uat -w admin-web` → `apps/admin-web/dist`
  - [x] `oorjaman-vendor` → `npm run build:uat -w vendor-web` → `apps/vendor-web/dist`
  - [x] `oorjaman-support` → `npm run build:uat -w support-web` → `apps/support-web/dist`
- [x] Monorepo settings (each project): Root `.`, Install `npm install`, Node 20.x
- [x] Set env vars in Vercel Dashboard (Production + Preview) — **not in git**
  - [x] `VITE_DEPLOY_ENV=uat`
  - [x] `VITE_SUPABASE_URL` → UAT
  - [x] `VITE_SUPABASE_ANON_KEY` → UAT anon key
  - [x] `VITE_ADMIN_PORTAL_URL` / `VITE_VENDOR_PORTAL_URL` / `VITE_SUPPORT_PORTAL_URL` → Vercel URLs
  - [x] `VITE_USE_DUMMY_AUTH=true`, `VITE_DUMMY_OTP_CODE=123456`, `VITE_DUMMY_AUTH_PASSWORD=TestOtp123!`
- [x] Deploy all three; redeploy after `VITE_*` changes as needed
- [x] Supabase UAT → Authentication → URL Configuration → Vercel URLs + `https://*.vercel.app/**`
- [x] Verify: UAT Supabase in Network; login with seeded dummy users

**Live URLs:** https://oorjaman-admin.vercel.app · https://oorjaman-vendor.vercel.app · https://oorjaman-support.vercel.app

**Refs:** [VERCEL.md](VERCEL.md)

---

### 2026-05-20 — Notification icons (Android) ✓

- [x] `npm run brand:sync` (repo root)
- [x] Generated assets in both apps (`notification-icon.png`, `adaptive-icon.png`, `icon.png`)
- [x] Notification icon **white mono on transparent** (`npm run brand:verify-notification-icon`)
- [x] `npx expo prebuild --platform android` (both apps) after `brand:sync`
- [x] Native builds tested (customer + technician); icons correct on device/emulator
- [x] Push / notification shade icon verified

**Refs:** [brand/README.md](brand/README.md), `scripts/sync-brand-assets.mjs`

---

### 2026-05-20 — Brand collateral (structure & specs) ✓

- [x] `brand/print/` docs + gitignored CLI output dir (Admin Brand print is primary)
- [x] Print specs in `brand/README.md` + per-folder READMEs
- [x] Email signature via Admin Brand print tab (hosted logo URL)
- [x] Print collateral — Admin UI + shared `packages/utils/src/brand-print/`; optional `npm run brand:print`
