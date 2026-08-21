import { useEffect, useMemo, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  bookingApi,
  customerBookingDisplayTitle,
  getCustomerBookingTechnicianProfile,
  isBookingGpsTrackable,
  queryKeys,
  readServiceAddressIdFromBookingMetadata,
} from "@oorjaman/api";
import { colors, spacing } from "@oorjaman/config";
import { formatDisplayDateTime } from "@oorjaman/utils";
import {
  Card,
  EmptyStateCard,
  ErrorStateCard,
  modalBodyInsetStyle,
  ModalCloseButton,
  Screen,
  SCREEN_EDGES_MODAL,
  SkeletonStack,
  useModalStackHeader,
} from "@oorjaman/ui";
import { fontFamily, fontSize } from "../constants/fonts";
import { BookingLiveTrackView } from "../components/booking-live-track-view";
import { SupportChatHeaderButton } from "../components/help-header-button";
import { useServiceDestinationCoords } from "../lib/use-service-destination-coords";
import { supabase } from "../lib/supabase";

export default function TrackTechnicianScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const bookingId = Array.isArray(id) ? id[0] : id;

  const bookingQ = useQuery({
    queryKey: bookingId ? queryKeys.bookings.detail(bookingId) : [],
    queryFn: () => bookingApi.getBookingById(supabase!, bookingId!),
    enabled: Boolean(supabase && bookingId),
    refetchInterval: (query) => {
      const row = query.state.data;
      return row && isBookingGpsTrackable(row) ? 15_000 : false;
    },
    refetchIntervalInBackground: false,
  });

  const trackable = Boolean(bookingQ.data && isBookingGpsTrackable(bookingQ.data));

  const serviceAddressId = useMemo(
    () =>
      bookingQ.data ? readServiceAddressIdFromBookingMetadata(bookingQ.data.metadata) : null,
    [bookingQ.data],
  );

  const destinationQ = useServiceDestinationCoords(serviceAddressId);

  const modalHeader = useModalStackHeader({
    title: bookingQ.data ? customerBookingDisplayTitle(bookingQ.data) : "Track technician",
    subtitle: bookingQ.data
      ? formatDisplayDateTime(bookingQ.data.scheduled_start)
      : "Live map for your visit",
    onClose: () => router.back(),
    closeAccessibilityLabel: "Close tracking",
    showClose: false,
    trailing: (
      <View style={styles.headerTrailing}>
        <SupportChatHeaderButton />
        <ModalCloseButton onPress={() => router.back()} accessibilityLabel="Close tracking" />
      </View>
    ),
  });

  const techLocQ = useQuery({
    queryKey: bookingId ? queryKeys.bookings.technicianLastLocation(bookingId) : [],
    queryFn: () => bookingApi.getLastTechnicianLocationForBooking(supabase!, bookingId!),
    enabled: Boolean(supabase && bookingId && trackable),
    refetchInterval: trackable ? 15_000 : false,
    refetchIntervalInBackground: false,
  });

  const techProfileQ = useQuery({
    queryKey: bookingId ? queryKeys.bookings.technicianProfile(bookingId) : [],
    queryFn: () => getCustomerBookingTechnicianProfile(supabase!, bookingId!),
    enabled: Boolean(supabase && bookingId && trackable),
  });

  const customerCoords = destinationQ.coords;

  const technicianCoords = useMemo(() => {
    const row = techLocQ.data;
    if (!row) return null;
    return { latitude: row.lat, longitude: row.lng };
  }, [techLocQ.data]);

  if (!supabase || !bookingId) {
    return (
      <Screen padded={false} edges={SCREEN_EDGES_MODAL}>
        {modalHeader}
        <View style={modalBodyInsetStyle}>
          <Text style={styles.muted}>Missing booking or Supabase configuration.</Text>
        </View>
      </Screen>
    );
  }

  if (
    bookingQ.isPending ||
    (trackable && (techLocQ.isPending || destinationQ.isPending))
  ) {
    return (
      <Screen padded={false} edges={SCREEN_EDGES_MODAL}>
        {modalHeader}
        <View style={modalBodyInsetStyle}>
          <Card variant="muted" padded>
            <SkeletonStack rows={4} />
          </Card>
        </View>
      </Screen>
    );
  }

  if (techLocQ.isError) {
    return (
      <Screen padded={false} edges={SCREEN_EDGES_MODAL}>
        {modalHeader}
        <View style={modalBodyInsetStyle}>
          <ErrorStateCard
            title="Couldn't load location"
            message={(techLocQ.error as Error).message}
            onRetry={() => void techLocQ.refetch()}
            retryLabel="Retry"
          />
        </View>
      </Screen>
    );
  }

  if (Platform.OS === "web") {
    return (
      <Screen padded={false} edges={SCREEN_EDGES_MODAL}>
        {modalHeader}
        <View style={modalBodyInsetStyle}>
          <Text style={styles.body}>Maps are available on the iOS and Android apps.</Text>
        </View>
      </Screen>
    );
  }

  if (bookingQ.data && !trackable) {
    const b = bookingQ.data;
    const endedCopy =
      b.status === "in_progress"
        ? {
            title: "Visit in progress",
            description:
              "Your technician has arrived and started the visit. Live map tracking is only available while they are en route.",
          }
        : b.status === "completed"
          ? {
              title: "Visit completed",
              description: "This visit is finished. Tracking is no longer available.",
            }
          : {
              title: "Tracking not active",
              description:
                "Live map opens when your technician marks themselves en route in the partner app.",
            };

    return (
      <Screen padded={false} edges={SCREEN_EDGES_MODAL}>
        {modalHeader}
        <View style={modalBodyInsetStyle}>
          <EmptyStateCard title={endedCopy.title} description={endedCopy.description} />
        </View>
      </Screen>
    );
  }

  return (
    <BookingLiveTrackView
      modalHeader={modalHeader}
      customerCoords={customerCoords}
      technicianCoords={technicianCoords}
      recordedAt={techLocQ.data?.recorded_at ?? null}
      technicianProfile={techProfileQ.data}
      profileLoading={techProfileQ.isPending}
    />
  );
}

const styles = StyleSheet.create({
  headerTrailing: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  body: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    color: colors.foreground,
  },
  muted: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    color: colors.mutedForeground,
  },
});
