/**
 * OorjaMan payment domain — separate from booking status.
 * DB stores lowercase enums; these constants are the business vocabulary.
 */

/** Maps to public.payment_status (extended). `success` = captured / PAID. */
export type DbPaymentStatus =
  | "pending"
  | "authorized"
  | "success"
  | "failed"
  | "cancelled"
  | "timeout"
  | "partially_refunded"
  | "refund_pending"
  | "refunded"
  | "refund_failed";

export const OorjaManPaymentStatus = {
  PAYMENT_PENDING: "PAYMENT_PENDING",
  PAYMENT_AUTHORIZED: "PAYMENT_AUTHORIZED",
  PAID: "PAID",
  PAYMENT_FAILED: "PAYMENT_FAILED",
  PAYMENT_CANCELLED: "PAYMENT_CANCELLED",
  PAYMENT_TIMEOUT: "PAYMENT_TIMEOUT",
  PARTIALLY_REFUNDED: "PARTIALLY_REFUNDED",
  REFUND_PENDING: "REFUND_PENDING",
  REFUND_PROCESSED: "REFUND_PROCESSED",
  REFUND_FAILED: "REFUND_FAILED",
  REFUNDED: "REFUNDED",
} as const;

export type OorjaManPaymentStatusCode =
  (typeof OorjaManPaymentStatus)[keyof typeof OorjaManPaymentStatus];

export function dbPaymentStatusToDomain(status: string | null | undefined): OorjaManPaymentStatusCode {
  switch (status) {
    case "pending":
      return OorjaManPaymentStatus.PAYMENT_PENDING;
    case "authorized":
      return OorjaManPaymentStatus.PAYMENT_AUTHORIZED;
    case "success":
      return OorjaManPaymentStatus.PAID;
    case "failed":
      return OorjaManPaymentStatus.PAYMENT_FAILED;
    case "cancelled":
      return OorjaManPaymentStatus.PAYMENT_CANCELLED;
    case "timeout":
      return OorjaManPaymentStatus.PAYMENT_TIMEOUT;
    case "partially_refunded":
      return OorjaManPaymentStatus.PARTIALLY_REFUNDED;
    case "refund_pending":
      return OorjaManPaymentStatus.REFUND_PENDING;
    case "refunded":
      return OorjaManPaymentStatus.REFUNDED;
    case "refund_failed":
      return OorjaManPaymentStatus.REFUND_FAILED;
    default:
      return OorjaManPaymentStatus.PAYMENT_PENDING;
  }
}

/** Terminal for poll wait: paid, failed family, or cancelled/timeout. Not authorized. */
export function isPaymentTerminalDbStatus(status: string | null | undefined): boolean {
  return (
    status === "success" ||
    status === "failed" ||
    status === "cancelled" ||
    status === "timeout" ||
    status === "refunded" ||
    status === "partially_refunded"
  );
}

export function isPaymentPaidDbStatus(status: string | null | undefined): boolean {
  return status === "success" || status === "partially_refunded" || status === "refund_pending";
}

export type RazorpayOrderStatus = "created" | "attempted" | "paid";
export type RazorpayPaymentStatus =
  | "created"
  | "authorized"
  | "captured"
  | "failed"
  | "refunded";

export const PaymentUiOutcome = {
  SUCCESS: "SUCCESS",
  PROCESSING: "PROCESSING",
  RETRYABLE_FAILURE: "RETRYABLE_FAILURE",
  ALTERNATIVE_METHOD: "ALTERNATIVE_METHOD",
  CANCELLED: "CANCELLED",
  TIMEOUT: "TIMEOUT",
  REFUND_PENDING: "REFUND_PENDING",
  REFUNDED: "REFUNDED",
} as const;

export type PaymentUiOutcomeCode = (typeof PaymentUiOutcome)[keyof typeof PaymentUiOutcome];

export type PaymentUiResult = {
  outcome: PaymentUiOutcomeCode;
  title: string;
  message: string;
  action: "NONE" | "RETRY" | "TRY_ANOTHER_METHOD" | "WAIT" | "VIEW_BOOKING";
  domainStatus: OorjaManPaymentStatusCode;
};

export function paymentUiResultFromDb(
  status: string | null | undefined,
  customerMessage?: string | null,
): PaymentUiResult {
  const domain = dbPaymentStatusToDomain(status);
  switch (domain) {
    case OorjaManPaymentStatus.PAID:
    case OorjaManPaymentStatus.PARTIALLY_REFUNDED:
      return {
        outcome: PaymentUiOutcome.SUCCESS,
        title: "Payment successful",
        message: customerMessage?.trim() || "Your payment was confirmed.",
        action: "VIEW_BOOKING",
        domainStatus: domain,
      };
    case OorjaManPaymentStatus.PAYMENT_AUTHORIZED:
    case OorjaManPaymentStatus.PAYMENT_PENDING:
      return {
        outcome: PaymentUiOutcome.PROCESSING,
        title: "Your payment is being processed",
        message: "Please wait while we confirm your payment with the bank.",
        action: "WAIT",
        domainStatus: domain,
      };
    case OorjaManPaymentStatus.PAYMENT_CANCELLED:
      return {
        outcome: PaymentUiOutcome.CANCELLED,
        title: "Payment was cancelled",
        message: customerMessage?.trim() || "Payment was cancelled.",
        action: "RETRY",
        domainStatus: domain,
      };
    case OorjaManPaymentStatus.PAYMENT_TIMEOUT:
      return {
        outcome: PaymentUiOutcome.TIMEOUT,
        title: "The payment timed out",
        message: customerMessage?.trim() || "The payment timed out. Please try again.",
        action: "RETRY",
        domainStatus: domain,
      };
    case OorjaManPaymentStatus.REFUND_PENDING:
      return {
        outcome: PaymentUiOutcome.REFUND_PENDING,
        title: "Refund initiated",
        message: customerMessage?.trim() || "Your refund has been initiated and is being processed.",
        action: "NONE",
        domainStatus: domain,
      };
    case OorjaManPaymentStatus.REFUNDED:
      return {
        outcome: PaymentUiOutcome.REFUNDED,
        title: "Payment refunded",
        message: customerMessage?.trim() || "Your payment has been refunded.",
        action: "NONE",
        domainStatus: domain,
      };
    default:
      return {
        outcome: PaymentUiOutcome.RETRYABLE_FAILURE,
        title: "Payment could not be completed",
        message: customerMessage?.trim() || "Payment could not be completed. Please try again.",
        action: "RETRY",
        domainStatus: domain,
      };
  }
}
