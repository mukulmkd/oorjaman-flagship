# PROD mobile launch runbook (Android)

Step-by-step guide for taking **OorjaMan Customer** and **OorjaMan Partner (technician)** apps to **Google Play production**, using **PROD Supabase** and **EAS Build**.

This document captures what was done for the **customer app** (Aug 2026) so the same flow can be replicated for **technician**. It complements [`PROD_CHECKLIST.md`](PROD_CHECKLIST.md) (full platform checklist) and [`project-docs/DEPLOYMENT.md`](project-docs/DEPLOYMENT.md).

**Legend:** `[x]` done for customer · `[ ]` todo / replicate for technician

---

## 1. Architecture (PROD vs UAT)

| | **UAT** | **PROD** |
|---|---------|----------|
| Supabase project | OorjaMan UAT | OorjaMan PROD |
| Project ref | `caearbriteguqjvnbrcg` | `nppfpegqnmclbcmmogux` |
| Region | Singapore | Mumbai (`ap-south-1`) |
| URL | `https://caearbriteguqjvnbrcg.supabase.co` | `https://nppfpegqnmclbcmmogux.supabase.co` |
| Used by | Local dev, Vercel UAT portals, UAT APKs | Store builds, prod portals, prod data |

**Golden rule:** schema changes → new migration → `db:push` on **UAT first**, then **PROD**. Never edit applied migrations.

---

## 2. PROD Supabase backend (shared by both apps)

Both mobile apps talk to the **same PROD Supabase project**. Do this **once** (already done Aug 2026).

### 2.1 Migrations

```bash
# From repo root
npx supabase link --project-ref nppfpegqnmclbcmmogux
npm run db:push:yes
```

Verify UAT and PROD migration lists match:

```bash
npx supabase migration list   # on each project
npm run db:policy-diff        # should be 0 diff
```

- [x] Migrations synced (126 each)

### 2.2 Edge functions (deploy to PROD)

```bash
npx supabase link --project-ref nppfpegqnmclbcmmogux

npm run functions:deploy -- delete-customer-account
npm run functions:deploy -- approve-vendor-intake
npm run functions:deploy -- scan-vendor-response-overdue
npm run functions:deploy -- process-notification-events
npm run functions:deploy -- send-customer-expo-push
npm run functions:deploy -- send-technician-expo-push
npm run functions:deploy -- create-razorpay-order
npm run functions:deploy -- verify-razorpay-payment
npm run functions:deploy -- create-razorpay-refund
npm run functions:deploy -- razorpay-webhook --no-verify-jwt
```

- [x] All functions deployed on PROD

### 2.3 Edge function secrets (PROD dashboard → Edge Functions → Secrets)

| Secret | Purpose |
|--------|---------|
| `PUSH_DISPATCH_SECRET` | Auth for push edge functions (you generate: `openssl rand -base64 32`) |
| `RAZORPAY_KEY_ID` | Live `rzp_live_…` |
| `RAZORPAY_KEY_SECRET` | Live secret (never in app) |
| `RAZORPAY_WEBHOOK_SECRET` | From Razorpay **Live** webhook |
| `EXPO_ACCESS_TOKEN` | Optional — higher Expo push rate limits |
| `CORS_ALLOWED_ORIGINS` | Pin portal origins when ready |

CLI:

```bash
npx supabase secrets set PUSH_DISPATCH_SECRET="..."
npx supabase secrets set RAZORPAY_KEY_ID="rzp_live_..."
# etc.
```

- [x] Push + Razorpay secrets (verify webhook secret matches Live dashboard)

### 2.4 Push dispatch (cron — not `alter database set`)

On hosted Supabase, **`alter database set app.customer_push_function_url`** fails with `42501`. Use **Integrations → Cron** instead.

**One-time on PROD:**

1. **Integrations → Cron → Install integration** (enables `pg_cron`)
2. **Database → Extensions → enable `pg_net`**
3. Run in **SQL Editor** (replace `YOUR_PUSH_DISPATCH_SECRET`):

```sql
select cron.schedule(
  'send-customer-expo-push-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://nppfpegqnmclbcmmogux.supabase.co/functions/v1/send-customer-expo-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-dispatch-secret', 'YOUR_PUSH_DISPATCH_SECRET'
    ),
    body := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'send-technician-expo-push-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://nppfpegqnmclbcmmogux.supabase.co/functions/v1/send-technician-expo-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-dispatch-secret', 'YOUR_PUSH_DISPATCH_SECRET'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

Verify:

```sql
select jobid, jobname, schedule, active from cron.job
where jobname like 'send-%expo-push%';
```

- [x] Two cron jobs active on PROD

### 2.5 Razorpay Live webhook

Razorpay **Live** mode → Webhooks:

- URL: `https://nppfpegqnmclbcmmogux.supabase.co/functions/v1/razorpay-webhook`
- Events: `payment.authorized`, `payment.captured`, `payment.failed`, `order.paid`, `refund.*`
- Copy signing secret → PROD `RAZORPAY_WEBHOOK_SECRET`

- [ ] Confirm Live webhook smoke-tested after first prod payment

---

## 3. EAS / Expo account

Use **`eas-cli`**, not `eas`:

```bash
npx eas-cli login    # org account: oorjaman
npx eas-cli whoami
```

To switch accounts: `npx eas-cli logout` then `login`.

---

## 4. Per-app EAS project linking

Dynamic `app.config.ts` cannot be auto-edited by EAS. **Fallback `projectId` is hardcoded** in each app's config (env var still overrides at build time).

| App | EAS slug | Project ID | Android package (PROD) |
|-----|----------|------------|---------------------------|
| Customer | `@oorjaman/customer-app` | `7677ff40-7214-431a-a372-3059f6e6c91d` | `com.oorjaman.customer` |
| Technician | `@oorjaman/technician-app` | `a89deab7-9f4e-4411-a533-061002c8b049` | `com.oorjaman.technician` |

Init (expect “Cannot automatically write to dynamic config” — **link still succeeds** if `projectId` is in config):

```bash
cd apps/customer-app   # or technician-app
npx eas-cli init
```

Set in `apps/<app>/.env.production.local`:

```env
EXPO_PUBLIC_EAS_PROJECT_ID=<uuid-from-above>
```

Verify link:

```bash
npx eas-cli project:info
```

- [x] Customer linked
- [x] Technician linked

---

## 5. Android production keystore (per app)

```bash
cd apps/customer-app
npx eas-cli credentials --platform android
```

| Prompt | Choice |
|--------|--------|
| Build profile | **production** |
| Keystore | **Set up a new keystore** → **Generate new** / EAS manages |

Record **SHA-1** from the credentials screen.

**Customer PROD SHA-1 (EAS upload keystore):**

```
29:29:5A:96:46:E4:94:F8:B0:07:B2:E8:69:C4:2D:3F:C1:63:F2:4A
```

- [x] Customer keystore
- [ ] Technician keystore (repeat in `apps/technician-app`)

**After Play App Signing is enabled:** also add Play Console **App signing key certificate** SHA-1 to Google Maps / Firebase (see §7).

---

## 6. Firebase FCM V1 (Android push — per app)

Required for **kill-app** push. Supabase crons alone are not enough.

### 6.1 Firebase Console

1. [Firebase Console](https://console.firebase.google.com/) — project **oorjaman** (same GCP as Maps)
2. **Add Android app** with correct package:
   - Customer: `com.oorjaman.customer`
   - Technician: `com.oorjaman.technician`
3. Add **SHA-1** from EAS production keystore (§5)
4. Skip downloading `google-services.json` for Expo push (service account path)

### 6.2 GCP

Enable **Firebase Cloud Messaging API** on the same GCP project.

### 6.3 Service account JSON

Firebase → **Project settings → Service accounts → Generate new private key**

Keep JSON secret — **never commit to git**. Delete from `~/Downloads/` after upload.

### 6.4 Upload to EAS

```bash
cd apps/customer-app
npx eas-cli credentials --platform android
```

| Prompt | Choice |
|--------|--------|
| production | |
| **Google Service Account** | |
| **Set up for Push Notifications (FCM V1)** | Upload JSON |

Verify credentials screen shows:

```
Push Notifications (FCM V1): Google Service Account Key For FCM V1
  Project ID      oorjaman
  Client Email    firebase-adminsdk-...@oorjaman.iam.gserviceaccount.com
```

- [x] Customer FCM V1
- [ ] Technician FCM V1 (same Firebase project, **second** Android app entry)

**Do not use** “Push Notifications (Legacy)” — use **FCM V1** via Google Service Account.

---

## 7. Google Cloud Maps (customer app only)

Technician app does **not** need Maps keys for launch.

### 7.1 Enable APIs (GCP)

- Maps SDK for Android
- Maps Static API (site photo fallback)
- Directions API (optional — only if using dedicated Directions key)

### 7.2 Maps SDK key (Android PROD)

**Credentials → API key** with:

- **Application restriction:** Android app  
  - Package: `com.oorjaman.customer`  
  - SHA-1: EAS production keystore (§5)  
- **API restriction:** Maps SDK for Android, Maps Static API  

### 7.3 Directions key (optional)

`EXPO_PUBLIC_GOOGLE_MAPS_DIRECTIONS_API_KEY` is **not required**. Without it, live tracking uses **OSRM** road routes, then straight line.

**Android-only Play launch:** skip iOS Maps key.

- [x] Customer Android Maps key + SHA-1 in GCP
- [ ] Add Play **app signing** SHA-1 after first Play upload (if maps blank on store builds)

---

## 8. EAS Production environment variables

**Cloud builds use expo.dev env, not local `.env.production.local`.**

**expo.dev** → project → **Environment variables** → **production**

### Customer app — required for Android PROD

| Variable | Example / notes |
|----------|-----------------|
| `EXPO_PUBLIC_DEPLOY_ENV` | `production` (also in `eas.json` profile) |
| `EXPO_PUBLIC_SUPABASE_URL` | `https://nppfpegqnmclbcmmogux.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | PROD anon only — never service_role |
| `EXPO_PUBLIC_SITE_URL` | `https://oorjaman.com` |
| `EXPO_PUBLIC_EAS_PROJECT_ID` | `7677ff40-7214-431a-a372-3059f6e6c91d` |
| `EXPO_PUBLIC_RAZORPAY_KEY_ID` | `rzp_live_…` (public key id only) |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID` | PROD-restricted Maps key |

**Not needed for Android-only launch:**

- `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS`
- `EXPO_PUBLIC_GOOGLE_MAPS_DIRECTIONS_API_KEY`
- `EXPO_PUBLIC_USE_DUMMY_AUTH` / dummy OTP vars

### Technician app — required for Android PROD

| Variable | Notes |
|----------|--------|
| `EXPO_PUBLIC_DEPLOY_ENV` | `production` |
| `EXPO_PUBLIC_SUPABASE_URL` | PROD URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | PROD anon |
| `EXPO_PUBLIC_SITE_URL` | `https://oorjaman.com` |
| `EXPO_PUBLIC_EAS_PROJECT_ID` | `a89deab7-9f4e-4411-a533-061002c8b049` |

No Razorpay or Maps keys on technician.

**Fix technician local file:** `apps/technician-app/.env.production.local` was still pointing at UAT — update to PROD values above and remove dummy auth vars.

CLI example:

```bash
cd apps/customer-app
eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL --value "https://nppfpegqnmclbcmmogux.supabase.co"
```

- [x] Customer EAS production env (verified during build — vars loaded)
- [ ] Technician EAS production env

---

## 9. `expo-updates` (EAS Update / OTA channels)

Production profile in `eas.json` sets `"channel": "production"`, which requires `expo-updates` and config in `app.config.ts`.

During first customer build, `expo-updates` was installed. Config was added manually:

```ts
const easProjectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim() || "<fallback-uuid>";

// in ExpoConfig:
updates: {
  url: `https://u.expo.dev/${easProjectId}`,
},
runtimeVersion: {
  policy: "appVersion",
},
```

**Before technician production build:** replicate in `apps/technician-app/app.config.ts` and add `expo-updates` to `technician-app/package.json` (or run build and add config when prompted — always answer config manually).

If prompted again during build: **do not** re-install if already present.

Native changes (Maps key, Razorpay native module, permissions) still require **new EAS build**, not OTA alone.

---

## 10. Production Android build

```bash
# Run from the repository root:
npm run eas:android:production:customer

# Technician app:
npm run eas:android:production:technician
```

Monitor: [expo.dev](https://expo.dev) → **Builds**.

Expected log lines:

- Production environment vars loaded from EAS
- `EXPO_PUBLIC_DEPLOY_ENV=production` from profile
- Android `versionCode` automatically increments for every production build (`"autoIncrement": true` in `eas.json`)

The production build commands set `EAS_BUILD_NO_EXPO_GO_WARNING=true`, suppressing
the informational Expo Go development warning before EAS starts.

Output: **AAB** (Play Store) — download from EAS when finished.

- [ ] Customer production build succeeded
- [ ] Technician production build

---

## 11. After EAS build succeeds — complete checklist

### 11.1 Download and install (mandatory before Play)

1. expo.dev → **Builds** → open finished build → **Download**
2. Install on a **physical Android device**:
   - Internal testing link from Play (after upload), or
   - Sideload APK if EAS produced APK, or
   - `bundletool` / Play internal track with AAB

### 11.2 Smoke test on device (customer)

- [ ] **Email OTP login** — prod Supabase, no dummy auth
- [ ] **Onboarding / book visit** — core flow
- [ ] **Google map tiles** on live tracking (not blank)
- [ ] **Razorpay Live** — small real payment, booking confirms
- [ ] **Support chat push** — allow notifications → login → support sends message → **kill app** → notification within ~1 min

SQL checks (PROD):

```sql
select count(*) from customer_push_tokens;  -- >= 1 after login
select status, count(*) from customer_push_outbox group by status;  -- sent, not stuck queued
```

### 11.3 Google Play Console — create app

[Google Play Console](https://play.google.com/console)

- App name: **OorjaMan**
- Package: `com.oorjaman.customer` (must match build)
- [ ] Org/developer account verified

### 11.4 Store listing assets (**you provide — Expo does not**)

| Asset | Requirement |
|-------|-------------|
| **Phone screenshots** | Minimum 2 (recommend 4–8). Ready set: `apps/customer-app/store-listing/play-upload/` (+ Desktop backup `~/Desktop/OorjaMan-Play-Store-Listing/`). **Never** keep masters under `dist/` (Expo export wipes it). |
| **Short description** | ≤ 80 chars |
| **Full description** | Feature summary |
| **App icon** | 512×512 (Play); build also embeds icon |
| **Feature graphic** | 1024×500 (recommended) |
| **Contact email** | e.g. `support@oorjaman.com` |

Suggested screenshot screens: home, book visit, live tracking, bookings/history, support.

Marketing placeholders: `apps/oorjaman-web/public/marketing/screenshots/` (website — separate from Play uploads).

**Phone-only targeting (ready in code; next native build):** `withAndroidPhoneOnlyScreens` + `ios.supportsTablet: false` on customer + technician. Until that AAB is uploaded, Play may still ask for tablet listing assets — reuse phone screenshots for submit. After the phone-only AAB ships, tablet/Chromebook asset pressure usually drops.

### 11.5 Policy and compliance forms

Complete all **App content** / **Policy** sections:

- [ ] Privacy policy URL: `https://oorjaman.com/legal/privacy-policy`
- [ ] Terms: `https://oorjaman.com/legal/terms-of-service`
- [ ] Account deletion: `https://oorjaman.com/legal/account-deletion`
- [ ] Data safety form (declare location, camera, photos, etc.)
- [ ] Content rating questionnaire
- [ ] Target audience / ads declaration
- [ ] News app / COVID declarations if prompted

### 11.6 Upload AAB to Play

**Option A — EAS Submit**

```bash
cd apps/customer-app
npx eas-cli submit --platform android
```

Select the production build. May require Play Console **service account** (same or separate JSON as FCM — configure under EAS **Submissions** if automating).

**Option B — Manual**

Play Console → **Release** → **Testing** → **Internal testing** → **Create new release** → upload AAB from EAS.

**Recommended track order:**

```
Internal testing  →  Closed testing (optional)  →  Production
```

| Track | Google review? | Use |
|-------|----------------|-----|
| Internal testing | Usually fast, limited testers | First QA |
| Closed / Open testing | Light review | Wider beta |
| **Production** | **Full review** (often 1–7+ days) | Public launch |

Internal testing does **not** replace production review for public release.

#### Internal-testing build and update workflow

In Play Console, a **release** is simply a build assigned to a track. Creating an
**Internal testing release does not publish the app publicly**.

For the first internal test and every subsequent internal-testing update:

1. Generate a new production AAB:

   ```bash
   # Run from the repository root:
   npm run eas:android:production:customer
   ```

2. Wait for EAS to finish, then download the `.aab` from the build link.
3. Open the existing app in Play Console.
4. Go to **Testing → Internal testing → Create new release**.
5. Upload the new `.aab`.
6. Add release notes, then select **Review release**.
7. Select **Start rollout to Internal testing**.
8. Existing testers open the Play Store and select **Update**. Automatic updates
   may install it later when enabled.

Important behavior:

- Starting an EAS build alone does **not** upload or activate it in Play Console.
- The new internal release becomes the active testing version after rollout.
- The previous artifact remains in Play Console history.
- The tester list and opt-in link remain unchanged.
- Installed app data and login sessions normally remain intact.
- A higher `versionCode` is mandatory; the production EAS profiles auto-increment it.

### 11.7 After Play App Signing activates

Play Console → **Setup → App signing** → copy **App signing key certificate** SHA-1.

Add to:

- Google Maps Android key restriction (customer)
- Firebase Android app SHA-1 (customer + technician)

Without this, **store-installed** builds may show blank maps even if sideload works.

### 11.8 Production release and approval

1. Complete all Play Console required tasks (dashboard shows blockers)
2. **Production** → **Create release** → attach AAB → **Submit for review**
3. Wait for Google approval email / Play Console status
4. Choose rollout: staged % or 100%
5. After live: set `NEXT_PUBLIC_PLAY_STORE_URL` on marketing site → redeploy `oorjaman.com`

### 11.9 Post-launch monitoring

- [ ] Supabase logs / `customer_push_outbox` / payment webhooks
- [ ] Razorpay Live dashboard
- [ ] Play Console vitals (crashes, ANRs)
- [ ] GCP Maps API quotas / billing alerts

---

## 12. Replicate for technician app

Do **§4–§6, §8, §9, §10, §11** for `apps/technician-app` with these differences:

| Step | Customer | Technician |
|------|----------|------------|
| EAS project | `7677ff40-…` | `a89deab7-…` |
| Package | `com.oorjaman.customer` | `com.oorjaman.technician` |
| Display name | OorjaMan | OorjaMan Partner |
| Firebase Android app | `com.oorjaman.customer` | `com.oorjaman.technician` |
| Maps keys | Required | **Not required** |
| Razorpay env | `EXPO_PUBLIC_RAZORPAY_KEY_ID` | **Omit** |
| Push outbox table | `customer_push_outbox` | `technician_push_outbox` |
| Play listing | Separate app | Separate app + screenshots |

Shared (already done once on PROD Supabase):

- Migrations, edge functions, push crons, `PUSH_DISPATCH_SECRET`

Technician checklist:

- [ ] Fix `apps/technician-app/.env.production.local` (PROD Supabase, no dummy auth)
- [ ] Add `expo-updates` + `updates` / `runtimeVersion` in `app.config.ts`
- [ ] `npx eas-cli credentials --platform android` → production keystore → note SHA-1
- [ ] Firebase: add `com.oorjaman.technician` + SHA-1
- [ ] EAS FCM V1 for technician
- [ ] EAS production env vars
- [ ] `npx eas-cli build --profile production --platform android`
- [ ] Smoke test: login, job list, safety checklist, support push (kill app)
- [ ] Play Console second app + listing + submit

---

## 13. Platform items outside mobile (still needed for full PROD)

Not covered by EAS build alone:

| Area | Task |
|------|------|
| **Portals** | Vercel prod: `admin` / `vendor` / `support.oorjaman.com` + prod `VITE_*` |
| **Marketing** | `oorjaman.com` live, real company details, legal pages |
| **Auth** | Prod staff Auth users; Email OTP; Auth redirect URLs |
| **Razorpay** | Live webhook smoke on PROD |
| **Do not** | Run `seed:dummy-users` on PROD |

See [`PROD_CHECKLIST.md`](PROD_CHECKLIST.md) for the full platform gate.

---

## 14. Quick command reference

```bash
# EAS
npx eas-cli login
npx eas-cli project:info
npx eas-cli credentials --platform android
npx eas-cli build --profile production --platform android
npx eas-cli submit --platform android

# Supabase PROD
npx supabase link --project-ref nppfpegqnmclbcmmogux
npm run db:push:yes
npm run functions:deploy -- send-customer-expo-push
npx supabase secrets set PUSH_DISPATCH_SECRET="..."
```

---

## 15. Troubleshooting

| Problem | Fix |
|---------|-----|
| `npx eas init` / credentials fails on dynamic config | Ensure `extra.eas.projectId` fallback in `app.config.ts` |
| `alter database set app.*` permission denied | Use Cron + `pg_net` SQL (§2.4) |
| Maps blank on Android prod | Wrong/missing SHA-1 on Maps key; add Play signing SHA-1 |
| Push stuck `queued` in outbox | Cron jobs + `PUSH_DISPATCH_SECRET` match; FCM V1 uploaded |
| Build asks for expo-updates | Add §9 config to `app.config.ts` |
| EAS env not applied | Set on expo.dev **production** environment, rebuild |

---

## Related docs

- [`PROD_CHECKLIST.md`](PROD_CHECKLIST.md) — full platform launch tracker
- [`project-docs/DEPLOYMENT.md`](project-docs/DEPLOYMENT.md) — 8-host + mobile matrix
- [`project-docs/SUPABASE-UAT-PROD.md`](project-docs/SUPABASE-UAT-PROD.md) — migrations
- [`project-docs/ENVIRONMENT.md`](project-docs/ENVIRONMENT.md) — all env vars
- [`project-docs/RAZORPAY.md`](project-docs/RAZORPAY.md) — payments
- [`docs/customer-push-setup.md`](docs/customer-push-setup.md) · [`docs/technician-push-setup.md`](docs/technician-push-setup.md)

---

*Last updated: 2026-08-26 — reflects customer Android PROD path through first EAS production build.*
