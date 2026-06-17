# customer-app — OorjaMan (Customer)

Expo Router mobile app (iOS/Android) for homeowners and businesses: book visits, AMC, track technicians, support chat, site photos.

## Run locally

Full matrix (debug, UAT, prod, Expo Go, Android & iOS): [**RUNNING-APPS.md**](../../project-docs/RUNNING-APPS.md).

```bash
cp apps/customer-app/.env.development.example apps/customer-app/.env.development.local
# UAT Supabase; EXPO_PUBLIC_DEPLOY_ENV=local; optional dummy auth

npm run customer    # from repo root — Metro
# Physical device + terminal logs:
# cd apps/customer-app && adb reverse tcp:8081 tcp:8081 && npx expo run:android --device
```

Legal links use `EXPO_PUBLIC_SITE_URL` (localhost or `https://dev-oorjaman.oorjaman.com` / production marketing).

## UAT builds

| Method | Command |
| ------ | ------- |
| EAS cloud | `npm run eas:android:uat:customer` or `cd apps/customer-app && eas build --profile uat` |
| Local APK (no EAS cloud) | `npm run android:apk:uat:customer` |

UAT env file: `apps/customer-app/env/uat.local` (see [docs/android-local-apk.md](../../docs/android-local-apk.md)).

Package ID (UAT): `com.oorjaman.customer.uat` · display name **OorjaMan (UAT)**.

## Production (store)

`eas build --profile production` with Prod Supabase, no dummy auth, restricted Maps key — [DEPLOYMENT.md](../../project-docs/DEPLOYMENT.md).

## Docs

- [ENVIRONMENT.md](../../project-docs/ENVIRONMENT.md) — `EXPO_PUBLIC_*`
- [docs/customer-push-setup.md](../../docs/customer-push-setup.md) — support chat push
- [BILLING.md](../../project-docs/BILLING.md) — Google Maps, EAS, store fees
