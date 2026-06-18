# Running apps — all modes (local, debug, UAT, production, Expo Go)

Guide for **customer-app** (OorjaMan) and **technician-app** (OorjaMan Partner) on **Android** and **iOS**, plus a short reference for web apps.

**Related:** [ENVIRONMENT.md](ENVIRONMENT.md) (env vars) · [DEPLOYMENT.md](DEPLOYMENT.md) (PROD vs UAT matrix) · [docs/android-local-apk.md](../docs/android-local-apk.md) (Android APK troubleshooting)

---

## Modes at a glance

| Mode | What you get | Env source | JS bundle | Native modules | Typical use |
|------|----------------|------------|-----------|----------------|-------------|
| **Local + Metro** | `npm run customer` / `npm run technician` | `.env.development.local` | Loaded from Metro on your Mac | Only if using a **dev build** (not Expo Go) | Fast JS iteration |
| **Expo Go** | Scan QR from `expo start` | `.env.development.local` | Metro | **Limited** — many native modules missing | Quick UI smoke test only |
| **Debug native + Metro** | `expo run:android` / `expo run:ios` | `.env.development.local` | Metro (`localhost:8081`) | **Full** (camera, maps, push-capable, etc.) | **Recommended local dev** on device/simulator |
| **Debug APK (Android)** | `npm run android:apk:debug:*` | `env/uat.local` via build script* | **Not embedded** — needs Metro | Full | Install once, attach Metro via USB |
| **UAT APK (Android)** | `npm run android:apk:uat:*` | `env/uat.local` → `.env.production.local` | **Embedded** in APK | Full | Share with QA **without** your laptop |
| **UAT EAS** | `eas build --profile uat` | EAS secrets + `env/uat.local` | Embedded | Full | Cloud or `--local` CI-like builds |
| **Production EAS** | `eas build --profile production` | EAS production secrets | Embedded | Full | App Store / Play Store |

\* Debug APK Gradle scripts use `run-with-expo-env.mjs`, which loads `apps/<app>/env/uat.local` for native prebuild. For **Metro dev**, use `.env.development.local` only.

**Rule of thumb:** If you need **terminal logs** on a **physical device** with **real native code**, use **debug native + Metro** (`expo run:android --device`), not a UAT release APK.

---

## Environment files (mobile)

| File | Used when | `EXPO_PUBLIC_DEPLOY_ENV` | Supabase |
|------|-----------|--------------------------|----------|
| `apps/<app>/.env.development.local` | `npm run customer`, `expo start`, `expo run:*` | `local` | **OorjaMan UAT** |
| `apps/<app>/env/uat.local` | UAT APK scripts, EAS UAT builds (`run-with-expo-env.mjs`) | `uat` | **OorjaMan UAT** |
| `apps/<app>/.env.production.local` | Rare local prod smoke; synced before UAT APK Gradle | `production` | **OorjaMan Prod** |
| EAS secrets (Expo dashboard) | `eas build --profile uat` / `production` | per profile | UAT or Prod |

**Setup (first time):**

```bash
cp apps/customer-app/.env.development.example apps/customer-app/.env.development.local
cp apps/technician-app/.env.development.example apps/technician-app/.env.development.local
# Edit: UAT Supabase URL + anon key, dummy auth, optional EXPO_PUBLIC_EAS_PROJECT_ID

cp apps/customer-app/env/uat.local.example apps/customer-app/env/uat.local
cp apps/technician-app/env/uat.local.example apps/technician-app/env/uat.local
# Edit: same UAT keys for APK / EAS builds
```

**Do not** keep `apps/<app>/.env.uat.local` in the app root — it can break Metro. Use `env/uat.local` for builds ([ENVIRONMENT.md](ENVIRONMENT.md)).

---

## Bundle IDs & display names

Controlled by `EXPO_PUBLIC_DEPLOY_ENV` in `app.config.ts`:

| App | Local / Prod (`local` or `production`) | UAT (`uat`) |
|-----|----------------------------------------|-------------|
| Customer iOS | `com.oorjaman.customer` · **OorjaMan** | `com.oorjaman.customer.uat` · **OorjaMan (UAT)** |
| Customer Android | `com.oorjaman.customer` | `com.oorjaman.customer.uat` |
| Partner iOS | `com.oorjaman.technician` · **OorjaMan Partner** | `com.oorjaman.technician.uat` · **OorjaMan Partner (UAT)** |
| Partner Android | `com.oorjaman.technician` | `com.oorjaman.technician.uat` |

UAT and prod/local builds can be installed **side by side** on one phone.

---

## Native builds & brand sync

`apps/customer-app/ios/`, `apps/customer-app/android/`, and the same under `technician-app/` are **generated** by Expo prebuild. They are **gitignored** — not committed. Source of truth: `app.config.ts`, `plugins/`, and assets under `apps/<app>/assets/` (populated from `brand/source/`).

### When `brand:sync` runs automatically

`brand:sync` copies masters from `brand/source/` into each app’s `assets/images/` (icons, splash, notification icon, etc.). See [brand/README.md](../brand/README.md).

| Command | `brand:sync` first? | Then |
|---------|---------------------|------|
| `npm run ios:rebuild` (in app dir) | **Yes** | `expo prebuild --platform ios --clean` → pods → `expo run:ios` |
| `npm run android:rebuild` (in app dir) | **Yes** | `expo prebuild --platform android --clean` → `expo run:android` |
| `npm run android:apk:uat:*` | **Yes** (via `prebuild-android.sh`) | Gradle `assembleRelease` + dated APK in `dist/` |
| `npm run android:apk:debug:*` | **Yes** (via `prebuild-android.sh`) | Gradle `assembleDebug` |
| `npm run eas:android:uat:*` | **Yes** | EAS cloud or `--local` build |
| `npm run ios` / `npx expo run:ios` | **No** | Compiles existing `ios/` as-is |
| `npx expo prebuild` (manual) | **No** | Run `npm run brand:sync` in the app dir first if assets changed |
| `npx eas-cli build --profile uat --platform ios` | **No** | Run `npm run brand:sync` in the app dir before EAS if icons/splash changed |

**Rule of thumb:** After changing **`brand/source/`**, an **Expo SDK upgrade**, or **native plugins** in `app.config.ts`, use a **rebuild path** (`ios:rebuild`, `android:rebuild`, or `android:apk:uat:*`) — not plain `expo run:ios` / `expo run:android` / Metro only.

### iOS: `run:ios` vs `ios:rebuild`

| | `npm run ios` / `npx expo run:ios` | `npm run ios:rebuild` |
|---|-----------------------------------|------------------------|
| **Brand sync** | Skipped | Runs first |
| **Regenerates `ios/`** | No | Yes (`prebuild --clean`) |
| **Use when** | Day-to-day JS/native compile on existing project | Stale pods, SDK upgrade, brand asset change, first machine setup |

From repo root:

```bash
npm run ios                    # customer — debug build, no brand sync
npm run ios:rebuild            # customer — full clean rebuild
npm run technician:ios         # partner
npm run technician:ios:rebuild # partner — full clean rebuild
```

`rebuild-ios.sh` (customer + partner) order: stop Metro → clear caches → uninstall old simulator app → **`brand:sync`** → **`prebuild --clean`** → `pod install` → `expo run:ios`.

### Android: `run:android` vs `android:rebuild`

| | `npm run android` / `npx expo run:android` | `npm run android:rebuild` |
|---|-------------------------------------------|----------------------------|
| **Brand sync** | Skipped | Runs first |
| **Regenerates `android/`** | No | Yes (`prebuild --clean`) |
| **Use when** | Day-to-day JS/native compile on existing project | Stale Gradle cache, SDK upgrade, brand asset change, first machine setup |

From repo root:

```bash
npm run android                    # customer — debug build, no brand sync
npm run android:rebuild            # customer — full clean rebuild
npm run technician:android         # partner
npm run technician:android:rebuild # partner — full clean rebuild
```

`rebuild-android.sh` (customer + partner) order: stop Metro → clear caches → optional `adb reverse` + uninstall → **`brand:sync`** → **`prebuild --clean`** → `local.properties` + autolinking cache clear → `expo run:android`.

### Android: no manual folder delete for UAT

UAT and prebuild scripts already run **`expo prebuild --platform android --clean`**, which deletes and recreates `android/`. You do **not** need `rm -rf android/` before:

```bash
npm run android:apk:uat:customer
npm run android:apk:uat:technician
```

**EAS Android (cloud):** `android/` is not in git → EAS runs a fresh prebuild on the server.

**EAS Android (`--local`):** If a stale local `android/` exists, run `npm run android:rebuild` or `npm run android:apk:uat:*` first (includes `brand:sync` + `prebuild --clean`).

**SDK note:** After upgrading Expo (e.g. SDK 54 → 56), regenerate native projects. Symptom on iOS: `pod install` fails with *Unable to find a specification for ExpoModulesCore*. Fix: `npm run ios:rebuild` or `npx expo prebuild --platform ios --clean` (after `brand:sync`).

### Metro cache clear

```bash
npm run customer:clear      # customer Metro — NOT `npm run customer -- --clear` (npm does not forward to Expo)
npm run technician:clear    # partner Metro (often port 8082 if customer uses 8081)
```

---

## Android — customer app

### A. Debug native + Metro + device logs (recommended)

**One-time:** Android Studio SDK, `adb` on PATH:

```bash
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

Enable **USB debugging** on the phone; `adb devices` must show `device`.

```bash
cd apps/customer-app
adb reverse tcp:8081 tcp:8081    # USB: forward Metro to phone
npx expo run:android --device    # builds debug app, installs, starts Metro
```

- `console.log` / JS errors → **this terminal**
- Native crashes → `adb logcat *:S ReactNative:V ReactNativeJS:V AndroidRuntime:E`
- Rebuild native after adding native modules (e.g. `expo-image-manipulator`): run the command again

**Simulator/emulator:** `npx expo run:android` (no `--device`).

### A2. Full clean rebuild (emulator or device)

```bash
cd apps/customer-app
npm run android:rebuild
# or from repo root: npm run android:rebuild
# physical device: npm run android:rebuild -- --device
```

Runs `scripts/rebuild-android.sh`: stop Metro → clear caches → optional `adb reverse` / uninstall → **`brand:sync`** → **`prebuild --clean`** → `expo run:android`.

### B. Metro only (`npm run customer`)

```bash
npm run customer   # from repo root
```

- Opens Expo dev tools
- **Expo Go:** scan QR — **not sufficient** for camera, full maps, push, etc.
- **Dev build:** open the app installed by `expo run:android` while Metro is running

### C. Debug APK + separate Metro

Build & install (does **not** embed JS):

```bash
npm run android:apk:debug:customer
adb install -r apps/customer-app/android/app/build/outputs/apk/debug/app-debug.apk
```

Terminal 1: `npm run customer`  
Terminal 2: `adb reverse tcp:8081 tcp:8081`

Open **OorjaMan** on the phone. Without Metro → *Unable to load script*.

### D. UAT release APK (standalone — no Metro)

For teammates / QA without your laptop:

```bash
npm run android:apk:uat:customer
```

**Output:** `apps/customer-app/android/app/build/outputs/apk/release/app-release.apk`

Install: AirDrop / `adb install -r …/app-release.apk`. Env is **baked in** from `env/uat.local`.

### E. UAT / production via EAS

```bash
# Cloud
npm run eas:android:uat:customer

# Local Gradle on your Mac (no Expo cloud)
npm run eas:android:uat:local:customer

# Production (store) — from app dir, after EAS secrets configured
cd apps/customer-app
npx eas-cli build --profile production --platform android
```

Install link from [expo.dev](https://expo.dev) dashboard.

---

## Android — partner (technician) app

Replace `customer` with `technician` in all commands:

| Goal | Command |
|------|---------|
| Debug + Metro + device | `cd apps/technician-app && npx expo run:android --device` |
| Clean rebuild | `npm run technician:android:rebuild` (root) or `npm run android:rebuild` (in app) |
| Metro | `npm run technician` |
| Debug APK | `npm run android:apk:debug:technician` |
| UAT APK | `npm run android:apk:uat:technician` |
| EAS UAT cloud | `npm run eas:android:uat:technician` |
| EAS UAT local | `npm run eas:android:uat:local:technician` |

APK paths mirror customer under `apps/technician-app/android/app/build/outputs/apk/`.

---

## iOS — customer app

**Requires:** Xcode, CocoaPods (`brew install cocoapods`).

### A. Debug native + Metro (simulator)

```bash
cd apps/customer-app
npx expo run:ios
```

### B. Debug native + Metro (physical device)

Connect iPhone, select it in Xcode or:

```bash
cd apps/customer-app
npx expo run:ios --device
```

Phone and Mac on same Wi‑Fi if not using USB network debugging. Sign the app with your Apple Development team in Xcode on first install.

### C. Full clean rebuild (simulator)

```bash
cd apps/customer-app
npm run ios:rebuild
# or from repo root: npm run ios:rebuild
```

Runs `scripts/rebuild-ios.sh`: stop Metro → clear caches → **`npm run brand:sync`** → **`expo prebuild --platform ios --clean`** → CocoaPods → `expo run:ios`.

### D. Metro only

```bash
npm run customer
```

Same Expo Go vs dev-build limitations as Android.

### E. UAT / production via EAS

```bash
cd apps/customer-app
npx eas-cli build --profile uat --platform ios          # internal / TestFlight
npx eas-cli build --profile production --platform ios   # App Store
```

Configure signing: `npx eas credentials`. UAT uses `com.oorjaman.customer.uat`.

There is **no** root `npm run ios:apk:*` shortcut — iOS distribution is via EAS or Xcode archive.

---

## iOS — partner (technician) app

| Goal | Command |
|------|---------|
| Simulator | `cd apps/technician-app && npx expo run:ios` or `npm run technician:ios` |
| Device | `npx expo run:ios --device` |
| Clean rebuild | `npm run ios:rebuild` (in app) or `npm run technician:ios:rebuild` (root) |
| Metro | `npm run technician` or `npm run technician:clear` |
| UAT / prod | `cd apps/technician-app && npx eas-cli build --profile uat --platform ios` |

---

## EAS build profiles (both apps)

Defined in `apps/<app>/eas.json`:

| Profile | `EXPO_PUBLIC_DEPLOY_ENV` | Distribution | Notes |
|---------|--------------------------|--------------|-------|
| `development` | `local` | internal | Dev client (`developmentClient: true`) |
| `uat` | `uat` | internal | Android APK; UAT bundle IDs |
| `production` | `production` | store | App Store / Play |

```bash
cd apps/customer-app   # or technician-app
npx eas-cli init                    # once — links project, sets EXPO_PUBLIC_EAS_PROJECT_ID
npx eas-cli build --profile development --platform all
npx eas-cli build --profile uat --platform all
npx eas-cli build --profile production --platform all
```

Set secrets in Expo dashboard or `eas env:create` ([DEPLOYMENT.md](DEPLOYMENT.md#eas-secrets-per-app-per-environment)).

---

## Expo Go vs development build

| Feature | Expo Go | Debug / UAT / prod native build |
|---------|---------|----------------------------------|
| Camera, image manipulator, full maps | Unreliable or missing | Yes |
| Remote push (`EXPO_PUBLIC_EAS_PROJECT_ID`) | No | Yes (physical device) |
| Same bundle ID as store | No | Yes (per tier) |
| Metro fast refresh | Yes | Yes (debug builds only) |

**Use Expo Go** only for quick layout/navigation checks. **Use `expo run:*` or EAS builds** for real device testing.

---

## Web apps (short reference)

| App | Local dev | UAT build smoke | Production build |
|-----|-----------|-----------------|------------------|
| Admin | `npm run admin` → :5173 | `npm run build:uat -w admin-web` | `npm run build -w admin-web` |
| Vendor | `npm run vendor` → :5174 | `npm run build:uat -w vendor-web` | `npm run build -w vendor-web` |
| Support | `npm run support` → :5175 | `npm run build:uat -w support-web` | `npm run build -w support-web` |
| Marketing | `npm run web` → :3000 | — | `npm run build:web` |

Env: `.env.development.local` (local), `.env.uat.local` (local UAT build), `.env.production.local` (prod). **Live UAT portals** on Vercel use dashboard env — [VERCEL.md](VERCEL.md).

---

## Repo root npm shortcuts

| Script | App / purpose |
|--------|----------------|
| `npm run customer` | Customer Metro |
| `npm run customer:clear` | Customer Metro with cache cleared |
| `npm run technician` | Partner Metro |
| `npm run technician:clear` | Partner Metro with cache cleared |
| `npm run ios` | Customer `expo run:ios` (no brand sync) |
| `npm run ios:rebuild` | Customer full iOS rebuild (**brand:sync** → prebuild → run) |
| `npm run android` | Customer `expo run:android` (no brand sync) |
| `npm run android:rebuild` | Customer full Android rebuild (**brand:sync** → prebuild → run) |
| `npm run technician:ios` | Partner `expo run:ios` |
| `npm run technician:ios:rebuild` | Partner full iOS rebuild |
| `npm run technician:android` | Partner `expo run:android` |
| `npm run technician:android:rebuild` | Partner full Android rebuild |
| `npm run android:apk:debug:customer` | Customer debug APK (**brand:sync** → prebuild → Gradle) |
| `npm run android:apk:debug:technician` | Partner debug APK |
| `npm run android:apk:uat:customer` | Customer UAT release APK |
| `npm run android:apk:uat:technician` | Partner UAT release APK |
| `npm run eas:android:uat:customer` | Customer UAT EAS cloud (**brand:sync** first) |
| `npm run eas:android:uat:technician` | Partner UAT EAS cloud |
| `npm run eas:android:uat:local:customer` | Customer UAT EAS on your Mac |
| `npm run eas:android:uat:local:technician` | Partner UAT EAS on your Mac |
| `npm run android:local-props` | Write `local.properties` (SDK path) |
| `npm run brand:sync:mobile` | Sync brand assets to both mobile apps |
| `npm run expo:types` | Regenerate Expo Router types (both mobile apps) |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `adb: command not found` | SDK not on PATH | `export PATH=$PATH:$ANDROID_HOME/platform-tools` |
| `adb devices` empty | USB debugging off / cable | Enable dev options; use data cable |
| **Unable to load script** on phone | Debug APK without Metro | Start `npm run customer` + `adb reverse tcp:8081 tcp:8081`, or install **UAT release** APK |
| UAT APK login fails | Stale `.env.production.local` | Rebuild with `npm run android:apk:uat:*` (syncs from `env/uat.local`) |
| Warning: missing `EXPO_PUBLIC_EAS_PROJECT_ID` | Dev push not configured | Add to `.env.development.local` or ignore for non-push work |
| Camera works on device but not simulator | No camera in simulator | Use physical device or gallery |
| Site photo stamp shows **blue box** on the left | No map image loaded (often missing `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` on Android, or photo taken before fix) | Add key + rebuild for Google tiles; or take a **new** photo (OSM fallback works without key). See [Site photos](#customer-app--site-photos-camera-gps-stamp-upload) |
| Camera upload **network error** (UAT APK) | Old APK without compress/retry fixes; or no mobile data | Rebuild UAT APK; retry on Wi‑Fi. Debug working ≠ UAT updated until you rebuild |
| Camera upload works in debug but not UAT | UAT binary is stale | `npm run android:apk:uat:customer` after pulling latest |
| Native change not picked up | Metro reload only | `npm run android:rebuild` or `npx expo run:android --device` |
| `android/` missing | Not prebuilt yet | `npm run android:rebuild` or `npx expo run:android` |
| Stale launcher / splash icons | Built without `brand:sync` | `npm run brand:sync` in app → `ios:rebuild` or `android:rebuild` |
| `pod install` — `ExpoModulesCore` not found | `ios/` from old Expo SDK | `npm run ios:rebuild` or `prebuild --platform ios --clean` after `brand:sync` |
| Terminal `r` reload stuck (Expo Go) | Known Expo Go + SDK 56 limitation | Use **Fast Refresh** (save file), simulator **Reload** menu, or a **dev build** (`expo run:ios`) |
| `npm run customer -- --clear` ignores `--clear` | npm does not forward flag to Expo | Use `npm run customer:clear` |

More Android APK detail: [docs/android-local-apk.md](../docs/android-local-apk.md).

---

## Customer app — site photos (camera, GPS stamp, upload)

Profile → **Site location & photos** → **Add site photo** captures (or picks) an image, attaches GPS, stamps a **map thumbnail + address block** on the footer, uploads to Supabase Storage (`customer-site-photos` bucket), and saves metadata on the customer’s service address.

### Map stamp (left side of the footer)

| Setup | What you see on new photos |
| ----- | -------------------------- |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` set **and** native app rebuilt | Google map tiles (native `MapView` snapshot, or Maps Static API fallback) |
| Key **not** set (typical local debug) | OpenStreetMap imagery via HTTP fallback (real map, not Google branding) |
| Key missing on **Android** without OSM reachability | Blue placeholder box — **re-take** the photo after fixing network or adding a key |

**Important:** The map is **burned into the JPEG** at capture time. Photos already saved keep whatever stamp they had; fixing maps only affects **new** captures.

**Env + rebuild:** The Maps key is read from `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` in `app.config.ts` and baked into **native** iOS/Android config at build time. Metro reload is **not** enough. Full checklist: [DEPLOYMENT.md — Google Maps](DEPLOYMENT.md#google-maps-customer-app--configure-before-store-release) and [BILLING.md — Google Maps](BILLING.md#google-maps-platform--in-app-maps--site-photo-stamps).

| Context | Where to set the key |
| ------- | -------------------- |
| Debug on device (`expo run:android` / `expo run:ios`) | `apps/customer-app/.env.development.local` |
| UAT APK / EAS UAT | `apps/customer-app/env/uat.local` (local APK) or EAS env for `preview` / `uat` profile |
| Store PROD | EAS `production` env |

### Camera upload — debug vs UAT

The **same JavaScript upload path** runs in debug and UAT. If camera + upload works in debug on a physical device, it **should work in UAT** after you install a **new UAT build** that includes the latest `customer-app` code.

| | Debug native + Metro | UAT release APK |
| --- | --- | --- |
| **Command** | `npx expo run:android --device` (+ `npm run customer`) | `npm run android:apk:uat:customer` |
| **Env file** | `.env.development.local` | `env/uat.local` (synced at APK build) |
| **JS/TS fixes** | Hot reload via Metro | **New APK required** — no Metro |
| **Native modules** (`expo-image-manipulator`, camera, maps) | `expo run:android` links them | Same — **rebuild APK** after `package.json` / native changes |
| **Network** | Device → Supabase (+ optional Metro on USB) | Device → Supabase only |
| **Supabase** | Usually UAT project from dev env | UAT project from `env/uat.local` |

**UAT checklist (camera upload):**

1. Pull latest code and run `npm install` at repo root.
2. Rebuild: `npm run android:apk:uat:customer` (or EAS UAT profile).
3. Confirm `apps/customer-app/env/uat.local` has UAT `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
4. Confirm UAT Supabase has the `customer-site-photos` storage migration applied (`npm run db:push` against UAT).
5. (Optional) Add `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` to `env/uat.local` for **Google** map stamps, then rebuild.

Opening GPS coordinates in the browser (`https://www.google.com/maps?q=…`) does **not** need a Maps API key.

---

## Choose your path (decision tree)

```
Need terminal logs on physical Android?
  └─ Yes → expo run:android --device + adb reverse
  └─ No, share APK with QA offline
        └─ UAT env → npm run android:apk:uat:customer
        └─ Store → eas build --profile production

Just changing JS/TS?
  └─ Debug build open → npm run customer (Metro)
  └─ UAT release APK installed → need new APK build (JS embedded)

Quick UI check only?
  └─ Expo Go (limited) OR iOS Simulator with expo run:ios

Changed brand assets or upgraded Expo SDK?
  └─ iOS → npm run ios:rebuild (or technician:ios:rebuild)
  └─ Android dev → npm run android:rebuild (or technician:android:rebuild)
  └─ Android UAT APK → npm run android:apk:uat:* (prebuild --clean is automatic)

iOS TestFlight / App Store?
  └─ eas build --profile uat|production --platform ios
```
