# Booking & ops notifications (real-time vs scheduled)

Admin and vendor portals subscribe to **`notification_events`** via Supabase Realtime. On **Vercel UAT**, open https://oorjaman-admin.vercel.app or https://oorjaman-vendor.vercel.app — bells update without refresh when connected.

## In-app (admin & vendor) — **real-time**

When the API (or the scheduled SQL scan) inserts a row into `notification_events` with:

- `channels` including `in_app`
- `status = 'sent'` (in-app-only events)

the **admin** and **vendor** notification bells subscribe via **Supabase Realtime** (`INSERT` on `notification_events`). Open dashboards update **without refresh**.

Examples (immediate on the triggering action):

| Event                           | When                                                         |
| ------------------------------- | ------------------------------------------------------------ |
| `admin_booking_created`         | Booking becomes `confirmed` (payment success or AMC confirm) |
| `vendor_booking_assigned`       | Preferred partner / direct assign on confirm                 |
| `admin_marketplace_floated`     | Admin (or policy) floats marketplace                         |
| `marketplace_broadcast`         | Vendors (in-app + queued email/sms)                          |
| `admin_booking_vendor_claimed`  | Vendor claims marketplace job                                |
| `admin_booking_vendor_accepted` | Vendor accepts + assigns technician                          |

Migration: `20260724120000_notification_inbox_realtime.sql`.

## Partner response overdue - **automatic + real-time delivery**

After the **1-hour** partner window (`vendor_response.anchor_at` or `marketplace.open_at` or `created_at`):

1. **`pg_cron`** runs every **5 minutes**: `notify_overdue_vendor_responses_batch(200)`  
   Migration: `20260733230000_vendor_response_overdue_cron.sql`
2. Inserts **`admin_booking_vendor_response_overdue`** (in-app, `sent`).
3. Admin UI receives it **in real time** if the bell is connected (same Realtime channel).

Manual refresh on Bookings / Operations still calls the same logic via the API for immediate catch-up.

### Fallback if `pg_cron` is not enabled

Supabase Dashboard → **Edge Functions** → **`scan-vendor-response-overdue`** → Cron:

- Schedule: `*/5 * * * *` (every 5 minutes)
- Method: `POST`
- Header: `x-cron-dispatch-secret: <CRON_DISPATCH_SECRET>` (or reuse `PUSH_DISPATCH_SECRET`)

Deploy:

```bash
npm run functions:deploy -- scan-vendor-response-overdue
```

Secrets: `SUPABASE_SERVICE_ROLE_KEY` (auto), `CRON_DISPATCH_SECRET` or `PUSH_DISPATCH_SECRET`.

---

_Last updated: 2026-05-20 — admin/vendor on Vercel UAT._

## Email / SMS / WhatsApp - **not instant by default**

`marketplace_broadcast` and similar multi-channel events are often `status = 'queued'`. Delivery requires:

```bash
npm run functions:deploy -- process-notification-events
```

and a cron (or manual **Process queue** on Operations) to drain the queue.

## Technicians

Job assignment uses **bookings Realtime** + `technician_activity_events`, not the admin/vendor `notification_events` inbox (no Expo job-assignment push yet).
