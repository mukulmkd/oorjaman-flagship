# iOS QA distribution (UAT on physical devices)

Share **OorjaMan (UAT)** and **OorjaMan Partner (UAT)** with testers on real iPhones — the iOS equivalent of Android UAT APK sideloading.

**Related:** [android-local-apk.md](android-local-apk.md) (Android QA APKs), [DEPLOYMENT.md](../project-docs/DEPLOYMENT.md), [ENVIRONMENT.md](../project-docs/ENVIRONMENT.md)

---

## Android vs iOS (expectations)

| | **Android QA** | **iOS QA** |
|--|----------------|------------|
| Artifact | `.apk` file (email, Drive, Slack) | `.ipa` + Apple provisioning (no casual sideload) |
| Typical path | Local Gradle `android:apk:uat` | **EAS Build** `uat` profile (`distribution: internal`) |
| Install | Enable “unknown apps” → open APK | Open **install link** / QR from [expo.dev](https://expo.dev) or TestFlight |
| Tester device | Any Android phone | **Registered** iPhone UDID (ad hoc) or TestFlight invite |
| Apple account | Not required | **Apple Developer Program** ($99/yr) for real-device QA |

There is no exact “drop an IPA in Slack” equivalent without EAS or Xcode + ad hoc profiles. **EAS internal distribution** is the intended parity with Android UAT APKs.

---

## Prerequisites (one-time)

1. **Apple Developer Program** enrolled (team used for signing).
2. **EAS project linked** per app:

   ```bash
   cd apps/customer-app   # repeat for technician-app
   npx eas-cli init
   ```

   Set `EXPO_PUBLIC_EAS_PROJECT_ID` in `env/uat.local` (or let EAS write `extra.eas.projectId`).

3. **Signing** — first build prompts via `npx eas credentials`, or configure in the Expo dashboard.

4. **Tester devices** (ad hoc / internal installs):

   ```bash
   npx eas device:create
   ```

   Testers follow the link on their iPhone to register the UDID. Rebuild after adding devices so the provisioning profile includes them.

5. **UAT env** — same as Android ([android-local-apk.md § UAT env](android-local-apk.md#uat-env-embedded-at-build-time)):

   ```bash
   cp apps/customer-app/env/uat.local.example apps/customer-app/env/uat.local
   cp apps/technician-app/env/uat.local.example apps/technician-app/env/uat.local
   ```

---

## Path A — EAS cloud UAT build (recommended for QA)

Same `uat` profile as Android in `apps/*/eas.json`: `EXPO_PUBLIC_DEPLOY_ENV=uat`, `distribution: internal`, UAT bundle IDs (`com.oorjaman.customer.uat`, `com.oorjaman.technician.uat`).

### Customer

```bash
npm run ios:uat:customer
# or from apps/customer-app: npm run ios:uat
```

### Partner (technician)

```bash
npm run ios:uat:technician
# or from apps/technician-app: npm run ios:uat
```

### After the build

1. Open the build on [expo.dev](https://expo.dev) → your project → **Builds**.
2. Share the **Install** link or QR with testers (devices must be registered).
3. Testers install **OorjaMan (UAT)** / **OorjaMan Partner (UAT)** alongside prod if bundle IDs differ.

Runs `brand:sync`, loads `env/uat.local` via `run-with-expo-env.mjs`, then `eas build --profile uat --platform ios`.

---

## Path B — EAS local build (on your Mac)

Same UAT profile, compiled on your machine (needs Xcode, CocoaPods, signing). Useful when EAS cloud queue is slow or you need an IPA artifact locally.

```bash
npm run ios:uat:local:customer
npm run ios:uat:local:technician
```

IPA output path is printed when the build finishes (under the app’s build working directory).

---

## Path C — Simulator only (not for QA handoff)

For **your** machine only — not shareable to testers’ phones:

```bash
npm run ios:rebuild          # customer
npm run technician:ios:rebuild
# or: npx expo run:ios --device   (dev signing, often needs Metro for debug)
```

Use **Path A** when QA needs a standalone app on physical iPhones without a laptop attached.

---

## TestFlight (optional, larger QA groups)

For more than ad hoc device limits or easier onboarding:

1. Build with `distribution: store` (or add a dedicated profile in `eas.json`).
2. `npx eas submit --platform ios` to App Store Connect → **TestFlight** → Internal / External testers.

UAT bundle ID and Supabase UAT project still apply; this is an App Store Connect workflow, not a single APK-style file.

---

## Script reference

| Goal | Customer | Partner |
|------|----------|---------|
| **QA install (EAS cloud)** | `npm run ios:uat:customer` | `npm run ios:uat:technician` |
| **QA build on Mac (EAS local)** | `npm run ios:uat:local:customer` | `npm run ios:uat:local:technician` |
| **Dev simulator rebuild** | `npm run ios:rebuild` | `npm run technician:ios:rebuild` |

Aliases: `npm run eas:ios:uat:customer` = same as `ios:uat:customer`.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| “Unable to install” on tester phone | Register device: `npx eas device:create`, then **rebuild** |
| Wrong Supabase / env after install | Rebuild with updated `env/uat.local`; confirm `run-with-expo-env` ran |
| Signing / provisioning errors | `npx eas credentials` in the app dir; verify Apple team + bundle ID |
| `pod install` / native errors locally | `npm run ios:rebuild` in the app, then retry `ios:uat:local` |
| Expo Go limitations (push, etc.) | Use UAT EAS build, not Expo Go — same as Android dev build vs UAT APK |

---

## `eas.json` (already configured)

Both apps use:

```json
"uat": {
  "distribution": "internal",
  "channel": "uat",
  "env": { "EXPO_PUBLIC_DEPLOY_ENV": "uat" }
}
```

Android adds `"buildType": "apk"` under `uat.android`. iOS uses the default **device release** IPA suitable for internal distribution.
