# Customer app - remote push (Expo)

Support chat uses **Expo Push** for notifications when the app is killed or in the background.

For the full dev vs production matrix (all env vars and apps), see [**ENVIRONMENT.md**](../ENVIRONMENT.md).

Technician app push (separate function and outbox): [**technician-push-setup.md**](technician-push-setup.md).

## 1. Apply migrations

```bash
supabase db push
```

Includes `20260730130000_support_customer_unread.sql` and `20260731120000_customer_expo_push.sql`.

## 2. EAS project ID (client)

1. Create/link an EAS project: `npx eas init` in `apps/customer-app`.
2. Set `EXPO_PUBLIC_EAS_PROJECT_ID` in `apps/customer-app/.env` (same value as EAS `projectId`).

## 3. Deploy edge function

```bash
npm run functions:deploy -- send-customer-expo-push
supabase secrets set PUSH_DISPATCH_SECRET="<random-secret>"
```

Optional (higher rate limits): `supabase secrets set EXPO_ACCESS_TOKEN="<expo-access-token>"`

## 4. Dispatch outbox → edge function

**Option A - immediate (recommended for production)**

In the Supabase SQL editor (once per project):

```sql
alter database postgres set app.customer_push_function_url = 'https://<PROJECT_REF>.supabase.co/functions/v1/send-customer-expo-push';
alter database postgres set app.push_dispatch_secret = '<same-as-PUSH_DISPATCH_SECRET>';
```

The `customer_push_outbox` insert trigger calls this URL via `pg_net`.

**Option B - scheduled fallback**

Supabase Dashboard → Edge Functions → `send-customer-expo-push` → Cron: every 1 minute, body `{}`, Authorization: `Bearer <service_role_key>`.

Processes any rows if Option A is not configured.

## 5. Chat notification sound

Support messages use a short **chat_message.wav** chime (underscore - required for Android resource names):

- **In app (another screen / foreground):** local realtime notification with sound via `expo-notifications` handler.
- **Background / killed:** Expo push with `sound: chat_message.wav` and Android channel `support-chat`.

Rebuild the native app after pulling sound assets (`eas build` or dev client rebuild) so iOS/Android bundle the WAV:

```bash
# plugins in app.config / app.json:
# ["expo-notifications", { "sounds": ["./assets/sounds/chat_message.wav"] }]
```

Grant notification permission with sound allowed (iOS Settings → Notifications → Sounds).

## 6. iOS / Android credentials

- **iOS**: APNs key in EAS (`eas credentials`) - requires Apple Developer Program.
- **Android**: FCM via EAS (handled when you run `eas build`).

Development builds from Expo Go have limited push support; use a **development build** or **production build** for end-to-end testing.

## Tap → open chat

Notification `data` includes `kind: support_message` and `conversationId`. The customer app opens the support sheet on that thread automatically (local and remote pushes).

## Both mobile apps on one Supabase project

Deploy and configure customer and technician push separately. They share `PUSH_DISPATCH_SECRET` and `app.push_dispatch_secret` but use different function URLs:

```bash
npm run functions:deploy -- send-customer-expo-push
npm run functions:deploy -- send-technician-expo-push
```

```sql
alter database postgres set app.customer_push_function_url = 'https://<PROJECT_REF>.supabase.co/functions/v1/send-customer-expo-push';
alter database postgres set app.technician_push_function_url = 'https://<PROJECT_REF>.supabase.co/functions/v1/send-technician-expo-push';
alter database postgres set app.push_dispatch_secret = '<PUSH_DISPATCH_SECRET>';
```
