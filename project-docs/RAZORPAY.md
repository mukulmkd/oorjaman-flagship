# Razorpay (UAT / production-ready path)

Customer checkout uses **Razorpay Standard Checkout** for one-time visits and AMC prepay when `EXPO_PUBLIC_RAZORPAY_KEY_ID` is set.

**Source of truth:** database + signed webhooks / server verify — **not** the Checkout SDK alone.

## Architecture

1. App creates a `pending_payment` booking (one-time) or uses a `trialing` subscription (AMC).
2. Edge Function `create-razorpay-order` creates a Razorpay Order + `payments` row (`pending`, `provider=razorpay`, `razorpay_order_status=created`, `attempt_number`).
3. App opens Razorpay Checkout with `order_id` + public `key_id`.
4. On SDK success, app calls **`verify-razorpay-payment`** (HMAC of `order_id|payment_id` with **server secret**, then Razorpay Payments API). Never trusts client amount/status.
5. Razorpay webhooks (idempotent via `razorpay_webhook_events.event_id`):
   - `payment.authorized` → OorjaMan `authorized` only (**not** paid; booking not confirmed)
   - `payment.captured` / `order.paid` → `fulfill_razorpay_payment` → `success` (PAID), booking `confirmed` or AMC wallet funded
   - `payment.failed` → `failed` / `cancelled` / `timeout` + error taxonomy (booking stays retryable when appropriate)
   - `refund.*` → `payment_refunds` + payment `refund_pending` / `partially_refunded` / `refunded` / `refund_failed`
6. App shows **confirming** UI + polls until terminal status (authorized alone is not terminal success).

### Auto refunds (cancellation)

OorjaMan calls Edge Function **`create-razorpay-refund`**, which creates the refund at Razorpay; webhooks still finalize `processed` / `failed`.

**Partner decline / cancel does not refund.** Vendor reject and vendor cancel-after-accept both return the visit to ops for reassignment (possibly to another partner). A Razorpay refund runs only when the **customer** cancels, or when **admin** gives up and cancels because no partner can fulfill.

| Trigger | Refund amount |
|---------|----------------|
| Customer cancel within grace (or before technician assigned) | Full remaining |
| Customer late cancel (after 1h post-assignment) | `remaining − late_fee_paise` (platform setting) |
| Vendor **reject** (confirmed, within response window) | **No** refund — booking stays `confirmed`, unassigned for ops |
| Vendor **Cancel & reassign** (after accept) | **No** refund — booking stays live for reassignment |
| Admin **Cancel + refund** (no partner available) | Full remaining, or net late fee if ops checks the box |
| Admin **Initiate refund** (Finance → Payments) | Full remaining or explicit amount |
| Postpaid / unpaid / AMC contract cancel | **No** gateway refund in v1 |

Cancel always succeeds even if Razorpay refund fails; `metadata.refund_attempt` records the outcome for ops retry.

**Booking status is independent of payment status.**

Domain helpers: `@oorjaman/api` → `razorpay-status`, `razorpay-errors`, `refund-api`.  
UAT matrix + **Test mode cards / error cards**: [RAZORPAY-UAT-MATRIX.md](RAZORPAY-UAT-MATRIX.md).

If `EXPO_PUBLIC_RAZORPAY_KEY_ID` is **unset**, the customer app keeps the **Simulate gateway** buttons.

### Checkout CTA branding

Use OorjaMan primary button copy **“Pay securely”** plus muted **“Powered by Razorpay”** caption. Do not invent a faux Razorpay logo/wordmark.

## UAT setup

### 1. Database

```bash
npm run db:push
```

Migrations:

- `supabase/migrations/20260821200000_razorpay_payments_uat.sql`
- `supabase/migrations/20260821210000_razorpay_payment_production.sql` (enum values only)
- `supabase/migrations/20260821211000_razorpay_payment_production_body.sql` (tables/RPCs/policies)

### 2. Edge Function secrets (UAT project)

| Secret | Value |
|--------|--------|
| `RAZORPAY_KEY_ID` | Test key id (`rzp_test_…`) |
| `RAZORPAY_KEY_SECRET` | Test key secret |
| `RAZORPAY_WEBHOOK_SECRET` | From Razorpay Dashboard → Webhooks |

### 3. Deploy functions

```bash
npm run functions:deploy -- create-razorpay-order
npm run functions:deploy -- verify-razorpay-payment
npm run functions:deploy -- create-razorpay-refund
npm run functions:deploy -- razorpay-webhook --no-verify-jwt
```

### 4. Razorpay Dashboard (Test mode)

Webhook URL: `https://<UAT_PROJECT_REF>.supabase.co/functions/v1/razorpay-webhook`  

Enable: `payment.authorized`, `payment.captured`, `payment.failed`, `order.paid`, `refund.created`, `refund.processed`, `refund.failed`.

### 5. Customer app

```env
EXPO_PUBLIC_RAZORPAY_KEY_ID=rzp_test_xxxxxxxx
```

Rebuild native UAT/dev client after dependency or native module changes.

## Production (Live) cutover

Mirror of UAT, with **Live** keys and the **PROD** Supabase project. Full checklist + status lives in root [`PROD_CHECKLIST.md`](../PROD_CHECKLIST.md) **§11a** (secrets, webhook URL, function deploys, Payment Links, app `EXPO_PUBLIC_RAZORPAY_KEY_ID=rzp_live_…`, smoke tests). Never put Test secrets on Prod.

## Internal payment statuses (DB)

| DB `payments.status` | OorjaMan meaning |
|----------------------|------------------|
| `pending` | PAYMENT_PENDING |
| `authorized` | PAYMENT_AUTHORIZED (not paid) |
| `success` | PAID (captured) |
| `failed` / `cancelled` / `timeout` | failure family |
| `refund_pending` / `partially_refunded` / `refunded` / `refund_failed` | refund family |

## Postpaid (pay after service)

One-time bookings may use `payment_timing = postpaid`:

1. Customer confirms → booking `confirmed` (vendor 1-hour timer starts) with **no** capture.
2. After technician completes → collect via Razorpay Payment Link/QR, customer app **Pay outstanding**, or **Mark partner collected**.
3. Partner-collected payments set `vendor_settlements.customer_paid_to = partner`, `net_payout_paise = 0`; admin **Mark settled** means platform fee was collected from the vendor.

Migration: `20260821220000_postpaid_one_time.sql`. Redeploy `create-razorpay-order`.

## Admin ops

Admin web → **Finance → Payments** (`/dashboard/finance/payments`): filterable payment list, detail modal with Razorpay IDs, attempts, refunds, **Initiate refund**, and failure diagnostics (no secrets/card data). Booking actions also link “View payments for this booking”.

Admin web → **Bookings** monitoring: **Cancel booking + refund** for `pending_payment` / `confirmed` / `accepted` rows.

- Clients cannot set Razorpay payments to `success` (RLS).
- No secrets in client bundles.
- Do not log card numbers, CVV, OTP, or API secrets.

## Unit tests

```bash
cd packages/api && npx --yes tsx --test src/payments/razorpay-errors.test.ts
```
