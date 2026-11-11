# Customer app - remote push (Expo)

Support chat and (after OTA) visit lifecycle updates use **Expo Push** when the app is killed or in the background.

For the full dev vs production matrix (all env vars and apps), see [**ENVIRONMENT.md**](../project-docs/ENVIRONMENT.md).

Partner app push (separate function and outbox): [**technician-push-setup.md**](technician-push-setup.md).

## Visit lifecycle pushes (capability-gated)

After the customer installs the OTA that registers `visit_push_enabled`, the server may enqueue remote pushes for:

- Visit confirmed (payment / pay-later confirm)
- First technician assigned
- Technician en route
- Visit completed
- Visit cancelled
- Visit rescheduled

**Gate:** `customer_push_tokens.visit_push_enabled_at` — stamped only when the updated app calls `upsert_customer_push_token(..., visit_push_enabled: true)`. Devices without that OTA keep getting support / AMC / technician-*reassignment* pushes only. No backfill of existing bookings; only future transitions notify.

Migration: `20261111143000_customer_visit_push_capability.sql`.

## 1. Apply migrations

```bash
npm run db:push
```

Includes `20260730130000_support_customer_unread.sql`, `20260731120000_customer_expo_push.sql`, and `20261111143000_customer_visit_push_capability.sql`. Use **OorjaMan UAT** project first — see [SUPABASE-UAT-PROD.md](../project-docs/SUPABASE-UAT-PROD.md).

## 2. EAS project ID (client)

1. Create/link an EAS project: `npx eas init` in `apps/customer-app`.
2. Set `EXPO_PUBLIC_EAS_PROJECT_ID` in `apps/customer-app/.env.development.local` or EAS secrets (same value as EAS `projectId`).

## 3. Deploy edge function

```bash
npm run functions:deploy -- send-customer-expo-push
```

Set secrets in Supabase Dashboard → Edge Functions → Secrets (or CLI):

```bash
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
# plugins in app.config.ts:
# ["expo-notifications", { "sounds": ["./assets/sounds/chat_message.wav"] }]
```

Grant notification permission with sound allowed (iOS Settings → Notifications → Sounds).

## 6. iOS / Android credentials

- **iOS**: APNs key in EAS (`eas credentials`) - requires Apple Developer Program.
- **Android**: FCM via EAS (handled when you run `eas build`).

Development builds from Expo Go have limited push support; use a **development build** or **production build** for end-to-end testing.

## Tap → open

- Support: `kind: support_message` + `conversationId` → support sheet
- Visit lifecycle: `kind: booking_*` + `bookingId` → booking detail
- AMC partner: `kind: amc_partner_assigned` + `subscriptionId` → AMC tab

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
