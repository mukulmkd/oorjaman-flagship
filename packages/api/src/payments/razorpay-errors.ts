/**
 * Centralized Razorpay error parse → OorjaMan category → customer message → action.
 * Never expose raw Razorpay codes to customers; preserve payload for diagnostics.
 */

export const PaymentErrorCategory = {
  CUSTOMER_ACTION_REQUIRED: "CUSTOMER_ACTION_REQUIRED",
  BANK_DECLINED: "BANK_DECLINED",
  INSUFFICIENT_FUNDS: "INSUFFICIENT_FUNDS",
  CARD_INVALID: "CARD_INVALID",
  CARD_DISABLED: "CARD_DISABLED",
  AUTHENTICATION_FAILED: "AUTHENTICATION_FAILED",
  PAYMENT_CANCELLED: "PAYMENT_CANCELLED",
  PAYMENT_TIMEOUT: "PAYMENT_TIMEOUT",
  RISK_DECLINED: "RISK_DECLINED",
  BANK_UNAVAILABLE: "BANK_UNAVAILABLE",
  GATEWAY_ERROR: "GATEWAY_ERROR",
  UNKNOWN_PAYMENT_ERROR: "UNKNOWN_PAYMENT_ERROR",
} as const;

export type PaymentErrorCategoryCode =
  (typeof PaymentErrorCategory)[keyof typeof PaymentErrorCategory];

export type PaymentErrorAction = "RETRY" | "TRY_ANOTHER_METHOD" | "NONE";

export type RazorpayErrorPayload = {
  code?: string | null;
  description?: string | null;
  field?: string | null;
  source?: string | null;
  step?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
  payment_id?: string | null;
  order_id?: string | null;
};

export type NormalizedPaymentError = {
  category: PaymentErrorCategoryCode;
  customerMessage: string;
  action: PaymentErrorAction;
  reason: string;
  raw: RazorpayErrorPayload;
};

const REASON_MAP: Record<
  string,
  { category: PaymentErrorCategoryCode; message: string; action: PaymentErrorAction }
> = {
  payment_timed_out: {
    category: PaymentErrorCategory.PAYMENT_TIMEOUT,
    message: "The payment timed out. Please try again.",
    action: "RETRY",
  },
  payment_cancelled: {
    category: PaymentErrorCategory.PAYMENT_CANCELLED,
    message: "Payment was cancelled.",
    action: "RETRY",
  },
  card_declined: {
    category: PaymentErrorCategory.BANK_DECLINED,
    message: "Your bank declined this payment. Please try another payment method.",
    action: "TRY_ANOTHER_METHOD",
  },
  payment_failed: {
    category: PaymentErrorCategory.BANK_DECLINED,
    message: "Payment could not be completed. Please try again or use another method.",
    action: "TRY_ANOTHER_METHOD",
  },
  insufficient_funds: {
    category: PaymentErrorCategory.INSUFFICIENT_FUNDS,
    message: "Your bank could not complete the payment due to insufficient funds.",
    action: "TRY_ANOTHER_METHOD",
  },
  insufficient_fund: {
    category: PaymentErrorCategory.INSUFFICIENT_FUNDS,
    message: "Your bank could not complete the payment due to insufficient funds.",
    action: "TRY_ANOTHER_METHOD",
  },
  card_not_enrolled: {
    category: PaymentErrorCategory.CARD_DISABLED,
    message: "This card is not enrolled for online payments. Please try another card.",
    action: "TRY_ANOTHER_METHOD",
  },
  card_disabled_for_online_payments: {
    category: PaymentErrorCategory.CARD_DISABLED,
    message: "This card is disabled for online payments. Please try another card.",
    action: "TRY_ANOTHER_METHOD",
  },
  authentication_failed: {
    category: PaymentErrorCategory.AUTHENTICATION_FAILED,
    message: "Card authentication failed. Please try again or use another method.",
    action: "RETRY",
  },
  payment_risk_check_failed: {
    category: PaymentErrorCategory.RISK_DECLINED,
    message: "Your payment was declined for security reasons. Please try another payment method.",
    action: "TRY_ANOTHER_METHOD",
  },
  incorrect_cvv: {
    category: PaymentErrorCategory.CUSTOMER_ACTION_REQUIRED,
    message: "The CVV appears to be incorrect. Please check your card details.",
    action: "RETRY",
  },
  debit_instrument_inactive: {
    category: PaymentErrorCategory.CARD_DISABLED,
    message: "This payment instrument is inactive. Please try another method.",
    action: "TRY_ANOTHER_METHOD",
  },
  debit_instrument_blocked: {
    category: PaymentErrorCategory.CARD_DISABLED,
    message: "This payment instrument is blocked. Please try another method.",
    action: "TRY_ANOTHER_METHOD",
  },
  card_expired: {
    category: PaymentErrorCategory.CARD_INVALID,
    message: "This card has expired. Please use another card.",
    action: "TRY_ANOTHER_METHOD",
  },
  transaction_limit_exceeded: {
    category: PaymentErrorCategory.BANK_DECLINED,
    message: "The transaction limit was exceeded. Please try another method or a smaller amount.",
    action: "TRY_ANOTHER_METHOD",
  },
  gateway_technical_error: {
    category: PaymentErrorCategory.GATEWAY_ERROR,
    message: "Payment service is temporarily unavailable. Please try again.",
    action: "RETRY",
  },
  bank_technical_error: {
    category: PaymentErrorCategory.BANK_UNAVAILABLE,
    message: "Your bank is temporarily unavailable. Please try again later.",
    action: "RETRY",
  },
};

function pickReason(raw: RazorpayErrorPayload): string {
  const r = (raw.reason ?? raw.code ?? "").toString().trim().toLowerCase();
  return r || "unknown";
}

/** Extract Razorpay error fields from nested SDK / API shapes without throwing. */
export function extractRazorpayErrorPayload(input: unknown): RazorpayErrorPayload {
  if (!input || typeof input !== "object") return {};
  const root = input as Record<string, unknown>;
  const err =
    root.error && typeof root.error === "object"
      ? (root.error as Record<string, unknown>)
      : root;

  const meta =
    err.metadata && typeof err.metadata === "object"
      ? (err.metadata as Record<string, unknown>)
      : null;

  return {
    code: typeof err.code === "string" ? err.code : null,
    description: typeof err.description === "string" ? err.description : typeof err.message === "string" ? err.message : null,
    field: typeof err.field === "string" ? err.field : null,
    source: typeof err.source === "string" ? err.source : null,
    step: typeof err.step === "string" ? err.step : null,
    reason: typeof err.reason === "string" ? err.reason : null,
    metadata: meta,
    payment_id:
      typeof err.payment_id === "string"
        ? err.payment_id
        : typeof meta?.payment_id === "string"
          ? meta.payment_id
          : null,
    order_id:
      typeof err.order_id === "string"
        ? err.order_id
        : typeof meta?.order_id === "string"
          ? meta.order_id
          : null,
  };
}

export function normalizeRazorpayError(input: unknown): NormalizedPaymentError {
  const raw = extractRazorpayErrorPayload(input);
  const reason = pickReason(raw);
  const mapped = REASON_MAP[reason];
  if (mapped) {
    return {
      category: mapped.category,
      customerMessage: mapped.message,
      action: mapped.action,
      reason,
      raw,
    };
  }

  // Soft heuristics for cancel/timeout strings from native SDK
  const desc = (raw.description ?? "").toLowerCase();
  if (/cancel/.test(desc) || reason.includes("cancel")) {
    return {
      category: PaymentErrorCategory.PAYMENT_CANCELLED,
      customerMessage: "Payment was cancelled.",
      action: "RETRY",
      reason: reason || "payment_cancelled",
      raw,
    };
  }
  if (/timeout|timed.?out/.test(desc) || reason.includes("timeout")) {
    return {
      category: PaymentErrorCategory.PAYMENT_TIMEOUT,
      customerMessage: "The payment timed out. Please try again.",
      action: "RETRY",
      reason: reason || "payment_timed_out",
      raw,
    };
  }

  return {
    category: PaymentErrorCategory.UNKNOWN_PAYMENT_ERROR,
    customerMessage: "Payment could not be completed. Please try again.",
    action: "RETRY",
    reason: reason || "unknown",
    raw,
  };
}

export function dbStatusForNormalizedError(
  err: NormalizedPaymentError,
): "failed" | "cancelled" | "timeout" {
  if (err.category === PaymentErrorCategory.PAYMENT_CANCELLED) return "cancelled";
  if (err.category === PaymentErrorCategory.PAYMENT_TIMEOUT) return "timeout";
  return "failed";
}

export function uiOutcomeFromNormalizedError(err: NormalizedPaymentError): {
  title: string;
  message: string;
  action: PaymentErrorAction;
} {
  if (err.action === "TRY_ANOTHER_METHOD") {
    return {
      title: "Try another payment method",
      message: err.customerMessage,
      action: err.action,
    };
  }
  if (err.category === PaymentErrorCategory.PAYMENT_CANCELLED) {
    return { title: "Payment was cancelled", message: err.customerMessage, action: err.action };
  }
  if (err.category === PaymentErrorCategory.PAYMENT_TIMEOUT) {
    return { title: "The payment timed out", message: err.customerMessage, action: err.action };
  }
  return {
    title: "Payment could not be completed",
    message: err.customerMessage,
    action: err.action,
  };
}
