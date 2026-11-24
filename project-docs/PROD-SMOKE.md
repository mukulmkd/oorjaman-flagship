# PROD smoke (Customer-first)

Light checks after shipping DB / Edge security changes to **OorjaMan PROD**. Goal: confirm the live Customer app still works. **Not** load testing.

UAT stress (k6 / Maestro loops) stays in [MOBILE-STRESS.md](MOBILE-STRESS.md) — never point those scripts at PROD.

## Prep

| Item | Value |
| --- | --- |
| App | Play / App Store **OorjaMan** (`com.oorjaman.customer`) — not UAT |
| Account | Your own PROD customer (real OTP SMS) |
| Optional device automation | Maestro once — [flows below](#optional-maestro-once) |

Do **not** use dummy OTP `123456` on PROD (dummy payments / dummy auth are off).

## Customer app checklist (~10 min)

Tick in order. Stop and investigate on first failure.

### A. Session & catalog

- [ ] Cold launch → splash → home (or login)
- [ ] OTP login with a real phone (if logged out)
- [ ] Home loads approved partners / book CTA (no blank / RLS error)
- [ ] **Bookings** tab lists history (including past `pending_payment` / confirmed)
- [ ] **Subscription / AMC** tab opens without error

### B. One-time prepaid (Razorpay amount binding)

- [ ] Start **Book a visit** → pick address, slot, partner (or marketplace)
- [ ] Payable total looks correct (credits / compensation applied if any)
- [ ] **Proceed to pay** opens Razorpay with the **same** amount (not ₹1 / not inflated)
- [ ] Cancel or close Razorpay without paying → booking stays unpaid / abandoned path OK  
      *(Do not need a live capture for smoke unless you intentionally want a tiny paid visit.)*

### C. Postpaid (if your account can use pay-later)

- [ ] Book with **pay later** → booking lands as **confirmed** (not stuck in payment)
- [ ] Appears under Bookings

### D. AMC visit (funded plan only)

Only if you have an **active + funded** AMC on PROD:

- [ ] Schedule next visit from Subscription / Book flow
- [ ] Booking creates as **confirmed** and shows under Bookings  
      *(This is the path that broke if RLS required UAT dummy — now gated by funded AMC ownership.)*

### E. Negative (security remediations)

- [ ] There is **no** working “fake pay / dummy success” path on PROD
- [ ] Abandoning Razorpay does **not** confirm a prepaid booking

## Optional Maestro (once)

Install: https://maestro.mobile.dev/getting-started/installing-maestro

1. Install / open the **PROD** Customer app on a device or emulator.
2. Log in manually with real OTP (Maestro will not enter PROD OTP).
3. Run **one** pass (no `--repeat`):

```bash
# From repo root — refuses --repeat / stress flags
npm run smoke:maestro:customer:prod
```

Flows under `stress/maestro/prod/` assume an existing session (`clearState` is off):

| Flow | Checks |
| --- | --- |
| `customer-home-bookings.yaml` | Home → Bookings |
| `customer-book-nav.yaml` | Home → book entry points → back → Bookings |

If Maestro cannot see labels (new copy / fonts), fall back to the manual checklist.

## What this covers from the security ship

| Change | Customer impact checked by |
| --- | --- |
| Razorpay order amount bound to booking / AMC price | B |
| Dummy payment success blocked on PROD | E |
| Prepaid insert must be `pending_payment` | B / E |
| Funded AMC visit insert still allowed | D |
| `vendor-intake-upload` Edge | Vendor signup web — not Customer app |

## Partner / admin (optional, 2 min)

- [ ] Partner app: login → jobs list
- [ ] Admin: open one booking / one AMC (state-ops scope may hide out-of-state users — expected)

## If something fails

1. Note screen + exact error toast / network failing URL.
2. Confirm app is PROD package (`com.oorjaman.customer`) and `EXPO_PUBLIC_DEPLOY_ENV=production`.
3. Edge: `create-razorpay-order` / `vendor-intake-upload` on project `nppfpegqnmclbcmmogux`.
4. Do **not** re-run UAT k6 against PROD.
