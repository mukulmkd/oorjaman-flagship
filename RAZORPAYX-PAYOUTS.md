# Partner visit payouts through RazorpayX

Notes from 10 October 2026. Nothing here is built. Revisit before wiring payouts into the admin portal.

Customer checkout stays as documented in [project-docs/RAZORPAY.md](project-docs/RAZORPAY.md). This note is only about paying partners after OorjaMan has already collected the visit.

## What production does today

Admin → Finance shows a visit payout ledger (`vendor_settlements`).

| Action | What it does |
| --- | --- |
| **Approve** | Marks the row approved. No money moves. |
| **Mark settled** | Records that the partner was paid outside the portal (bank transfer). No money moves. |

Razorpay in production collects from the customer and can refund the customer. It does not pay the partner.

For a normal one-time visit the customer pays OorjaMan. The ledger keeps the 12% platform fee and shows the rest as owed to the partner (`customer_paid_to = oorjaman`, status `pending_review` until approved). The breakdown on screen is gross, fee base excluding GST, OorjaMan fee, and “OorjaMan collected. Fee earned, payout not settled.”

If the partner collected the cash from the customer, the direction flips: `customer_paid_to = partner`, net payout is 0, and **Mark settled** means the platform fee was collected from the partner. A Razorpay payout does not cover that case.

## Rows already on the ledger

Gamusa Green Energy one-time visits (early October 2026) are in this “OorjaMan collected, payout not settled” state. Pay those by bank transfer, then **Mark settled**.

Razorpay Route (splitting a captured payment to a linked account) is the wrong tool for those rows. A Route transfer has to happen before Razorpay settles that payment into OorjaMan’s bank, usually within a couple of days of capture. Those visits are already past that window. Route can be reconsidered only for future visits.

## RazorpayX, when this is picked up

OorjaMan opens RazorpayX. Partners do not.

- Use the **existing** live Razorpay Payments login. Do not create a second Razorpay business account.
- Razorpay’s setup guide: existing Payments users sign in to RazorpayX with those credentials and can use the same API keys for Payout APIs. Customer collections stay on the current account.
- RazorpayX is an extra product. Live payouts need it switched on and its KYC finished.
- Each partner is a payee (contact + bank fund account) under OorjaMan’s RazorpayX account. The vendor record today stores only the last 4 digits of the account. A payout needs the full account number and IFSC, which were collected on vendor registration and are not kept in full on `vendors`.

Until RazorpayX is live, keep paying approved rows by bank transfer and marking them settled.

## If we build it later

1. Confirm RazorpayX live mode on the existing OorjaMan account.
2. Store a partner fund account (full account number + IFSC) securely. Do not put payout secrets in the admin web app.
3. Add an edge function that pays an **approved** visit payout where OorjaMan collected and `net_payout_paise` is greater than 0. One idempotency key per settlement so a double click cannot pay twice.
4. On payout success or failure webhooks, set the ledger to settled or leave it approved with the failure recorded.
5. Leave partner-collected rows on the current fee-collection path. Do not send those through a payout.
