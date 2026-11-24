import { describe, expect, it } from "vitest";
import {
  PaymentErrorCategory,
  normalizeRazorpayError,
  dbStatusForNormalizedError,
} from "./razorpay-errors";
import {
  dbPaymentStatusToDomain,
  OorjaManPaymentStatus,
  isPaymentPaidDbStatus,
  paymentUiResultFromDb,
} from "./razorpay-status";

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
      expect(n.category).toBe(c.category);
      expect(n.customerMessage.length).toBeGreaterThan(0);
      expect(n.raw.reason === c.reason || n.reason === c.reason).toBe(true);
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
    expect(n.raw.field).toBe("cvv");
    expect(n.raw.payment_id).toBe("pay_x");
    expect(dbStatusForNormalizedError(n)).toBe("failed");
  });
});

describe("payment status domain", () => {
  it("maps success to PAID and never treats authorized as paid", () => {
    expect(dbPaymentStatusToDomain("success")).toBe(OorjaManPaymentStatus.PAID);
    expect(dbPaymentStatusToDomain("authorized")).toBe(OorjaManPaymentStatus.PAYMENT_AUTHORIZED);
    expect(isPaymentPaidDbStatus("authorized")).toBe(false);
    expect(isPaymentPaidDbStatus("success")).toBe(true);
  });

  it("ui outcomes", () => {
    expect(paymentUiResultFromDb("success").outcome).toBe("SUCCESS");
    expect(paymentUiResultFromDb("cancelled").outcome).toBe("CANCELLED");
    expect(paymentUiResultFromDb("timeout").outcome).toBe("TIMEOUT");
    expect(paymentUiResultFromDb("refund_pending").outcome).toBe("REFUND_PENDING");
  });
});
