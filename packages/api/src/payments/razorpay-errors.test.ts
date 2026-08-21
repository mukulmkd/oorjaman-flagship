/**
 * Lightweight unit tests for Razorpay error normalization (Node test runner).
 * Run: node --experimental-strip-types --test packages/api/src/payments/razorpay-errors.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PaymentErrorCategory,
  normalizeRazorpayError,
  dbStatusForNormalizedError,
} from "./razorpay-errors.ts";
import {
  dbPaymentStatusToDomain,
  OorjaManPaymentStatus,
  isPaymentPaidDbStatus,
  paymentUiResultFromDb,
} from "./razorpay-status.ts";

describe("normalizeRazorpayError", () => {
  const cases: Array<{ reason: string; category: string }> = [
    { reason: "card_declined", category: PaymentErrorCategory.BANK_DECLINED },
    { reason: "insufficient_funds", category: PaymentErrorCategory.INSUFFICIENT_FUNDS },
    { reason: "insufficient_fund", category: PaymentErrorCategory.INSUFFICIENT_FUNDS },
    { reason: "incorrect_cvv", category: PaymentErrorCategory.CUSTOMER_ACTION_REQUIRED },
    { reason: "authentication_failed", category: PaymentErrorCategory.AUTHENTICATION_FAILED },
    { reason: "card_expired", category: PaymentErrorCategory.CARD_INVALID },
    { reason: "card_disabled_for_online_payments", category: PaymentErrorCategory.CARD_DISABLED },
    { reason: "debit_instrument_blocked", category: PaymentErrorCategory.CARD_DISABLED },
    { reason: "transaction_limit_exceeded", category: PaymentErrorCategory.BANK_DECLINED },
    { reason: "payment_cancelled", category: PaymentErrorCategory.PAYMENT_CANCELLED },
    { reason: "payment_timed_out", category: PaymentErrorCategory.PAYMENT_TIMEOUT },
    { reason: "payment_risk_check_failed", category: PaymentErrorCategory.RISK_DECLINED },
    { reason: "bank_technical_error", category: PaymentErrorCategory.BANK_UNAVAILABLE },
    { reason: "gateway_technical_error", category: PaymentErrorCategory.GATEWAY_ERROR },
    { reason: "totally_new_reason_xyz", category: PaymentErrorCategory.UNKNOWN_PAYMENT_ERROR },
  ];

  for (const c of cases) {
    it(`maps ${c.reason}`, () => {
      const n = normalizeRazorpayError({ error: { reason: c.reason, code: "BAD_REQUEST_ERROR" } });
      assert.equal(n.category, c.category);
      assert.ok(n.customerMessage.length > 0);
      assert.ok(n.raw.reason === c.reason || n.reason === c.reason);
    });
  }

  it("preserves nested payload fields", () => {
    const n = normalizeRazorpayError({
      error: {
        code: "BAD_REQUEST_ERROR",
        description: "desc",
        field: "cvv",
        source: "customer",
        step: "payment_authentication",
        reason: "incorrect_cvv",
        metadata: { payment_id: "pay_x" },
      },
    });
    assert.equal(n.raw.field, "cvv");
    assert.equal(n.raw.payment_id, "pay_x");
    assert.equal(dbStatusForNormalizedError(n), "failed");
  });
});

describe("payment status domain", () => {
  it("maps success to PAID and never treats authorized as paid", () => {
    assert.equal(dbPaymentStatusToDomain("success"), OorjaManPaymentStatus.PAID);
    assert.equal(dbPaymentStatusToDomain("authorized"), OorjaManPaymentStatus.PAYMENT_AUTHORIZED);
    assert.equal(isPaymentPaidDbStatus("authorized"), false);
    assert.equal(isPaymentPaidDbStatus("success"), true);
  });

  it("ui outcomes", () => {
    assert.equal(paymentUiResultFromDb("success").outcome, "SUCCESS");
    assert.equal(paymentUiResultFromDb("cancelled").outcome, "CANCELLED");
    assert.equal(paymentUiResultFromDb("timeout").outcome, "TIMEOUT");
    assert.equal(paymentUiResultFromDb("refund_pending").outcome, "REFUND_PENDING");
  });
});
