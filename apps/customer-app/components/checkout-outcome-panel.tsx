import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { formatInrFromCents, type PaymentRow } from "@oorjaman/api";
import { colors, spacing } from "@oorjaman/config";
import { Button, Card } from "@oorjaman/ui";
import { fontFamily, fontSize } from "../constants/fonts";
import { PriceGstBreakdown } from "./price-gst-breakdown";

export type CheckoutOutcomePhase = "confirming" | "success" | "failed";

const DEFAULT_CONFIRM_SECONDS = 45;

/** Customer-facing payment breakdown on the confirm / outcome screen. */
export type CheckoutPaymentDetails = {
  /** e.g. Paid · Pay after service */
  statusLabel: string;
  /** e.g. Razorpay · Demo payment · Pay after visit */
  paidViaLabel: string;
  /** Instrument when known (UPI, Card, …) */
  methodLabel?: string | null;
  orderId?: string | null;
  gatewayPaymentId?: string | null;
};

function formatPaymentMethodLabel(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const m = raw.trim().toLowerCase();
  if (m === "upi" || m.includes("upi")) return "UPI";
  if (m === "card" || m.includes("card")) return "Card";
  if (m === "netbanking" || m.includes("netbanking") || m.includes("net banking")) return "Net banking";
  if (m === "wallet" || m.includes("wallet")) return "Wallet";
  if (m === "emi") return "EMI";
  if (m === "paylater" || m.includes("pay later")) return "Pay later (Razorpay)";
  return raw.trim();
}

export function buildCheckoutPaymentDetails(input: {
  timing: "prepaid" | "postpaid";
  payment?: Pick<
    PaymentRow,
    | "provider"
    | "payment_method"
    | "method_type"
    | "razorpay_order_id"
    | "razorpay_payment_id"
    | "collection_channel"
  > | null;
  razorpayPaymentIdFallback?: string | null;
  razorpayOrderIdFallback?: string | null;
}): CheckoutPaymentDetails {
  if (input.timing === "postpaid") {
    return {
      statusLabel: "Pay after service",
      paidViaLabel: "No charge yet — pay when cleaning is done",
    };
  }

  const p = input.payment;
  const provider = p?.provider ?? "razorpay";
  let paidViaLabel = "Online payment";
  if (provider === "razorpay") paidViaLabel = "Razorpay";
  else if (provider === "dummy") paidViaLabel = "Demo payment";
  else if (provider === "partner_collected") paidViaLabel = "Collected by partner";

  const methodLabel = formatPaymentMethodLabel(p?.payment_method ?? p?.method_type ?? null);

  return {
    statusLabel: "Paid",
    paidViaLabel,
    methodLabel,
    orderId: p?.razorpay_order_id ?? input.razorpayOrderIdFallback ?? null,
    gatewayPaymentId: p?.razorpay_payment_id ?? input.razorpayPaymentIdFallback ?? null,
  };
}

type Props = {
  phase: CheckoutOutcomePhase;
  /** Inclusive total in paise */
  amountPaise: number;
  titleSuccess: string;
  titleFailed: string;
  bodySuccess?: string | null;
  bodyFailed?: string | null;
  /** Seconds to count down while confirming (matches poll timeout). */
  confirmSeconds?: number;
  referenceLabel?: string | null;
  paymentDetails?: CheckoutPaymentDetails | null;
  onPrimarySuccess: () => void;
  primarySuccessLabel?: string;
  onTryAgain: () => void;
  onBackFromFailed: () => void;
};

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} selectable>
        {value}
      </Text>
    </View>
  );
}

export function CheckoutOutcomePanel({
  phase,
  amountPaise,
  titleSuccess,
  titleFailed,
  bodySuccess,
  bodyFailed,
  confirmSeconds = DEFAULT_CONFIRM_SECONDS,
  referenceLabel,
  paymentDetails,
  onPrimarySuccess,
  primarySuccessLabel = "View My bookings",
  onTryAgain,
  onBackFromFailed,
}: Props) {
  const [secondsLeft, setSecondsLeft] = useState(confirmSeconds);

  useEffect(() => {
    if (phase !== "confirming") return;
    setSecondsLeft(confirmSeconds);
    const id = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [phase, confirmSeconds]);

  const showPaymentHow = phase === "success" && paymentDetails != null;

  return (
    <View style={styles.root}>
      {phase === "confirming" ? (
        <>
          <Text style={styles.title}>Confirming payment</Text>
          <Text style={styles.body}>
            Please wait while we confirm your payment with the bank. This usually takes a few seconds.
          </Text>
          <View style={styles.timerWrap}>
            <Text style={styles.timerValue}>{secondsLeft}s</Text>
            <Text style={styles.timerHint}>Remaining</Text>
          </View>
        </>
      ) : null}

      {phase === "success" ? (
        <>
          <Text style={styles.titleSuccess}>{titleSuccess}</Text>
          {bodySuccess ? <Text style={styles.body}>{bodySuccess}</Text> : null}
        </>
      ) : null}

      {phase === "failed" ? (
        <>
          <Text style={styles.titleFailed}>{titleFailed}</Text>
          <Text style={styles.body}>
            {bodyFailed?.trim() ||
              "Payment did not complete. Nothing was confirmed — you can try again when you are ready."}
          </Text>
        </>
      ) : null}

      <View style={styles.summaryWrap}>
        <Card variant="elevated" padded>
          <Text style={styles.summaryLabel}>Payment summary</Text>
          <Text style={styles.summaryAmount}>{formatInrFromCents(amountPaise)}</Text>
          <PriceGstBreakdown totalPaise={amountPaise} />

          {showPaymentHow ? (
            <View style={styles.howPaidBlock}>
              <Text style={styles.howPaidTitle}>How you paid</Text>
              <DetailRow label="Status" value={paymentDetails.statusLabel} />
              <DetailRow label="Paid via" value={paymentDetails.paidViaLabel} />
              {paymentDetails.methodLabel ? (
                <DetailRow label="Method" value={paymentDetails.methodLabel} />
              ) : null}
              {paymentDetails.orderId ? (
                <DetailRow label="Order ID" value={paymentDetails.orderId} />
              ) : null}
              {paymentDetails.gatewayPaymentId ? (
                <DetailRow label="Payment ID" value={paymentDetails.gatewayPaymentId} />
              ) : null}
            </View>
          ) : null}

          {referenceLabel ? <Text style={styles.refLine}>{referenceLabel}</Text> : null}
        </Card>
      </View>

      {phase === "success" ? (
        <Button variant="primary" size="md" onPress={onPrimarySuccess}>
          {primarySuccessLabel}
        </Button>
      ) : null}

      {phase === "failed" ? (
        <View style={styles.actions}>
          <Button variant="primary" size="md" onPress={onTryAgain}>
            Try again
          </Button>
          <Button variant="outline" size="md" onPress={onBackFromFailed}>
            Back
          </Button>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    gap: spacing.md,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    color: colors.foreground,
  },
  titleSuccess: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    color: colors.primary,
  },
  titleFailed: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    color: colors.destructive,
  },
  body: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    lineHeight: 22,
    color: colors.mutedForeground,
  },
  timerWrap: {
    alignItems: "center",
    paddingVertical: spacing.lg,
    gap: spacing.xs,
  },
  timerValue: {
    fontFamily: fontFamily.bold,
    fontSize: 40,
    color: colors.foreground,
  },
  timerHint: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  summaryWrap: {
    marginTop: spacing.sm,
  },
  summaryLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
    marginBottom: spacing.xs,
  },
  summaryAmount: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  howPaidBlock: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  howPaidTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  detailRow: {
    gap: 2,
  },
  detailLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  detailValue: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.foreground,
    lineHeight: 20,
  },
  refLine: {
    marginTop: spacing.sm,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
  },
  actions: {
    gap: spacing.sm,
  },
});
