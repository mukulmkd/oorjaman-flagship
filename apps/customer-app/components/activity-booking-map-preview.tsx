import { useEffect, useMemo, useRef } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE, type Region } from "react-native-maps";
import { useQuery } from "@tanstack/react-query";
import { bookingApi, queryKeys } from "@oorjaman/api";
import { colors, spacing } from "@oorjaman/config";
import { formatDisplayDateTime } from "@oorjaman/utils";
import { Card } from "@oorjaman/ui";
import { fontFamily, fontSize } from "../constants/fonts";
import { supabase } from "../lib/supabase";

const INDIA_FALLBACK: Region = {
  latitude: 20.5937,
  longitude: 78.9629,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

type Props = {
  bookingId: string;
  referenceCode: string;
  scheduledStart: string;
  /** When false, pauses GPS polling (tab in background). */
  liveUpdatesEnabled?: boolean;
  onOpenFullMap: () => void;
};

export function ActivityBookingMapPreview({
  bookingId,
  referenceCode,
  scheduledStart,
  liveUpdatesEnabled = true,
  onOpenFullMap,
}: Props) {
  const mapRef = useRef<MapView | null>(null);
  const hasCenteredMap = useRef(false);

  useEffect(() => {
    hasCenteredMap.current = false;
  }, [bookingId]);

  const techLocQ = useQuery({
    queryKey: queryKeys.bookings.technicianLastLocation(bookingId),
    queryFn: () => bookingApi.getLastTechnicianLocationForBooking(supabase!, bookingId),
    enabled: Boolean(supabase && bookingId),
    refetchInterval: liveUpdatesEnabled ? 15_000 : false,
    refetchIntervalInBackground: false,
  });

  const techPoint = useMemo(() => {
    const row = techLocQ.data;
    if (!row) return null;
    return { latitude: row.lat, longitude: row.lng };
  }, [techLocQ.data]);

  const region = useMemo((): Region => {
    if (!techPoint) return INDIA_FALLBACK;
    return {
      latitude: techPoint.latitude,
      longitude: techPoint.longitude,
      latitudeDelta: 0.04,
      longitudeDelta: 0.04,
    };
  }, [techPoint]);

  useEffect(() => {
    if (!techPoint || !mapRef.current) return;
    if (!hasCenteredMap.current) {
      hasCenteredMap.current = true;
      mapRef.current.animateToRegion(region, 400);
    }
  }, [techPoint, region]);

  if (Platform.OS === "web") {
    return (
      <Card variant="muted" padded>
        <Text style={styles.title}>Technician location</Text>
        <Text style={styles.meta}>
          Open this booking on your phone to see the live map for {referenceCode}.
        </Text>
        <Pressable accessibilityRole="button" onPress={onOpenFullMap} style={styles.linkBtn}>
          <Text style={styles.linkText}>Open full map</Text>
        </Pressable>
      </Card>
    );
  }

  return (
    <View style={styles.cardWrap}>
    <Card variant="elevated" padded>
      <Text style={styles.title}>Technician on the way</Text>
      <Text style={styles.meta}>
        {referenceCode} · {formatDisplayDateTime(scheduledStart)}
      </Text>
      <View style={styles.mapShell}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          initialRegion={region}
          showsUserLocation={false}
          scrollEnabled={false}
          zoomEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
        >
          {techPoint ? (
            <Marker coordinate={techPoint} title="Technician" pinColor={colors.primary} />
          ) : null}
        </MapView>
        {!techPoint && !techLocQ.isPending ? (
          <View style={styles.mapOverlay}>
            <Text style={styles.overlayText}>Waiting for the first GPS update…</Text>
          </View>
        ) : null}
      </View>
      <Pressable accessibilityRole="button" onPress={onOpenFullMap} style={styles.linkBtn}>
        <Text style={styles.linkText}>Open full map</Text>
      </Pressable>
    </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  cardWrap: {
    gap: spacing.sm,
  },
  title: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.md,
    color: colors.foreground,
  },
  meta: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
    lineHeight: 20,
  },
  mapShell: {
    height: 180,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: colors.muted,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  mapOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.72)",
  },
  overlayText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
  },
  linkBtn: {
    alignSelf: "flex-start",
    paddingVertical: spacing.xs,
  },
  linkText: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    color: colors.primary,
  },
});
