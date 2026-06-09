# Partner app - remote push (Expo)

Field-support chat uses **Expo Push** for notifications when the OorjaMan Partner app is killed or in the background.

For the full dev vs production matrix (all env vars and apps), see [**ENVIRONMENT.md**](../ENVIRONMENT.md).

Customer app push (separate outbox and function): [**customer-push-setup.md**](customer-push-setup.md).

## 1. Apply migrations

```bash
npm run db:push
```

Includes technician support audience (`20260732120000_support_technician_audience.sql`) with `technician_push_tokens`, `technician_push_outbox`, and the `enqueue_technician_support_push` trigger on `support_messages`.

## 2. EAS project ID (client)

1. Create/link an EAS project: `npx eas init` in `apps/technician-app`.
2. Set `EXPO_PUBLIC_EAS_PROJECT_ID` in `apps/technician-app/.env` (same value as EAS `projectId`).

The partner app can use the **same** EAS project as the customer app or a separate one; use separate projects if you want isolated push credentials per app.

## 3. Deploy edge function

```bash
npm run functions:deploy -- send-technician-expo-push
supabase secrets set PUSH_DISPATCH_SECRET="<random-secret>"
```

Optional (higher rate limits): `supabase secrets set EXPO_ACCESS_TOKEN="<expo-access-token>"`

`PUSH_DISPATCH_SECRET` is shared with `send-customer-expo-push` on the same Supabase project-use one secret value for both functions.

## 4. Dispatch outbox → edge function

**Option A - immediate (recommended for production)**

In the Supabase SQL editor (once per project):

```sql
alter database postgres set app.technician_push_function_url = 'https://<PROJECT_REF>.supabase.co/functions/v1/send-technician-expo-push';
alter database postgres set app.push_dispatch_secret = '<same-as-PUSH_DISPATCH_SECRET>';
```

The `technician_push_outbox` insert trigger calls this URL via `pg_net`.

If you already set `app.push_dispatch_secret` for the customer app, you only need to add `app.technician_push_function_url`.

**Option B - scheduled fallback**

Supabase Dashboard → Edge Functions → `send-technician-expo-push` → Cron: every 1 minute, body `{}`, Authorization: `Bearer <service_role_key>`.

Processes any queued rows if Option A is not configured.

## 5. Chat notification sound

Same as customer app: **chat_message.wav** for support chat (foreground local + background Expo push). Rebuild native app after updating `assets/sounds/chat_message.wav` and the `expo-notifications` plugin entry in `app.json`.

## 6. iOS / Android credentials

- **iOS**: APNs key in EAS (`eas credentials`) - requires Apple Developer Program.
- **Android**: FCM via EAS (handled when you run `eas build`).

Development builds from Expo Go have limited push support; use a **development build** or **production build** for end-to-end testing.

## Tap → open chat

Notification `data` includes `kind: support_message` and `conversationId`. The partner app opens the support sheet on that thread automatically (local and remote pushes).

## Deploy both mobile push functions

On a single Supabase project you typically deploy **both** functions and set **both** database URLs:

```bash
npm run functions:deploy -- send-customer-expo-push
npm run functions:deploy -- send-technician-expo-push
```

```sql
alter database postgres set app.customer_push_function_url = 'https://<PROJECT_REF>.supabase.co/functions/v1/send-customer-expo-push';
alter database postgres set app.technician_push_function_url = 'https://<PROJECT_REF>.supabase.co/functions/v1/send-technician-expo-push';
alter database postgres set app.push_dispatch_secret = '<PUSH_DISPATCH_SECRET>';
```
