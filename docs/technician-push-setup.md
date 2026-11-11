# Partner app - remote push (Expo)

Field-support chat and job dispatch updates use **Expo Push** when the OorjaMan Partner app is killed or in the background.

## Job lifecycle pushes

| Event | When |
| --- | --- |
| New job assigned | `technician_id` set on a booking |
| Job reassigned | Technician removed / replaced |
| Visit cancelled | Assigned booking → `cancelled` |
| Visit rescheduled | Assigned booking `scheduled_start` changes |
| Support message | Admin/system reply on technician support chat |

Cancel / reschedule: migration `20261111150000_technician_booking_cancel_reschedule_push.sql` (forward-looking only; no backfill).

For the full dev vs production matrix (all env vars and apps), see [**ENVIRONMENT.md**](../project-docs/ENVIRONMENT.md).

Customer app push (separate outbox and function): [**customer-push-setup.md**](customer-push-setup.md).

## 1. Apply migrations

```bash
npm run db:push
```

Includes technician support audience (`20260732120000_support_technician_audience.sql`) with `technician_push_tokens`, `technician_push_outbox`, and the `enqueue_technician_support_push` trigger on `support_messages`.

## 2. EAS project ID (client)

1. Create/link an EAS project: `npx eas init` in `apps/technician-app`.
2. Set `EXPO_PUBLIC_EAS_PROJECT_ID` in `apps/technician-app/.env.development.local` or EAS secrets (same value as EAS `projectId`).

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

Same as customer app: **chat_message.wav** for support chat (foreground local + background Expo push). Rebuild native app after updating `assets/sounds/chat_message.wav` and the `expo-notifications` plugin entry in `app.config.ts`.

## 6. iOS / Android credentials

- **iOS**: APNs key in EAS (`eas credentials`) - requires Apple Developer Program.
- **Android**: FCM via EAS (handled when you run `eas build`).

Development builds from Expo Go have limited push support; use a **development build** or **production build** for end-to-end testing.

## Tap → open

- Support: `kind: support_message` + `conversationId` → support sheet
- Jobs: `kind: booking_technician_assigned` / `booking_technician_unassigned` / `booking_cancelled` / `booking_rescheduled` + `bookingId` → job detail

## Not remote (by design)

- Day-of / morning job digest — optional later (cron)
- En route / start / complete — technician initiates these

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
