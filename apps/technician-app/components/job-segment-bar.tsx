import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { JobListSegment } from "../lib/job-list-filters";
import { JOB_LIST_SEGMENTS } from "../lib/job-list-filters";
import { colors, spacing } from "@oorjaman/config";
import { fontFamily, fontSize } from "../constants/fonts";

export function JobSegmentBar({
  value,
  onChange,
  counts,
}: {
  value: JobListSegment;
  onChange: (s: JobListSegment) => void;
  counts?: Partial<Record<JobListSegment, number>>;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityRole="tablist"
    >
      {JOB_LIST_SEGMENTS.map((seg) => {
        const on = value === seg.id;
        const n = counts?.[seg.id];
        return (
          <Pressable
            key={seg.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(seg.id)}
            style={[styles.chip, on && styles.chipOn]}
          >
            <Text style={[styles.chipText, on && styles.chipTextOn]}>
              {seg.label}
              {n != null && n > 0 ? ` (${n})` : ""}
            </Text>
          </Pressable>
        );
      })}
      <View style={styles.trail} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  trail: {
    width: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.muted,
  },
  chipOn: {
    backgroundColor: colors.primaryMuted,
    borderColor: colors.primary,
  },
  chipText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
  },
  chipTextOn: {
    color: colors.primary,
  },
});
