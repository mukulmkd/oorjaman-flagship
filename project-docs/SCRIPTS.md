# npm scripts reference

Catalog of **root** and **mobile app** `package.json` scripts: what each does, when to use it, and what is redundant.

**Related:** [RUNNING-APPS.md](RUNNING-APPS.md) (run modes & env files) · [docs/android-local-apk.md](../docs/android-local-apk.md) (APK troubleshooting) · [docs/ios-qa-distribution.md](../docs/ios-qa-distribution.md) (iOS QA)

---

## Conventions

| Location | Role |
|----------|------|
| **Repo root** (`package.json`) | Shortcuts for day-to-day work. Customer is the default for unprefixed `android` / `ios`. Partner uses `technician:*` prefix. |
| **`apps/customer-app`** / **`apps/technician-app`** | Canonical definitions for native rebuild flows. Root mobile scripts delegate here with `npm run … -w <workspace>`. |
| **`scripts/`** (repo root) | Shared Node/bash helpers invoked by root or app scripts (`run-with-expo-env.mjs`, `sync-brand-assets.mjs`, etc.). |

**Dev env:** `expo run:*` and `*:rebuild` use `apps/<app>/.env.development.local`.

**UAT APK / EAS:** `android:apk:*` and `eas:android:uat:*` load `apps/<app>/env/uat.local` via `scripts/run-with-expo-env.mjs`. **iOS QA:** `ios:uat:*` / `eas:ios:uat:*` — see [docs/ios-qa-distribution.md](../docs/ios-qa-distribution.md).

**Native folders:** `apps/*/ios/` and `apps/*/android/` are generated (gitignored). Regenerate with `*:rebuild` or `prebuild:android` / `ios:rebuild`, not by hand-editing.

---

## Mobile app scripts

Defined in `apps/customer-app/package.json` and `apps/technician-app/package.json` (same names; implementation is per-app).

| Script | Purpose |
|--------|---------|
| `start` / `start:clear` | Metro dev server (use `start:clear` to bust cache — do not use `npm run start -- --clear`) |
| `android` | Incremental debug build + install + Metro (`expo run:android`) |
| `ios` | Incremental debug build + install + Metro (`expo run:ios`) |
| `prebuild:android` | `brand:sync` → `expo prebuild --platform android --clean` → `local.properties` + autolinking cache clear |
| `android:rebuild` | Full clean Android dev rebuild (see flow below) |
| `ios:rebuild` | Full clean iOS dev rebuild (see flow below) |
| `android:apk:debug` | UAT env → prebuild → Gradle `assembleDebug` (JS **not** embedded; needs Metro) |
| `android:apk:uat` | UAT env → prebuild → Gradle `assembleRelease` → dated APK in `dist/` |
| `ios:uat` | UAT env → EAS cloud iOS build (`distribution: internal`) — share install link with QA |
| `ios:uat:local` | Same UAT profile, EAS `--local` on your Mac |
| `brand:sync` | Copy `brand/source/` into app assets (same script as root; syncs **all** apps) |
| `expo:types` | Regenerate Expo Router typed routes |
| `typecheck` / `lint` | `expo:types` + `tsc --noEmit` |

### `android:rebuild` flow

`scripts/rebuild-android.sh`:

1. Stop Metro (customer: `:8081`; partner: `:8081` + `:8082`)
2. Clear `.expo`, Metro caches, `android/build`
3. Optional `adb reverse tcp:8081` + uninstall old package on USB device
4. `prebuild:android` — `brand:sync` (this app only) → `expo prebuild --platform android --clean --no-install` (does **not** touch `ios/`)
5. `EXPO_NO_METRO_CACHE=1 expo run:android --no-install` (Android build only)

Physical device: `npm run android:rebuild -- --device`

### `ios:rebuild` flow

`scripts/rebuild-ios.sh`:

1. Stop Metro
2. Clear caches, uninstall from booted simulator
3. `brand:sync`
4. `expo prebuild --platform ios --clean`
5. `scripts/pod-install.sh` (Hermes from source)
6. `EXPO_NO_METRO_CACHE=1 expo run:ios`

### `run:android` / `ios` vs `*:rebuild`

| | `npm run android` / `ios` | `npm run android:rebuild` / `ios:rebuild` |
|---|---------------------------|-------------------------------------------|
| Brand sync | No | Yes |
| Regenerates native project | No | Yes (`prebuild --clean`) |
| Use when | Day-to-day JS / compile on existing `android/` or `ios/` | SDK upgrade, plugin change, stale native cache, brand asset change |

---

## Root scripts — daily development

| Script | Purpose |
|--------|---------|
| `customer` / `customer:clear` | Customer Metro |
| `technician` / `technician:clear` | Partner Metro |
| `admin` / `vendor` / `support` / `web` | Portal / marketing dev servers |
| `android` | Customer `expo run:android` |
| `ios` | Customer `expo run:ios` |
| `android:rebuild` | Customer full Android rebuild |
| `ios:rebuild` | Customer full iOS rebuild |
| `technician:android` | Partner `expo run:android` |
| `technician:android:rebuild` | Partner full Android rebuild |
| `technician:ios` | Partner `expo run:ios` |
| `technician:ios:rebuild` | Partner full iOS rebuild |
| `expo:types` | Router types for **both** mobile apps |
| `typecheck` | Typecheck all workspaces |
| `lint` | Lint all workspaces (where configured) |
| `validate` | `typecheck` + `knip` |

---

## Root scripts — mobile distribution

| Script | Purpose |
|--------|---------|
| `android:apk:uat:customer` / `:technician` | UAT release APK (embedded JS; share with QA) — **primary Android offline distribution** |
| `android:apk:debug:customer` / `:technician` | Debug APK via Gradle (needs Metro; niche) |
| `eas:android:uat:customer` / `:technician` | EAS cloud UAT Android build |
| `eas:android:uat:local:customer` / `:technician` | EAS UAT build on your machine (`--local`) |
| `eas:android:uat` | Both apps EAS UAT cloud (convenience) |
| `ios:uat:customer` / `:technician` | EAS cloud UAT iOS build — **primary iOS QA distribution** (install link) |
| `ios:uat:local:customer` / `:technician` | EAS UAT iOS build on your Mac (`--local`) |
| `eas:ios:uat:customer` / `:technician` | Same as `ios:uat:*` (alias) |
| `eas:ios:uat:local:customer` / `:technician` | Same as `ios:uat:local:*` (alias) |
| `eas:ios:uat` | Both apps EAS UAT iOS cloud (convenience) |

Root `android:apk:*` scripts are thin wrappers → `npm run android:apk:* -w <app>`. Root `ios:uat:*` → `npm run ios:uat -w <app>`.

---

## Root scripts — web builds

| Script | Purpose |
|--------|---------|
| `build` | Production build: admin + vendor + support + marketing |
| `build:web` | Marketing site only |
| `web:godaddy` | Marketing static export for GoDaddy hosting |

---

## Root scripts — database & Supabase

| Script | Purpose |
|--------|---------|
| `db:push` | Apply migrations to **linked** project (interactive) |
| `db:push:yes` | Same, non-interactive (`supabase db push --yes`) |
| `db:push:include-all` | Push with `--include-all` (migration history edge cases) |
| `db:status` | `supabase status` |
| `supabase` | Passthrough to Supabase CLI |
| `db:reference` | Regenerate `supabase/schema.sql` + `policies.sql` reference |
| `functions:deploy` | Deploy edge function(s) |
| `typecheck:edge-functions` | Typecheck `supabase/functions/` |
| `seed:dummy-users` | Seed UAT dummy users (root `.env.uat.local`) |

---

## Root scripts — maintenance & data repair

| Script | Purpose |
|--------|---------|
| `purge:test-data` | Remove test user data (see script header for flags) |
| `cleanup:orphan-checkouts` | Clean orphan checkout bookings |
| `repair:public-users` | Repair auth ↔ `public.users` sync |
| `db:repair-cli` | Supabase CLI repair helper |

---

## Root scripts — brand & docs

| Script | Purpose |
|--------|---------|
| `brand:sync` | Sync `brand/source/` → all apps (mobile + web assets) |
| `brand:print` | Generate print collateral under `brand/print/` |
| `brand:verify-notification-icon` | Validate notification icon (white mono on transparent) |
| `docs:functional-test` | Regenerate functional test Word doc |
| `docs:uat-guide` | Regenerate E2E UAT Word guide |

---

## Root scripts — code quality

| Script | Purpose |
|--------|---------|
| `knip` | Find unused exports, deps, files (`--no-config-hints` skips Expo `main` noise) |
| `knip:fix` | Auto-fix where knip supports it |

---

## Root scripts — Android utilities

| Script | Purpose |
|--------|---------|
| `android:local-props` | Write `android/local.properties` (`sdk.dir`) for apps with `android/` |
| `android:clear-autolinking` | Clear stale Gradle autolinking cache (`npm run android:clear-autolinking -- customer-app`) |

Also run automatically inside `prebuild-android.sh`. Use standalone when troubleshooting SDK path or `BuildConfig` / package name mismatches.

---

## Redundant or low-value scripts

| Script | Verdict | Notes |
|--------|---------|-------|
| **`brand:sync:mobile`** | **Redundant** | Root `brand:sync` already syncs both mobile apps (and web). This runs the same script up to three times. Prefer `npm run brand:sync` only. |
| `android:apk:debug:*` (root) | **Low traffic** | Niche Metro-attach workflow. `android:rebuild` covers normal dev. Keep for docs compatibility or call `npm run android:apk:debug` inside the app dir. |
| `eas:android:uat` | **Optional convenience** | Builds both apps sequentially; fine to keep. |
| `android:local-props` / `android:clear-autolinking` | **Not redundant** | Duplicated logic with `prebuild-android.sh`, but needed for manual fixes without a full prebuild. |

Everything else in root `package.json` serves a distinct workflow.

---

## Quick pick (mobile)

| Goal | Customer (root) | Partner (root) | In app dir |
|------|-----------------|----------------|------------|
| Metro | `npm run customer` | `npm run technician` | `npm run start` |
| Incremental native + Metro | `npm run android` / `ios` | `npm run technician:android` / `technician:ios` | `npm run android` / `ios` |
| Clean native rebuild | `npm run android:rebuild` / `ios:rebuild` | `npm run technician:android:rebuild` / `technician:ios:rebuild` | `npm run android:rebuild` / `ios:rebuild` |
| UAT APK (share) | `npm run android:apk:uat:customer` | `npm run android:apk:uat:technician` | `npm run android:apk:uat` |
| UAT EAS (Android) | `npm run eas:android:uat:customer` | `npm run eas:android:uat:technician` | `eas build --profile uat --platform android` |
| UAT iOS (QA devices) | `npm run ios:uat:customer` | `npm run ios:uat:technician` | `npm run ios:uat` |

After **brand**, **Expo SDK**, or **native plugin** changes → use a **rebuild** path (`*:rebuild` or `android:apk:uat:*` / `ios:uat:*`), not Metro alone.

---

## Shell scripts (mobile apps)

Shared under `packages/mobile-config/scripts/` (see [packages/mobile-config/README.md](../packages/mobile-config/README.md)):

| File | Used by |
|------|---------|
| `rebuild-android.sh` | `android:rebuild` |
| `prebuild-android.sh` | `prebuild:android`, `android:apk:*` (via UAT env) |
| `rebuild-ios.sh` | `ios:rebuild` |
| `pod-install.sh` | `rebuild-ios.sh` |

Per-app bundle IDs and Metro ports: `packages/mobile-config/profiles/<app>.json`.

---

## Suggested cleanup (optional)

1. Remove `brand:sync:mobile` from root `package.json` and use `npm run brand:sync` everywhere.
2. Optionally drop root `android:apk:debug:*` aliases and document app-level `npm run android:apk:debug` only.

No other root scripts are strong removal candidates without losing a documented workflow.
