# Android Play production

Procedure for a new **Google Play** binary of **OorjaMan** (`apps/customer-app`) or **OorjaMan Partner** (`apps/technician-app`). Both apps are already on Play. This is the rebuild path, not a first-launch tracker.

Store version rules: `.cursor/rules/release-versioning.mdc` and `.cursor/rules/release-build-workflow.mdc`. PROD vs UAT bundle IDs and EAS profiles: [DEPLOYMENT.md](DEPLOYMENT.md).

---

## Apps

| | Customer | Partner |
| --- | --- | --- |
| Directory | `apps/customer-app` | `apps/technician-app` |
| Package | `com.oorjaman.customer` | `com.oorjaman.technician` |
| EAS project | `7677ff40-7214-431a-a372-3059f6e6c91d` | `a89deab7-9f4e-4411-a533-061002c8b049` |
| Play name | OorjaMan | OorjaMan Partner |
| Maps key | Required | Not used |
| Razorpay key id | `EXPO_PUBLIC_RAZORPAY_KEY_ID` (`rzp_live_…`) | Omit |
| Push outbox | `customer_push_outbox` | `technician_push_outbox` |

Use `npx eas-cli`, not `eas`. Org account: `oorjaman`.

```bash
npx eas-cli login
npx eas-cli whoami
cd apps/customer-app   # or technician-app
npx eas-cli project:info
```

`app.config.ts` is dynamic. `eas init` may say it cannot write the config; linking still succeeds when `extra.eas.projectId` is already set.

---

## Production environment

Cloud builds read the **production** environment on expo.dev, not `.env.production.local`.

Customer:

| Variable | Value |
| --- | --- |
| `EXPO_PUBLIC_DEPLOY_ENV` | `production` |
| `EXPO_PUBLIC_SUPABASE_URL` | `https://nppfpegqnmclbcmmogux.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | PROD anon only |
| `EXPO_PUBLIC_SITE_URL` | `https://oorjaman.com` |
| `EXPO_PUBLIC_EAS_PROJECT_ID` | Customer project id above |
| `EXPO_PUBLIC_RAZORPAY_KEY_ID` | Live key id only |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID` | Maps key restricted to `com.oorjaman.customer` + SHA-1 |

Partner: the same Supabase, site, and deploy-env variables, plus the Partner project id. No Razorpay or Maps keys. Do not set dummy-auth variables on production.

`runtimeVersion` follows `version` in `app.config.ts`. A native change (Maps key, new module, permission) needs a new EAS build. A JS-only fix for users already on that version is an OTA on channel `production`.

---

## Keystore, FCM, and Maps SHA-1

```bash
cd apps/customer-app   # repeat in technician-app
npx eas-cli credentials --platform android
```

Production profile. EAS manages the keystore. Record the **SHA-1**.

Customer PROD upload-keystore SHA-1:

```
29:29:5A:96:46:E4:94:F8:B0:07:B2:E8:69:C4:2D:3F:C1:63:F2:4A
```

Push uses **FCM V1**, not Legacy. In Firebase project **oorjaman**, add an Android app for the package and add the SHA-1. Enable **Firebase Cloud Messaging API**. Generate a service-account JSON (never commit it) and upload it under EAS credentials → **Google Service Account** → **Push Notifications (FCM V1)**.

The Play binary also needs `google-services.json` inside the app. Download it from the Firebase Android app (it may list both `com.oorjaman.customer` and `com.oorjaman.technician`). Store it as a **sensitive file** variable named `GOOGLE_SERVICES_JSON` on the EAS **production** environment for each app. `app.config.ts` points `android.googleServicesFile` at that variable for production only. Do not commit the file. Without it, Firebase does not start and the phone never saves a push token.

After the first Play upload, Play App Signing uses a **different** certificate. Copy **Setup → App signing → App signing key certificate** SHA-1 and add it to:

- the customer Maps Android key restriction
- the Firebase Android app (customer and Partner)

Store builds show blank maps when only the upload-keystore SHA-1 is registered.

Maps details: [DEPLOYMENT.md](DEPLOYMENT.md) §Google Maps. Directions is optional; without `EXPO_PUBLIC_GOOGLE_MAPS_DIRECTIONS_API_KEY`, tracking uses OSRM, then a straight line.

---

## Build and Play upload

From the repo root:

```bash
npm run eas:android:production:customer
npm run eas:android:production:technician
```

The production profile auto-increments Android `versionCode`. The artifact is an **AAB**. An EAS build does not upload itself.

Install on a device before a public release (internal track, or the EAS artifact). Smoke: email OTP against PROD (no dummy auth), a core booking or job, customer map tiles, a small Live Razorpay payment, and a support push with the app killed.

**Internal testing** (not public): Play Console → **Testing → Internal testing → Create new release** → upload the AAB → **Start rollout to Internal testing**. Testers update from the Play Store. The opt-in link stays the same. A higher `versionCode` is required.

**Production:** complete App content (privacy `https://oorjaman.com/legal/privacy-policy`, terms, account deletion, data safety, content rating). **Production → Create release** → submit. After it is live, set `NEXT_PUBLIC_PLAY_STORE_URL` on the marketing site and redeploy.

Listing screenshots live under `apps/<app>/store-listing/`. Do not keep masters in `dist/` (Expo export clears it). Website screenshots under `apps/oorjaman-web/public/marketing/screenshots/` are separate.

EAS submit, when a Play service account is configured:

```bash
cd apps/customer-app
npx eas-cli submit --profile production --platform android
```

---

## Push cron (PROD, already installed)

`alter database set app.*_push_function_url` fails on hosted Supabase (`42501`). The URL and dispatch secret live in `internal.push_dispatch`. An outbox insert calls the matching function immediately. `dispatch-due-expo-pushes` runs every 5 minutes and calls a function only when a row is still queued and due. Both push functions have JWT verification off; they check `x-push-dispatch-secret`.

```sql
select jobname, schedule, active from cron.job
where jobname in ('dispatch-due-expo-pushes', 'notify-overdue-vendor-responses');
```

Do not recreate the every-minute push jobs. Setup detail: [docs/customer-push-setup.md](../docs/customer-push-setup.md) and [docs/technician-push-setup.md](../docs/technician-push-setup.md).

---

## Troubleshooting

| Problem | What to check |
| --- | --- |
| `eas init` cannot edit config | `extra.eas.projectId` fallback in `app.config.ts` |
| Maps blank on a Play install | Play **app signing** SHA-1 missing from the Maps key |
| Push stays `queued` | Cron active, secret matches, FCM V1 uploaded for that package |
| EAS env ignored | Variable is on the **production** environment; rebuild |
| Build prompts for `expo-updates` | `updates.url` and `runtimeVersion.policy: "appVersion"` already in `app.config.ts` |

---

## Related

- [DEPLOYMENT.md](DEPLOYMENT.md) — PROD vs UAT apps, EAS profiles
- [RAZORPAY.md](RAZORPAY.md) — Live webhook and key id
- [ENVIRONMENT.md](ENVIRONMENT.md) — full env matrix
- [LAUNCH.md](LAUNCH.md) — store listing URLs on the marketing site
