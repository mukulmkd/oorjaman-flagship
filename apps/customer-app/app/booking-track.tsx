import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, type Region } from "react-native-maps";
import { useQuery } from "@tanstack/react-query";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { bookingApi, customerApi, queryKeys } from "@oorjaman/api";
import { colors, spacing } from "@oorjaman/config";
import { formatDisplayDateTime } from "@oorjaman/utils";
import {
  Card,
  ErrorStateCard,
  modalBodyInsetStyle,
  ModalCloseButton,
  Screen,
  SCREEN_EDGES_BENEATH_NATIVE_HEADER,
  SkeletonStack,
  useModalStackHeader,
} from "@oorjaman/ui";
import { fontFamily, fontSize, fontWeight } from "../constants/fonts";
import { SupportChatHeaderButton } from "../components/help-header-button";
import { supabase } from "../lib/supabase";

function regionFromPoints(
  points: { latitude: number; longitude: number }[],
  fallback: Region,
): Region {
  if (points.length === 0) return fallback;
  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const midLat = (minLat + maxLat) / 2;
  const midLng = (minLng + maxLng) / 2;
  const pad = 1.35;
  const latDelta = Math.max((maxLat - minLat) * pad, 0.04);
  const lngDelta = Math.max((maxLng - minLng) * pad, 0.04);
  return {
    latitude: midLat,
    longitude: midLng,
    latitudeDelta: latDelta,
    longitudeDelta: lngDelta,
  };
}

const INDIA_FALLBACK: Region = {
  latitude: 20.5937,
  longitude: 78.9629,
  latitudeDelta: 12,
  longitudeDelta: 12,
};

export default function TrackTechnicianScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const bookingId = Array.isArray(id) ? id[0] : id;
  const mapRef = useRef<MapView | null>(null);

  const [deviceCoords, setDeviceCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  const bookingQ = useQuery({
    queryKey: bookingId ? queryKeys.bookings.detail(bookingId) : [],
    queryFn: () => bookingApi.getBookingById(supabase!, bookingId!),
    enabled: Boolean(supabase && bookingId),
  });

  const modalHeader = useModalStackHeader({
    title: "Track technician",
    subtitle: bookingQ.data?.reference_code
      ? `Booking ${bookingQ.data.reference_code}`
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

  const custQ = useQuery({
    queryKey: queryKeys.customers.mine(),
    queryFn: () => customerApi.getMyCustomer(supabase!),
    enabled: Boolean(supabase),
  });

  const techLocQ = useQuery({
    queryKey: bookingId ? queryKeys.bookings.technicianLastLocation(bookingId) : [],
    queryFn: () => bookingApi.getLastTechnicianLocationForBooking(supabase!, bookingId!),
    enabled: Boolean(supabase && bookingId),
  });

  useEffect(() => {
    if (Platform.OS === "web") return;

    let cancelled = false;

    void (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (cancelled || status !== "granted") return;
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) return;
        setDeviceCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      } catch {
        // Fall back to saved profile coordinates below.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const customerCoords = useMemo(() => {
    if (deviceCoords) return deviceCoords;
    const c = custQ.data;
    if (
      c?.service_lat != null &&
      c?.service_lng != null &&
      Number.isFinite(c.service_lat) &&
      Number.isFinite(c.service_lng)
    ) {
      return { latitude: c.service_lat, longitude: c.service_lng };
    }
    return null;
  }, [custQ.data, deviceCoords]);

  const technicianCoords = useMemo(() => {
    const row = techLocQ.data;
    if (!row) return null;
    return { latitude: row.lat, longitude: row.lng };
  }, [techLocQ.data]);

  const mapRegion = useMemo(() => {
    const pts: { latitude: number; longitude: number }[] = [];
    if (customerCoords) pts.push(customerCoords);
    if (technicianCoords) pts.push(technicianCoords);
    return regionFromPoints(pts, INDIA_FALLBACK);
  }, [customerCoords, technicianCoords]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    const pts: { latitude: number; longitude: number }[] = [];
    if (customerCoords) pts.push(customerCoords);
    if (technicianCoords) pts.push(technicianCoords);
    if (pts.length === 0) return;
    const handle = setTimeout(() => {
      mapRef.current?.fitToCoordinates(pts, {
        edgePadding: { top: 100, right: 48, bottom: 180, left: 48 },
        animated: true,
      });
    }, 300);
    return () => clearTimeout(handle);
  }, [customerCoords, technicianCoords]);

  if (!supabase || !bookingId) {
    return (
      <Screen padded={false} edges={SCREEN_EDGES_BENEATH_NATIVE_HEADER}>
        {modalHeader}
        <View style={modalBodyInsetStyle}>
          <Text style={styles.muted}>Missing booking or Supabase configuration.</Text>
        </View>
      </Screen>
    );
  }

  if (techLocQ.isPending || custQ.isPending) {
    return (
      <Screen padded={false} edges={SCREEN_EDGES_BENEATH_NATIVE_HEADER}>
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
      <Screen padded={false} edges={SCREEN_EDGES_BENEATH_NATIVE_HEADER}>
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
      <Screen padded={false} edges={SCREEN_EDGES_BENEATH_NATIVE_HEADER}>
        {modalHeader}
        <View style={modalBodyInsetStyle}>
          <Text style={styles.body}>Maps are available on the iOS and Android apps.</Text>
        </View>
      </Screen>
    );
  }

  const recordedLabel = techLocQ.data?.recorded_at
    ? formatDisplayDateTime(techLocQ.data.recorded_at)
    : null;

  return (
    <View style={styles.container}>
      {modalHeader}
      <MapView ref={mapRef} style={styles.map} initialRegion={mapRegion}>
        {customerCoords ? (
          <Marker coordinate={customerCoords} title="You" pinColor={colors.primary} />
        ) : null}
        {technicianCoords ? (
          <Marker coordinate={technicianCoords} title="Technician" pinColor="#2563eb" />
        ) : null}
      </MapView>

      <View style={styles.legendWrap}>
        <Card variant="elevated" padded>
          <Text style={styles.legendTitle}>Last known technician location</Text>
          {recordedLabel ? <Text style={styles.legendMeta}>Recorded {recordedLabel} IST</Text> : null}
          {!technicianCoords ? (
            <Text style={styles.legendHint}>
              No GPS samples yet - tracking starts when the visit is in progress.
            </Text>
          ) : null}
          {!customerCoords ? (
            <Text style={styles.legendHint}>
              Allow location or set your service address on your profile to show where you are.
            </Text>
          ) : null}
        </Card>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerTrailing: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  map: {
    flex: 1,
    minHeight: 280,
  },
  legendWrap: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  legendTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.md,
    color: colors.foreground,
  },
  legendMeta: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
    marginTop: spacing["3xs"],
  },
  legendHint: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
    marginTop: spacing.sm,
    lineHeight: 18,
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
