# technician-app — OorjaMan Partner (Field)

Expo Router mobile app for field partners: assigned jobs, visit workflow, OTP/happy codes, live location, support chat.

## Run locally

```bash
cp apps/technician-app/.env.development.example apps/technician-app/.env.development.local

npm run technician    # from repo root
```

## UAT builds

| Method | Command |
| ------ | ------- |
| EAS cloud | `npm run eas:android:uat:technician` |
| Local APK | `npm run android:apk:uat:technician` |

UAT env: `apps/technician-app/env/uat.local` — [docs/android-local-apk.md](../../docs/android-local-apk.md).

Package ID (UAT): `com.oorjaman.technician.uat` · display name **OorjaMan Partner (UAT)**.

## Production (store)

`eas build --profile production` — [DEPLOYMENT.md](../../project-docs/DEPLOYMENT.md).

## Docs

- [ENVIRONMENT.md](../../project-docs/ENVIRONMENT.md)
- [docs/technician-push-setup.md](../../docs/technician-push-setup.md)
- [BILLING.md](../../project-docs/BILLING.md)
