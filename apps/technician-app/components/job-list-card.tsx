import { Pressable, StyleSheet, Text, View } from "react-native";
import type { BookingRow, BookingStatus } from "@oorjaman/api";
import { Card } from "@oorjaman/ui";
import { colors, spacing } from "@oorjaman/config";
import { jobStatusLabel, jobUiBucket } from "../lib/job-status";
import { formatJobWhen, opsWatchLabel, serviceForLabel, stringifyAddress } from "../lib/booking-display";
import { fontFamily, fontSize } from "../constants/fonts";

function StatusChip({ status }: { status: BookingStatus }) {
  const bucket = jobUiBucket(status);
  const label = jobStatusLabel(status);
  const chipStyles =
    bucket === "upcoming"
      ? styles.chipUpcoming
      : bucket === "active"
        ? styles.chipActive
        : bucket === "done"
          ? styles.chipDone
          : styles.chipEnded;

  return (
    <View style={[styles.chip, chipStyles]}>
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

export function JobListCard({
  item,
  onPress,
  cta = "View job",
}: {
  item: BookingRow;
  onPress: () => void;
  cta?: string;
}) {
  const opsWatch = opsWatchLabel(item);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint="Opens job details"
      onPress={onPress}
      style={({ pressed }) => [styles.rowPress, pressed && styles.rowPressed]}
    >
      <Card variant="elevated" padded>
        <View style={styles.rowInner}>
          <View style={styles.rowTop}>
            <Text style={styles.ref}>{item.reference_code}</Text>
            <StatusChip status={item.status} />
          </View>
          <Text style={styles.when}>{formatJobWhen(item.scheduled_start)}</Text>
          <Text style={styles.address} numberOfLines={2}>
            {stringifyAddress(item.service_site_address)}
          </Text>
          <Text style={styles.serviceFor} numberOfLines={1}>
            For: {serviceForLabel(item)}
          </Text>
          {opsWatch ? <Text style={styles.opsWatch}>{opsWatch}</Text> : null}
          <Text style={styles.cta}>{cta}</Text>
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  rowPress: {
    borderRadius: 18,
    minHeight: 112,
  },
  rowPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.995 }],
  },
  rowInner: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  ref: {
    flex: 1,
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
    letterSpacing: -0.2,
    color: colors.foreground,
  },
  when: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.foreground,
  },
  address: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.mutedForeground,
  },
  serviceFor: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: colors.mutedForeground,
  },
  opsWatch: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.xs,
    color: colors.destructive,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  cta: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    color: colors.primary,
    marginTop: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.xs,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: colors.foreground,
  },
  chipUpcoming: {
    backgroundColor: colors.primaryMuted,
    borderColor: colors.primaryBorder,
  },
  chipActive: {
    backgroundColor: colors.primaryMuted,
    borderColor: colors.primary,
  },
  chipDone: {
    backgroundColor: colors.elevated,
    borderColor: colors.primary,
  },
  chipEnded: {
    backgroundColor: colors.muted,
    borderColor: colors.border,
  },
});
