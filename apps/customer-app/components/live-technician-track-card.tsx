import { useEffect, useMemo, useRef } from "react";
import {
  Image,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import {
  MapView,
  Marker,
  Polyline,
  PROVIDER_GOOGLE,
  type Region,
} from "../lib/platform/maps-live";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { bookingApi, getCustomerBookingTechnicianProfile, queryKeys } from "@oorjaman/api";
import { brandColors, colors, spacing } from "@oorjaman/config";
import { formatDisplayDateTime } from "@oorjaman/utils";
import { Card } from "@oorjaman/ui";
import { fontFamily, fontSize } from "../constants/fonts";
import {
  buildGoogleStaticMapTrackUrl,
  getGoogleMapsApiKey,
} from "../lib/google-maps";
import {
  compareArrivalTrend,
  distanceKm,
  formatDistanceKm,
  formatEtaHeadline,
  type LatLng,
} from "../lib/map-geo";
import { useTrackRoutePath } from "../lib/use-track-route-path";
import { supabase } from "../lib/supabase";

const INDIA_FALLBACK: Region = {
  latitude: 20.5937,
  longitude: 78.9629,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

type Props = {
  bookingId: string;
  referenceCode?: string;
  scheduledStart?: string;
  destinationCoords: LatLng | null;
  liveUpdatesEnabled?: boolean;
  /** Optional full-screen map (tap mini map). */
  onExpandMap?: () => void;
};

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

function TrackProgress({ step }: { step: 0 | 1 | 2 }) {
  const labels = ["Assigned", "On the way", "Arriving"] as const;
  const fillPct = ((step + 1) / labels.length) * 100;
  return (
    <View style={styles.progressWrap}>
      <View style={styles.progressBarTrack}>
        <View style={[styles.progressBarFill, { width: `${fillPct}%` }]} />
      </View>
      <View style={styles.progressLabelsRow}>
        {labels.map((label, index) => (
          <Text
            key={label}
            style={[styles.progressLabel, index <= step && styles.progressLabelActive]}
          >
            {label}
          </Text>
        ))}
      </View>
    </View>
  );
}

function MiniMapPin({ color }: { color: string }) {
  return (
    <View style={[styles.miniPin, { backgroundColor: color }]}>
      <View style={styles.miniPinInner} />
    </View>
  );
}

export function LiveTechnicianTrackCard({
  bookingId,
  referenceCode,
  scheduledStart,
  destinationCoords,
  liveUpdatesEnabled = true,
  onExpandMap,
}: Props) {
  const mapRef = useRef<MapView | null>(null);
  const prevDistanceRef = useRef<number | null>(null);
  const { width: windowWidth } = useWindowDimensions();

  const techLocQ = useQuery({
    queryKey: queryKeys.bookings.technicianLastLocation(bookingId),
    queryFn: () => bookingApi.getLastTechnicianLocationForBooking(supabase!, bookingId),
    enabled: Boolean(supabase && bookingId),
    refetchInterval: liveUpdatesEnabled ? 15_000 : false,
    refetchIntervalInBackground: false,
  });

  const profileQ = useQuery({
    queryKey: queryKeys.bookings.technicianProfile(bookingId),
    queryFn: () => getCustomerBookingTechnicianProfile(supabase!, bookingId),
    enabled: Boolean(supabase && bookingId),
  });

  const technicianCoords = useMemo((): LatLng | null => {
    const row = techLocQ.data;
    if (!row) return null;
    return { latitude: row.lat, longitude: row.lng };
  }, [techLocQ.data]);

  const separationKm = useMemo(() => {
    if (!destinationCoords || !technicianCoords) return null;
    return distanceKm(destinationCoords, technicianCoords);
  }, [destinationCoords, technicianCoords]);

  const arrivalTrend = useMemo(() => {
    const trend = compareArrivalTrend(prevDistanceRef.current, separationKm);
    return trend;
  }, [separationKm]);

  useEffect(() => {
    if (separationKm != null) prevDistanceRef.current = separationKm;
  }, [separationKm]);

  const progressStep = useMemo((): 0 | 1 | 2 => {
    if (separationKm != null && separationKm < 0.8) return 2;
    if (technicianCoords) return 1;
    return 0;
  }, [separationKm, technicianCoords]);

  const etaCopy = formatEtaHeadline(separationKm, Boolean(technicianCoords));

  const movementLine = useMemo(() => {
    if (!technicianCoords) return null;
    if (arrivalTrend === "closer") return "Moving closer to you";
    if (arrivalTrend === "farther") return "Route updated — still on the way";
    if (arrivalTrend === "steady") return "On the move";
    return null;
  }, [arrivalTrend, technicianCoords]);

  const mapRegion = useMemo((): Region => {
    const pts: LatLng[] = [];
    if (destinationCoords) pts.push(destinationCoords);
    if (technicianCoords) pts.push(technicianCoords);
    if (pts.length === 0) return INDIA_FALLBACK;
    if (pts.length === 1) {
      return {
        latitude: pts[0]!.latitude,
        longitude: pts[0]!.longitude,
        latitudeDelta: 0.04,
        longitudeDelta: 0.04,
      };
    }
    const lats = pts.map((p) => p.latitude);
    const lngs = pts.map((p) => p.longitude);
    const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const midLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
    const latDelta = Math.max((Math.max(...lats) - Math.min(...lats)) * 1.25, 0.012);
    const lngDelta = Math.max((Math.max(...lngs) - Math.min(...lngs)) * 1.25, 0.012);
    return { latitude: midLat, longitude: midLng, latitudeDelta: latDelta, longitudeDelta: lngDelta };
  }, [destinationCoords, technicianCoords]);

  useEffect(() => {
    const pts: LatLng[] = [];
    if (destinationCoords) pts.push(destinationCoords);
    if (technicianCoords) pts.push(technicianCoords);
    if (pts.length === 0) return;
    const handle = setTimeout(() => {
      mapRef.current?.fitToCoordinates(pts, {
        edgePadding: { top: 24, right: 24, bottom: 24, left: 24 },
        animated: true,
      });
    }, 300);
    return () => clearTimeout(handle);
  }, [destinationCoords, technicianCoords]);

  const mapsKey = getGoogleMapsApiKey();
  const mapProvider = mapsKey ? PROVIDER_GOOGLE : undefined;

  const showRoute =
    destinationCoords != null &&
    technicianCoords != null &&
    separationKm != null &&
    separationKm <= 80;

  const { points: routePoints, isRoadRoute } = useTrackRoutePath(
    technicianCoords,
    destinationCoords,
    showRoute,
  );

  const staticPreviewUrl = useMemo(() => {
    const markers = [];
    if (destinationCoords) {
      markers.push({
        lat: destinationCoords.latitude,
        lng: destinationCoords.longitude,
        color: "green",
      });
    }
    if (technicianCoords) {
      markers.push({
        lat: technicianCoords.latitude,
        lng: technicianCoords.longitude,
        color: "blue",
      });
    }
    if (markers.length === 0) return null;
    return buildGoogleStaticMapTrackUrl(
      markers,
      Math.round(windowWidth - spacing.md * 4),
      184,
      showRoute && routePoints.length >= 2
        ? {
            path: {
              points: routePoints,
              weight: isRoadRoute ? 4 : 3,
              color: isRoadRoute ? "0x1f8660ff" : "0x1f866088",
            },
          }
        : undefined,
    );
  }, [
    destinationCoords,
    technicianCoords,
    isRoadRoute,
    routePoints,
    showRoute,
    windowWidth,
  ]);

  const profile = profileQ.data;
  const technicianName = profile?.displayName ?? "Your technician";
  const recordedLabel = techLocQ.data?.recorded_at
    ? formatDisplayDateTime(techLocQ.data.recorded_at)
    : null;

  const metaLine = [
    referenceCode,
    scheduledStart ? formatDisplayDateTime(scheduledStart) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  if (Platform.OS === "web") {
    return (
      <Card variant="elevated" padded>
        <View style={styles.liveRow}>
          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <Text style={styles.livePillText}>Live</Text>
          </View>
          <Text style={styles.etaHeadline}>{etaCopy.headline}</Text>
        </View>
        <Text style={styles.meta}>{etaCopy.subline}</Text>
        {metaLine ? <Text style={styles.meta}>{metaLine}</Text> : null}
      </Card>
    );
  }

  const mapBody = (
    <View style={styles.mapShell}>
      {Platform.OS === "android" && staticPreviewUrl ? (
        <Image source={{ uri: staticPreviewUrl }} style={styles.map} resizeMode="cover" />
      ) : (
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={mapProvider}
          initialRegion={mapRegion}
          showsUserLocation={false}
          scrollEnabled={false}
          zoomEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
          toolbarEnabled={false}
        >
          {destinationCoords ? (
            <Marker coordinate={destinationCoords} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
              <MiniMapPin color={colors.primary} />
            </Marker>
          ) : null}
          {technicianCoords ? (
            <Marker coordinate={technicianCoords} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
              <MiniMapPin color={brandColors.man} />
            </Marker>
          ) : null}
          {destinationCoords && technicianCoords && showRoute && routePoints.length >= 2 ? (
            <Polyline
              coordinates={routePoints.map((p) => ({
                latitude: p.lat,
                longitude: p.lng,
              }))}
              strokeColor={isRoadRoute ? colors.primary : `${colors.primary}99`}
              strokeWidth={isRoadRoute ? 4 : 3}
              lineDashPattern={isRoadRoute ? undefined : [6, 8]}
            />
          ) : null}
        </MapView>
      )}

      {!technicianCoords && !techLocQ.isPending ? (
        <View style={styles.mapOverlay}>
          {staticPreviewUrl ? (
            <Image source={{ uri: staticPreviewUrl }} style={styles.mapFallbackImage} resizeMode="cover" />
          ) : null}
          <View style={styles.mapOverlayScrim}>
            <Text style={styles.overlayText}>Waiting for GPS update…</Text>
          </View>
        </View>
      ) : null}

      {!mapsKey ? (
        <View style={styles.mapKeyHint}>
          <Text style={styles.mapKeyHintText}>Map preview</Text>
        </View>
      ) : !isRoadRoute && showRoute && technicianCoords ? (
        <View style={styles.mapKeyHint}>
          <Text style={styles.mapKeyHintText}>Approx. route</Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <Card variant="elevated" padded>
      <View style={styles.liveRow}>
        <View style={styles.livePill}>
          <View style={styles.liveDot} />
          <Text style={styles.livePillText}>Live</Text>
        </View>
        <View style={styles.etaBlock}>
          <Text style={styles.etaHeadline}>{etaCopy.headline}</Text>
          <Text style={styles.etaSubline}>{etaCopy.subline}</Text>
        </View>
      </View>

      {movementLine ? <Text style={styles.movementLine}>{movementLine}</Text> : null}

      <TrackProgress step={progressStep} />

      {onExpandMap ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Expand live map"
          onPress={onExpandMap}
          style={({ pressed }) => [styles.mapPressable, pressed && styles.mapPressablePressed]}
        >
          {mapBody}
          <View style={styles.mapExpandHint}>
            <Ionicons name="expand-outline" size={14} color={colors.primaryForeground} />
          </View>
        </Pressable>
      ) : (
        mapBody
      )}

      <View style={styles.techRow}>
        {profile?.avatarSignedUrl ? (
          <Image source={{ uri: profile.avatarSignedUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarFallbackText}>{initials(technicianName)}</Text>
          </View>
        )}
        <View style={styles.techCopy}>
          <Text style={styles.techName}>{technicianName}</Text>
          {profile?.partnerName ? (
            <Text style={styles.techPartner}>{profile.partnerName}</Text>
          ) : null}
          {recordedLabel ? (
            <Text style={styles.techMeta}>Updated {recordedLabel} IST</Text>
          ) : (
            <Text style={styles.techMeta}>Fetching live location…</Text>
          )}
          {metaLine ? <Text style={styles.techMeta}>{metaLine}</Text> : null}
        </View>
        {profile?.phoneE164 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Call ${technicianName}`}
            onPress={() => void Linking.openURL(`tel:${profile.phoneE164}`).catch(() => undefined)}
            style={({ pressed }) => [styles.callBtn, pressed && styles.callBtnPressed]}
          >
            <Ionicons name="call-outline" size={18} color={colors.primary} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
          <Text style={styles.legendText}>Your site</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: brandColors.man }]} />
          <Text style={styles.legendText}>Technician</Text>
        </View>
        {separationKm != null ? (
          <Text style={styles.legendDistance}>{formatDistanceKm(separationKm)}</Text>
        ) : null}
      </View>

      {!destinationCoords ? (
        <Text style={styles.hint}>
          Add GPS to your service address in Profile for arrival time and distance.
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  liveRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing["3xs"],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing["3xs"],
    borderRadius: 999,
    backgroundColor: colors.primaryMuted,
    marginTop: 4,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  livePillText: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.xs,
    color: colors.primaryBorder,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  etaBlock: {
    flex: 1,
    gap: 2,
  },
  etaHeadline: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    color: colors.foreground,
    lineHeight: 28,
  },
  etaSubline: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
    lineHeight: 20,
  },
  movementLine: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  progressWrap: {
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  progressBarTrack: {
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.border,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  progressLabelsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  progressLabel: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: colors.mutedForeground,
  },
  progressLabelActive: {
    fontFamily: fontFamily.medium,
    color: colors.foreground,
  },
  mapPressable: {
    borderRadius: 16,
    overflow: "hidden",
  },
  mapPressablePressed: {
    opacity: 0.96,
  },
  mapShell: {
    height: 184,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: colors.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  map: {
    ...StyleSheet.absoluteFill,
  },
  mapOverlay: {
    ...StyleSheet.absoluteFill,
  },
  mapFallbackImage: {
    ...StyleSheet.absoluteFill,
  },
  mapOverlayScrim: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.55)",
  },
  overlayText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
  },
  mapKeyHint: {
    position: "absolute",
    left: spacing.sm,
    bottom: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "rgba(15,41,56,0.55)",
  },
  mapKeyHintText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.primaryForeground,
  },
  mapExpandHint: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(15,41,56,0.62)",
    alignItems: "center",
    justifyContent: "center",
  },
  miniPin: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  miniPinInner: {
    width: 4,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.card,
  },
  techRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.primaryMuted,
  },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarFallbackText: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    color: colors.primaryBorder,
  },
  techCopy: {
    flex: 1,
    gap: 2,
  },
  techName: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.md,
    color: colors.foreground,
  },
  techPartner: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
  },
  techMeta: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: colors.mutedForeground,
  },
  callBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  callBtnPressed: {
    opacity: 0.9,
  },
  legendRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing["3xs"],
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  legendText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.foreground,
  },
  legendDistance: {
    marginLeft: "auto",
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    color: colors.foreground,
  },
  hint: {
    marginTop: spacing.sm,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
    lineHeight: 18,
  },
  meta: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
});
