# Android APKs — local build (no EAS cloud)

Build installable APKs on your Mac for teammate QA, without uploading to Expo build servers.

**Related:** [DEPLOYMENT.md](../DEPLOYMENT.md) (EAS cloud), [ENVIRONMENT.md](../ENVIRONMENT.md), [TODO.md](../TODO.md)

---

## Choose a path

| Method | Expo cloud? | Best for |
|--------|-------------|----------|
| **`npx expo run:android`** (debug/release) | No | Day-to-day local builds on your machine |
| **`./gradlew assembleRelease`** after prebuild | No | Repeat builds without re-running Expo CLI |
| **`npx eas-cli build --local`** | No (runs on your Mac) | Same `eas.json` UAT profile as cloud, local Gradle |

All need **Android Studio** (SDK + platform tools) and **JDK 17**.

---

## One-time machine setup

1. Install [Android Studio](https://developer.android.com/studio).
2. SDK Manager → install **Android SDK Platform 35** (or version Expo 54 expects) + **Build-Tools**.
3. Shell (add to `~/.bash_profile` or `~/.zshrc`):

   ```bash
   export ANDROID_HOME=$HOME/Library/Android/sdk
   export PATH=$PATH:$ANDROID_HOME/platform-tools
   ```

4. Verify:

   ```bash
   adb version
   java -version   # 17.x
   ```

---

## UAT env (embedded at build time)

`EXPO_PUBLIC_*` values are baked into the JS bundle when Gradle runs.

**Expo mobile apps use `env/uat.local`** for UAT APK / EAS builds (not `.env.uat.local` in the app root — that filename breaks Metro dev). Repo scripts use [`scripts/run-with-expo-env.mjs`](../scripts/run-with-expo-env.mjs).

Per app:

```bash
cp apps/customer-app/env/uat.local.example apps/customer-app/env/uat.local
cp apps/technician-app/env/uat.local.example apps/technician-app/env/uat.local
# Edit with your UAT Supabase URL, anon key, and Vercel portal URLs
```

Minimum in each `apps/<app>/env/uat.local`:

```env
EXPO_PUBLIC_DEPLOY_ENV=uat
EXPO_PUBLIC_SUPABASE_URL=https://<UAT_REF>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<uat_anon>
EXPO_PUBLIC_SITE_URL=https://<your-admin-vercel-url>
EXPO_PUBLIC_USE_DUMMY_AUTH=true
EXPO_PUBLIC_DUMMY_OTP_CODE=123456
EXPO_PUBLIC_DUMMY_AUTH_PASSWORD=TestOtp123!
```

| File | Used by |
|------|---------|
| `apps/<app>/.env.development.local` | **Local Metro** (`npm run customer`, iOS Simulator) |
| `apps/<app>/env/uat.local` | **UAT APK / EAS** (via `run-with-expo-env.mjs`) |
| `apps/<app>/.env.production.local` | **Production** native builds (or auto-synced from `env/uat.local` for UAT APK scripts) |

**Repo root** `.env.uat.local` is only for scripts (`npm run seed:dummy-users`) — not for mobile builds.

**Important:** UAT APK scripts sync `apps/<app>/env/uat.local` → `.env.production.local` before Gradle runs. Release bundles read `.env.production.local` (because `NODE_ENV=production`). If you only edited `env/uat.local` but had placeholder values in `.env.production.local`, login will fail until you rebuild with the sync in place.

**Metro / localhost dev** uses `apps/<app>/.env.development.local` only. Do not keep `apps/<app>/.env.uat.local` in the app root.

---

## Path A — UAT APK for physical devices (recommended)

**Use this** when sharing an APK with teammates or installing on a phone without a dev machine attached.

Release builds **embed the JS bundle** (Hermes). Debug APKs (`android:apk:debug:*`) do **not** — they expect Metro on `localhost:8081` and show *Unable to load script* on a standalone device.

Signed with the debug keystore (fine for internal UAT). Slightly smaller than debug.

### Customer

```bash
npm run android:apk:uat:customer
```

**APK location:**

```text
apps/customer-app/android/app/build/outputs/apk/release/app-release.apk
```

### Technician (Partner)

```bash
npm run android:apk:uat:technician
```

**APK location:**

```text
apps/technician-app/android/app/build/outputs/apk/release/app-release.apk
```

### Share

- AirDrop / Drive / Slack the `.apk` file.
- On phone: enable **Install unknown apps** for the browser/files app.
- UAT package IDs install **alongside** any prod build.

Or install via USB:

```bash
adb install -r apps/customer-app/android/app/build/outputs/apk/release/app-release.apk
```

---

## Path B — Debug APK (Metro / USB dev only)

**Not for sharing.** Debug APKs skip bundling JS; the app loads from Metro (`npx expo start` + USB or same Wi‑Fi). Useful only when iterating with a cable and `adb reverse tcp:8081 tcp:8081`.

### Customer

```bash
npm run android:apk:debug:customer
```

**APK location:**

```text
apps/customer-app/android/app/build/outputs/apk/debug/app-debug.apk
```

### Technician (Partner)

```bash
npm run android:apk:debug:technician
```

**APK location:**

```text
apps/technician-app/android/app/build/outputs/apk/debug/app-debug.apk
```

### Manual equivalent (debug)

```bash
npm run android:prebuild:customer
npm run android:local-props
node scripts/run-with-expo-env.mjs customer-app "cd android && ./gradlew assembleDebug"
```

---

## Path C — Release APK (manual Gradle)

Same output as Path A. From repo root after prebuild + `android:local-props`:

```bash
node scripts/run-with-expo-env.mjs customer-app "cd android && ./gradlew assembleRelease"
```

**APK location:**

```text
apps/customer-app/android/app/build/outputs/apk/release/app-release.apk
```

Release is signed with the debug keystore in generated `build.gradle` (internal QA only). For store builds, use EAS or configure your own `signingConfigs`.

---

## Path D — EAS config, local machine (`--local`)

Uses `eas.json` `uat` profile (APK, `EXPO_PUBLIC_DEPLOY_ENV=uat`) but **does not** use Expo servers:

```bash
cd apps/customer-app
node ../../scripts/run-with-expo-env.mjs customer-app "npx eas-cli build --profile uat --platform android --local"
```

Or from repo root: `npm run eas:android:uat:local:customer`

Requires `npx eas-cli login`. Loads env from `apps/customer-app/env/uat.local`.

---

## npm shortcuts (repo root)

```bash
# UAT APK — embed JS bundle; install on any phone (recommended)
npm run android:apk:uat:customer
npm run android:apk:uat:technician

# Debug APK — Metro dev only (not for sharing)
npm run android:apk:debug:customer
npm run android:apk:debug:technician
```

APK paths are in **Path A** (release) and **Path B** (debug).

---

## Before sharing with teammates

1. `npm run seed:dummy-users` against **UAT** (root `.env.uat.local`).
2. Confirm app hits UAT Supabase (login with `9000000401` / OTP `123456` for customer).
3. App label: **OorjaMan (UAT)** / **OorjaMan Partner (UAT)** when `EXPO_PUBLIC_DEPLOY_ENV=uat`.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| No `android/` folder | `npx expo prebuild --platform android` in the app dir |
| SDK not found | `npm run android:local-props` or set `ANDROID_HOME` |
| Stale icons | `npm run brand:sync` → `npx expo prebuild --platform android` → rebuild |
| `expo run:android` wants emulator | That command installs on a device — use `npm run android:apk:uat:*` for sharing APKs |
| **Unable to load script** / Metro on device | You installed a **debug** APK (`app-debug.apk`). Rebuild with `npm run android:apk:uat:customer` and install `app-release.apk` |
| Supabase env missing after install | Rebuild with `npm run android:apk:uat:customer` (uses `app-release.apk`). Env is baked in at bundle time from `env/uat.local` via `.env.production.local` |
| Emulator low disk | Not needed for APK builds; only if you use `expo run:android` for dev |
| `BuildConfig` / `com.oorjaman.customer` compile error | Stale `app.json` `android.package` conflicted with UAT `app.config.ts` — fixed; run `npm run android:apk:debug:customer` (prebuild uses `--clean`) |
| `BuildConfig` / `com.oorjamanpartneruat` (technician) | Stale Gradle autolinking cache — `npm run android:clear-autolinking -- technician-app` then rebuild (APK scripts clear this automatically) |

---

## `android/` is gitignored

Native projects are generated per machine via `prebuild`. Do not commit `apps/*/android/` — regenerate after plugin or SDK changes.
