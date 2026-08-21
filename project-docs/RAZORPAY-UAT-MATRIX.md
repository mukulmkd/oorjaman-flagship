# Razorpay UAT test matrix

Payment status is **independent** of booking status. DB `payments.status = success` means **PAID (captured)**. `authorized` is never treated as paid.

**Related:** [RAZORPAY.md](RAZORPAY.md) · Official [Razorpay test cards](https://razorpay.com/docs/payments/payments/test-card-details/) (Test mode).

Migrations required on UAT:

1. `20260821200000_razorpay_payments_uat.sql`
2. `20260821210000_razorpay_payment_production.sql` (enum only — must commit before body)
3. `20260821211000_razorpay_payment_production_body.sql`
4. `20260821220000_postpaid_one_time.sql` (pay after service)

Deploy functions: `create-razorpay-order`, `razorpay-webhook` (`--no-verify-jwt`), `verify-razorpay-payment`.

Webhook events to enable (Test mode): `payment.authorized`, `payment.captured`, `payment.failed`, `order.paid`, `refund.created`, `refund.processed`, `refund.failed`.

Customer app: set `EXPO_PUBLIC_RAZORPAY_KEY_ID=rzp_test_…` and rebuild the UAT APK after checkout / native changes.

---

## Test cards (Indian payments — Razorpay Test mode)

Use these cards to exercise success and saved-card flows. You can save any of the cards below. When a customer chooses to save their card, Razorpay tokenizes internally ([Saved Cards](https://razorpay.com/docs/payments/payments/saved-cards/)).

**CVV & expiry:** use a **random CVV** and **any future expiry date** for all rows below (unless a scenario notes otherwise).

| Network | Card number | Card type | Card sub type |
|---------|-------------|-----------|---------------|
| Visa | `4100 2800 0000 1007` | Debit | Consumer |
| Mastercard | `5555 5100 0008 1006` | Credit | Business |
| Mastercard | `5180 2872 0009 1001` | Prepaid | Consumer |
| RuPay | `6527 6589 0000 1005` | Credit | Consumer |
| Diners | `3608 280009 1007` | Credit | Consumer |
| Amex | `3402 560004 01007` | Credit | Consumer |

**Happy-path check (prepaid one-time):** Book visit → Pay now → Checkout → success card → confirming timer → **Booking confirmed** with **How you paid** (Status Paid, Paid via Razorpay, Method, Order ID, Payment ID). Booking appears under My bookings.

---

## Error scenarios (test cards)

After Checkout starts, on the success/failure screen you must **select failure** to get the mapped error. See [Cards error codes](https://razorpay.com/docs/errors/cards/).

### `BAD_REQUEST_ERROR`

| Error reason | Customer-facing description (Razorpay) | Network | Card number |
|--------------|----------------------------------------|---------|-------------|
| `payment_timed_out` | Your payment could not be completed due to a temporary issue. Try again later. | Visa | `4100 2800 0009 0000` |
| | | Mastercard | `5305 6200 0006 0000` |
| `insufficient_fund` | Your payment could not be completed due to insufficient account balance. Try another card or payment method. | Visa | `4100 2800 0008 0001` |
| | | Mastercard | `5305 6200 0005 0001` |
| `payment_cancelled` | Your payment has been cancelled. Try again or complete the payment later. | Visa | `4100 2800 0007 0002` |
| | | Mastercard | `5305 6200 0004 0002` |
| `card_declined` | Your payment did not go through as it was declined by the bank. Try another payment method or contact your bank. | Visa | `4100 2800 0006 0003` |
| | | Mastercard | `5305 6200 0003 0003` |
| | | Visa | `4100 2800 0005 0004` |
| | | Mastercard | `5305 6200 0002 0004` |
| | | Visa | `4100 2800 0004 0005` |
| | | Mastercard | `5305 6200 0001 0005` |
| `card_disabled_for_online_payments` | Your card is disabled for online payments. Please reach to your bank or try with another card. | Visa | `4100 2800 0003 0006` |
| | | Mastercard | `5305 6200 0000 0006` |
| `card_number_invalid` | You have entered an incorrect card number. Try again. | Visa | `4100 2800 0001 0008` |
| | | Mastercard | `5305 6200 0008 0008` |

CVV & expiry for all rows above: random CVV + any future date.

### `GATEWAY_ERROR`

| Error reason | Customer-facing description (Razorpay) | Network | Card number |
|--------------|----------------------------------------|---------|-------------|
| `gateway_technical_error` | Your payment did not go through due to a temporary issue. Any debited amount will be refunded in 4–5 business days. | Visa | `4100 2800 0002 0007` |
| | | Mastercard | `5305 6200 0009 0007` |
| `authentication_failed` | Your payment could not be completed due to incorrect OTP or verification details. Try another payment method or contact your bank for details. | Visa | `4100 2800 0000 0009` |
| | | Mastercard | `5305 6200 0007 0009` |

CVV & expiry: random CVV + any future date.

**OorjaMan expectation on these failures:** payment row `failed` / `cancelled` / `timeout` (taxonomy mapped), booking stays retryable (`pending_payment` for prepaid), customer sees Try again — **not** Booking confirmed.

---

## Scenario matrix (product behaviour)

| Scenario | Expected Razorpay | OorjaMan payment | Booking | Customer message | Action | Webhook | DB |
|----------|-------------------|------------------|---------|------------------|--------|---------|-----|
| Happy path capture | payment captured, order paid | `success` (PAID) | `pending_payment` → `confirmed` | Confirming → Booking confirmed + How you paid | View bookings | `payment.captured` | payment success, attempt captured, event claimed |
| Authorized then capture | authorized → captured | `authorized` then `success` | confirm only after capture | Processing → successful | Wait / View | authorized then captured | never confirm on authorized alone |
| Direct capture | captured | `success` | confirmed | Payment successful | View | captured | as above |
| Duplicate captured webhook | same event twice | unchanged success | unchanged | — | — | 2nd: duplicate claim | no duplicate booking |
| Frontend callback before webhook | captured via API verify | `success` | confirmed | Processing → successful | View | may arrive later (idempotent) | fulfill once |
| Webhook before frontend | captured | `success` | confirmed | Poll finds success | View | first | verify sees DB success |
| Verify edge not deployed / soft-fail | captured | `success` via poll | confirmed | Confirming timer then success | View | webhook | do not fail UX solely on verify throw |
| Frontend callback lost | captured | `success` | confirmed | Open My bookings | — | webhook | booking confirmed without app |
| Customer closes app after pay | captured | `success` | confirmed | — | — | webhook | source of truth |
| Card declined (test cards above) | failed | `failed` | stays `pending_payment` | Mapped decline copy | Try again | `payment.failed` | attempt failed; retry allowed |
| Insufficient funds | failed | `failed` | pending_payment | Insufficient funds… | Try again | failed | as above |
| Payment cancelled (card / SDK) | cancelled | `cancelled` / abandon | cancelled or pending | Payment cancelled | Retry | optional | abandon or failure row |
| Timeout | timed out | `timeout` | pending_payment | Timed out… | Retry | failed/timeout | as above |
| Auth failed | failed | `failed` | pending_payment | Authentication failed… | Retry | failed | as above |
| Card disabled | failed | `failed` | pending_payment | Disabled for online… | Try again | failed | as above |
| Gateway technical error | failed | `failed` | pending_payment | Service unavailable… | Retry | failed | as above |
| Fail then success retry | new order | new payment row attempt N | confirm on 2nd | Successful | View | captured on 2nd | two payments; booking confirmed once |
| **Pay after service** (postpaid) | no capture at book | no prepaid payment | `confirmed` immediately | Booking confirmed; How you paid = pay after service | View bookings | — | `payment_timing=postpaid` |
| Postpaid collect (QR / app / partner) | capture or partner_collected | `success` | already confirmed | Outstanding cleared | — | captured or RPC | settlement `customer_paid_to` correct |
| Partial refund | refund processed partial | `partially_refunded` | unchanged | Partially refunded | — | refund.processed | amount_refunded < amount |
| Full refund | refund processed full | `refunded` | unchanged | Refunded | — | refund.processed | amount_refunded ≥ amount |
| Refund pending | refund.created | `refund_pending` | unchanged | Refund initiated… | — | refund.created | refunds row pending |
| Refund failed | refund.failed | `refund_failed` | unchanged | — | — | refund.failed | refunds row failed |
| Duplicate refund webhook | same refund id | unchanged | unchanged | — | — | duplicate | unique refund id |
| Amount mismatch webhook | captured wrong amount | reject fulfill | no confirm | — | — | 500/error | no success |

---

## Manual QA checklist (UAT)

1. **Prepaid success** — Visa `4100 2800 0000 1007` → confirming timer → How you paid shows Razorpay + method + order/payment ids (no truncated internal booking UUID).
2. **Each success network** — Mastercard / RuPay / Diners / Amex happy cards once.
3. **At least one BAD_REQUEST card** — e.g. insufficient funds Visa `4100 2800 0008 0001` → failure panel, Try again, no confirmed booking.
4. **At least one GATEWAY_ERROR card** — e.g. auth failed Visa `4100 2800 0000 0009`.
5. **User dismisses Checkout** — cancelled / abandon path.
6. **Pay after service** — book without capture; complete job; collect via technician QR or customer outstanding pay.
7. **Admin** — Finance → Payments shows the payment with Razorpay ids / failure category.
8. **AMC pay** (if testing subscriptions) — same success + one failure card.

---

## Secrets (never in client)

| Variable | Where |
|----------|--------|
| `RAZORPAY_KEY_ID` | Edge secrets |
| `RAZORPAY_KEY_SECRET` | Edge secrets |
| `RAZORPAY_WEBHOOK_SECRET` | Edge secrets |
| `EXPO_PUBLIC_RAZORPAY_KEY_ID` | App only (public key id) |
