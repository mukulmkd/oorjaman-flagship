import { StyleSheet, Text, View } from "react-native";
import {
  amcAllowanceExhaustedPromptMessage,
  amcAwaitingPartnerAssignmentMessage,
  amcUrgentCleaningSupportHint,
  amcNoPlanPromptMessage,
  amcVisitBookingGateMessage,
  type AmcAwaitingPartnerAssignmentGate,
  type AmcVisitBookingGate,
} from "@oorjaman/api";
import { formatDisplayDate } from "@oorjaman/utils";
import { colors, spacing } from "@oorjaman/config";
import { Button, Card } from "@oorjaman/ui";
import { fontFamily, fontSize } from "../constants/fonts";

type Props = {
  gate: AmcVisitBookingGate;
  onBookOneTime: () => void;
  onAmcPrimary: () => void;
  onBack: () => void;
};

function gateCopy(gate: AmcVisitBookingGate): { title: string; body: string; amcLabel: string; oneTimeLabel: string } {
  if (gate.kind === "none") {
    return {
      title: "How would you like to book?",
      body: amcNoPlanPromptMessage(),
      amcLabel: "Get AMC plan",
      oneTimeLabel: "Book one-time visit",
    };
  }
  if (gate.kind === "allowance_exhausted") {
    return {
      title: "AMC visits used",
      body: amcAllowanceExhaustedPromptMessage(gate),
      amcLabel: "Renew AMC",
      oneTimeLabel: "Proceed with normal booking",
    };
  }
  if (gate.kind === "trialing" || (gate.kind === "awaiting_setup" && gate.reason === "payment")) {
    return {
      title: "AMC plan for this address",
      body:
        amcVisitBookingGateMessage(gate) ??
        "Complete AMC payment to schedule your included visits, or book a one-time visit at the standard rate.",
      amcLabel: "Complete AMC plan",
      oneTimeLabel: "Book normal visit",
    };
  }
  return {
    title: "AMC plan for this address",
    body: "You have an AMC on this address. Complete your AMC plan or book a one-time visit.",
    amcLabel: "Complete AMC plan",
    oneTimeLabel: "Book normal visit",
  };
}

type AwaitingPartnerProps = {
  gate: AmcAwaitingPartnerAssignmentGate;
  onViewAmc: () => void;
  onContactSupport: () => void;
  onBack: () => void;
};

export function BookVisitAmcAwaitingPartnerGate({
  gate,
  onViewAmc,
  onContactSupport,
  onBack,
}: AwaitingPartnerProps) {
  const visits = gate.subscription.visits_included;
  const visitLine =
    visits != null && visits > 0
      ? `${visits} included visit${visits === 1 ? "" : "s"} per contract year`
      : null;

  return (
    <View style={awaitingStyles.screen}>
      <Text style={awaitingStyles.kicker}>AMC activation</Text>
      <Text style={awaitingStyles.title}>Assigning your AMC partner</Text>
      <Text style={awaitingStyles.body}>{amcAwaitingPartnerAssignmentMessage(gate)}</Text>

      <View style={awaitingStyles.planBlock}>
        <Text style={awaitingStyles.planLabel}>Your plan</Text>
        <Text style={awaitingStyles.planName}>{gate.subscription.plan_name}</Text>
        {visitLine ? <Text style={awaitingStyles.planMeta}>{visitLine}</Text> : null}
        <Text style={awaitingStyles.planMeta}>Active through {formatDisplayDate(gate.subscription.ends_at)}</Text>
      </View>

      <View style={awaitingStyles.actions}>
        <Button variant="primary" size="md" onPress={onViewAmc}>
          View my AMC
        </Button>
        <Button variant="outline" size="md" onPress={onContactSupport}>
          Contact support
        </Button>
        <Text style={awaitingStyles.supportHint}>{amcUrgentCleaningSupportHint}</Text>
        <Button variant="ghost" size="md" onPress={onBack}>
          Go back
        </Button>
      </View>
    </View>
  );
}

export function BookVisitAmcChoiceGate({ gate, onBookOneTime, onAmcPrimary, onBack }: Props) {
  const copy = gateCopy(gate);
  const amcFirst = gate.kind === "none";

  return (
    <Card variant="elevated" padded>
      <Text style={styles.title}>{copy.title}</Text>
      <Text style={styles.body}>{copy.body}</Text>
      <View style={styles.actions}>
        {amcFirst ? (
          <>
            <Button variant="primary" size="md" onPress={onAmcPrimary}>
              {copy.amcLabel}
            </Button>
            <Button variant="outline" size="md" onPress={onBookOneTime}>
              {copy.oneTimeLabel}
            </Button>
          </>
        ) : (
          <>
            <Button variant="primary" size="md" onPress={onBookOneTime}>
              {copy.oneTimeLabel}
            </Button>
            <Button variant="outline" size="md" onPress={onAmcPrimary}>
              {copy.amcLabel}
            </Button>
          </>
        )}
        <Button variant="ghost" size="md" onPress={onBack}>
          Go back
        </Button>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.lg,
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  body: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: 22,
    color: colors.mutedForeground,
  },
  actions: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
});

const awaitingStyles = StyleSheet.create({
  screen: {
    flex: 1,
    gap: spacing.sm,
  },
  kicker: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    color: colors.foreground,
  },
  body: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    lineHeight: 22,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
  },
  planBlock: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  planLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  planName: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.md,
    color: colors.foreground,
  },
  planMeta: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
  },
  actions: {
    gap: spacing.sm,
  },
  supportHint: {
    marginTop: -spacing.xs,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    lineHeight: 16,
    color: colors.mutedForeground,
    textAlign: "center",
  },
});
