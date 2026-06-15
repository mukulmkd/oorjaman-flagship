import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { bookingApi, queryKeys } from "@oorjaman/api";
import { colors, spacing } from "@oorjaman/config";
import { formatDisplayDateTime } from "@oorjaman/utils";
import { formatDayChip, listSelectableDayKeys, slotsForDay } from "@oorjaman/utils";
import {
  Button,
  Card,
  ErrorStateCard,
  modalBodyInsetStyle,
  modalScrollContentStyle,
  Screen,
  SCREEN_EDGES_MODAL,
  useModalStackHeader,
} from "@oorjaman/ui";
import { fontFamily, fontSize } from "../constants/fonts";
import { supabase } from "../lib/supabase";

export default function RescheduleBookingScreen() {
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const bookingId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [now] = useState(() => new Date());
  const [dayKey, setDayKey] = useState<string | null>(null);
  const [slotId, setSlotId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: bookingId ? queryKeys.bookings.detail(bookingId) : [],
    queryFn: () => bookingApi.getBookingById(supabase!, bookingId!),
    enabled: Boolean(supabase && bookingId),
  });

  const days = useMemo(() => listSelectableDayKeys(now, 14), [now]);
  const slots = useMemo(() => (dayKey ? slotsForDay(dayKey, now) : []), [dayKey, now]);
  const chosenSlot = slots.find((s) => s.id === slotId) ?? null;

  const modalHeader = useModalStackHeader({
    title: "Reschedule",
    subtitle: query.data
      ? `Current visit: ${formatDisplayDateTime(query.data.scheduled_start)}`
      : undefined,
    onClose: () => router.back(),
    closeAccessibilityLabel: "Close reschedule",
  });

  const rescheduleMut = useMutation({
    mutationFn: async () => {
      if (!bookingId || !chosenSlot) throw new Error("Choose a date and time.");
      return bookingApi.customerRescheduleBooking(
        supabase!,
        bookingId,
        chosenSlot.scheduledStart,
        chosenSlot.scheduledEnd,
      );
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.bookings.all() });
      router.back();
    },
  });

  if (!supabase || !bookingId) {
    return (
      <Screen padded={false} edges={SCREEN_EDGES_MODAL}>
        {modalHeader}
        <View style={modalBodyInsetStyle}>
          <Text style={styles.muted}>Missing booking context.</Text>
        </View>
      </Screen>
    );
  }

  if (query.isPending) {
    return (
      <Screen padded={false} edges={SCREEN_EDGES_MODAL}>
        {modalHeader}
        <View style={modalBodyInsetStyle}>
          <Card variant="muted" padded>
            <Text style={styles.muted}>Loading booking…</Text>
          </Card>
        </View>
      </Screen>
    );
  }

  if (query.isError || !query.data) {
    return (
      <Screen padded={false} edges={SCREEN_EDGES_MODAL}>
        {modalHeader}
        <View style={modalBodyInsetStyle}>
          <ErrorStateCard
            title="Couldn't open reschedule"
            message={query.isError ? (query.error as Error).message : "Booking not found."}
            onRetry={() => void query.refetch()}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false} edges={SCREEN_EDGES_MODAL}>
      {modalHeader}
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        <Card variant="elevated" padded>
          <Text style={styles.section}>Select day</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {days.map((d) => {
              const selected = d === dayKey;
              return (
                <Pressable
                  key={d}
                  onPress={() => {
                    setDayKey(d);
                    setSlotId(null);
                  }}
                  style={[styles.dayChip, selected && styles.dayChipOn]}
                >
                  <Text style={[styles.dayText, selected && styles.dayTextOn]}>{formatDayChip(d)}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Card>

        <Card variant="elevated" padded>
          <Text style={styles.section}>Select time</Text>
          {slots.length === 0 ? (
            <Text style={styles.muted}>Choose a day to view time slots.</Text>
          ) : (
            <View style={styles.slotList}>
              {slots.map((s) => {
                const selected = s.id === slotId;
                return (
                  <Pressable key={s.id} onPress={() => setSlotId(s.id)} style={[styles.slot, selected && styles.slotOn]}>
                    <Text style={[styles.slotText, selected && styles.slotTextOn]}>{s.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </Card>

        {rescheduleMut.isError ? (
          <Card variant="muted" padded>
            <Text style={styles.error}>{(rescheduleMut.error as Error).message}</Text>
          </Card>
        ) : null}

        <View style={styles.actions}>
          <Button variant="outline" size="md" onPress={() => router.back()}>
            Cancel
          </Button>
          <Button variant="primary" size="md" loading={rescheduleMut.isPending} disabled={!chosenSlot} onPress={() => void rescheduleMut.mutateAsync()}>
            Confirm reschedule
          </Button>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { ...modalScrollContentStyle, gap: spacing.sm },
  title: { fontFamily: fontFamily.semiBold, fontSize: fontSize.lg, color: colors.foreground },
  section: { fontFamily: fontFamily.medium, fontSize: fontSize.sm, color: colors.mutedForeground, marginBottom: spacing.sm },
  muted: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.mutedForeground },
  dayChip: {
    marginRight: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.muted,
  },
  dayChipOn: { backgroundColor: colors.primaryMuted, borderColor: colors.primaryBorder },
  dayText: { fontFamily: fontFamily.medium, fontSize: fontSize.sm, color: colors.foreground },
  dayTextOn: { color: colors.primaryBorder },
  slotList: { gap: spacing.sm },
  slot: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
  },
  slotOn: { borderColor: colors.primaryBorder, backgroundColor: colors.primaryMuted },
  slotText: { fontFamily: fontFamily.medium, fontSize: fontSize.md, color: colors.foreground },
  slotTextOn: { color: colors.primaryBorder },
  actions: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm, marginTop: spacing.sm, marginBottom: spacing.xl },
  error: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.destructive },
});
