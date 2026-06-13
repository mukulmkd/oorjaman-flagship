# OorjaMan — dated TODO

Pick up the **latest open date** section when you resume work. Check boxes as you go.

---

## 2026-05-20 (Wednesday) — UAT deploy, Android, brand collateral

### 1. Deploy UAT admin apps on Vercel

- [ ] Push latest code to GitHub
- [ ] Create 3 Vercel projects from this repo (same root, different build/output):
  - [ ] `oorjaman-admin` → `npm run build -w admin-web` → `apps/admin-web/dist`
  - [ ] `oorjaman-vendor` → `npm run build -w vendor-web` → `apps/vendor-web/dist`
  - [ ] `oorjaman-support` → `npm run build -w support-web` → `apps/support-web/dist`
- [ ] Monorepo settings (each project): Root `.`, Install `npm install`, Node 20.x
- [ ] Set env vars in Vercel Dashboard (Production + Preview) — **not in git**
  - [ ] `VITE_DEPLOY_ENV=uat`
  - [ ] `VITE_SUPABASE_URL` → UAT (`caearbriteguqjvnbrcg.supabase.co`)
  - [ ] `VITE_SUPABASE_ANON_KEY` → UAT anon key
  - [ ] `VITE_ADMIN_PORTAL_URL` / `VITE_VENDOR_PORTAL_URL` / `VITE_SUPPORT_PORTAL_URL` → real Vercel URLs
  - [ ] `VITE_USE_DUMMY_AUTH=true`, `VITE_DUMMY_OTP_CODE=123456`, `VITE_DUMMY_AUTH_PASSWORD=TestOtp123!`
  - [ ] Optional: Vercel **Shared Environment Variables** across all 3 projects
- [ ] Deploy all three → **Redeploy** after any `VITE_*` change
- [ ] Supabase UAT → Authentication → URL Configuration → add Vercel URLs + `https://*.vercel.app/**`
- [ ] Verify: DevTools Network → UAT Supabase URL; login with seeded dummy users

**Refs:** [VERCEL.md](VERCEL.md), `apps/*/.env.development.example`

---

### 2. Notification icons — Android + simulator

- [x] `npm run brand:sync` (repo root)
- [x] Confirm generated assets exist:
  - [x] `apps/customer-app/assets/images/notification-icon.png`
  - [x] `apps/technician-app/assets/images/notification-icon.png`
  - [x] `adaptive-icon.png` + `icon.png` in both apps
- [x] Confirm notification icon is **white mono on transparent** (Android status bar)
  - Auto-generated `brand/source/notification-icon.png` from O silhouette; verify: `npm run brand:verify-notification-icon`
- [x] `npx expo prebuild --platform android` (both apps) after `brand:sync` — refreshes `res/drawable-*/notification_icon.png`
- [x] Customer native build: `npx expo run:android` (first build succeeded; APK had stale icons until prebuild)
- [ ] Re-install on emulator after prebuild (emulator was **low on disk** — wipe AVD or free space first)
- [ ] Test on **Android emulator** with native/dev build (not Expo Go for full push):
  - [ ] `cd apps/customer-app && npx expo run:android`
  - [ ] `cd apps/technician-app && npx expo run:android`
- [ ] Trigger notification (support chat / push) → check status bar + shade icon
- [ ] Fix masters in `brand/source/notification-icon.png` + re-sync + prebuild + rebuild if needed

**Refs:** [brand/README.md](brand/README.md), `scripts/sync-brand-assets.mjs`

---

### 3. Android UAT builds for teammates

- [ ] EAS secrets (per app, **uat** profile) — UAT Supabase URL + anon + `EXPO_PUBLIC_EAS_PROJECT_ID`
- [ ] Dummy auth secrets on UAT if QA needs them (`EXPO_PUBLIC_USE_DUMMY_AUTH`, etc.)
- [ ] Customer app:

  ```bash
  cd apps/customer-app
  eas build --profile uat --platform android
  ```

- [ ] Partner app:

  ```bash
  cd apps/technician-app
  eas build --profile uat --platform android
  ```

- [ ] Share internal distribution links with teammates
- [ ] Smoke test on real device: login, core flows, push (if enabled)
- [ ] Package IDs: `com.oorjaman.customer.uat` (UAT) vs `com.oorjaman.customer` (prod)

**Refs:** [ENVIRONMENT.md](ENVIRONMENT.md), [DEPLOYMENT.md](DEPLOYMENT.md), `apps/*/eas.json`

---

### 4. Brand collateral — letterheads, business cards, etc.

- [ ] Create folder structure:

  ```text
  brand/
    source/          ← digital masters (already exists)
    print/           ← NEW
      letterhead/
      business-card/
      email-signature/
  ```

- [ ] Drop designer exports into `brand/print/` (PDF/AI/SVG); keep `brand/source/logo-lockup-tagline.png` as master for print
- [ ] Document specs in `brand/README.md` (sizes, bleed, fonts)
- [ ] Do **not** put print files under individual apps — apps use `npm run brand:sync` only

---

## Template — next session

```markdown
## YYYY-MM-DD (Day) — Title

### 1. …

- [ ] …

**Refs:** …
```

---

## Completed

_Move finished date sections here._
