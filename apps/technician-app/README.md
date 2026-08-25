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

UAT env: `apps/technician-app/.env.uat.local` (copy from `.env.uat.example`) — [docs/android-local-apk.md](../../docs/android-local-apk.md).

Package ID (UAT): `com.oorjaman.technician.uat` · display name **OorjaMan Partner (UAT)**.

## Production (store)

`eas build --profile production` — [DEPLOYMENT.md](../../project-docs/DEPLOYMENT.md).

## Debug Android crashes / freezes

Install the UAT APK, reproduce the issue, then capture logs with **adb** (Android platform tools):

```bash
# 1. Enable USB debugging on the phone, connect USB, verify device:
adb devices

# 2. Clear old log noise, reproduce the crash, then dump recent errors:
adb logcat -c
# … use the app until it crashes or misbehaves …
adb logcat -d | grep -iE 'FATAL|AndroidRuntime|ReactNative|Expo|oorjaman|technician' | tail -200
```

Save full output for sharing:

```bash
adb logcat -d > ~/Desktop/technician-app-log.txt
```

Look for `FATAL EXCEPTION` (native crash) or `ReactNativeJS` (JavaScript error). Filter by package:

```bash
adb logcat --pid=$(adb shell pidof -s com.oorjaman.technician.uat)
```

For **Metro / dev** builds: errors also appear in the terminal running `npm run technician`.

## Docs

- [ENVIRONMENT.md](../../project-docs/ENVIRONMENT.md)
- [docs/technician-push-setup.md](../../docs/technician-push-setup.md)
- [BILLING.md](../../project-docs/BILLING.md)
