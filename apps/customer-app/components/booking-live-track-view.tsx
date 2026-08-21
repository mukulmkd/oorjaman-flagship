import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Image,
  Platform,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, type Region } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { CustomerBookingTechnicianProfile } from "@oorjaman/api";
import { brandColors, colors, spacing } from "@oorjaman/config";
import { formatDisplayDateTime } from "@oorjaman/utils";
import { fontFamily, fontSize } from "../constants/fonts";
import {
  buildGoogleStaticMapTrackUrl,
  getGoogleMapsApiKey,
} from "../lib/google-maps";
import { distanceKm, formatDistanceKm, type LatLng } from "../lib/map-geo";
import { useTrackRoutePath } from "../lib/use-track-route-path";

const INDIA_FALLBACK: Region = {
  latitude: 20.5937,
  longitude: 78.9629,
  latitudeDelta: 12,
  longitudeDelta: 12,
};

type Props = {
  modalHeader: ReactNode;
  customerCoords: LatLng | null;
  technicianCoords: LatLng | null;
  recordedAt: string | null;
  technicianProfile: CustomerBookingTechnicianProfile | null | undefined;
  profileLoading?: boolean;
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

function TrackPin({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.pinWrap} accessibilityLabel={label}>
      <View style={[styles.pinHead, { backgroundColor: color }]}>
        <View style={styles.pinHeadInner} />
      </View>
      <View style={styles.pinStem} />
      <View style={styles.pinLabel}>
        <Text style={styles.pinLabelText}>{label}</Text>
      </View>
    </View>
  );
}

function LiveBadge({ label }: { label: string }) {
  return (
    <View style={styles.liveBadge}>
      <View style={styles.liveDot} />
      <Text style={styles.liveBadgeText}>{label}</Text>
    </View>
  );
}

export function BookingLiveTrackView({
  modalHeader,
  customerCoords,
  technicianCoords,
  recordedAt,
  technicianProfile,
  profileLoading,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const mapRef = useRef<MapView | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [showMapHelp, setShowMapHelp] = useState(false);

  const mapsKey = getGoogleMapsApiKey();
  const mapProvider = mapsKey ? PROVIDER_GOOGLE : undefined;

  const mapRegion = useMemo(() => {
    const pts: LatLng[] = [];
    if (customerCoords) pts.push(customerCoords);
    if (technicianCoords) pts.push(technicianCoords);
    if (pts.length === 0) return INDIA_FALLBACK;
    const lats = pts.map((p) => p.latitude);
    const lngs = pts.map((p) => p.longitude);
    const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const midLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
    const pad = 1.25;
    const latDelta = Math.max((Math.max(...lats) - Math.min(...lats)) * pad, 0.012);
    const lngDelta = Math.max((Math.max(...lngs) - Math.min(...lngs)) * pad, 0.012);
    return {
      latitude: midLat,
      longitude: midLng,
      latitudeDelta: latDelta,
      longitudeDelta: lngDelta,
    };
  }, [customerCoords, technicianCoords]);

  const separationKm = useMemo(() => {
    if (!customerCoords || !technicianCoords) return null;
    return distanceKm(customerCoords, technicianCoords);
  }, [customerCoords, technicianCoords]);

  const showRoute =
    customerCoords != null &&
    technicianCoords != null &&
    separationKm != null &&
    separationKm <= 80;

  const { points: routePoints, isRoadRoute } = useTrackRoutePath(
    technicianCoords,
    customerCoords,
    showRoute,
  );

  const staticPathOptions = useMemo(() => {
    if (!showRoute || routePoints.length < 2) return undefined;
    return {
      path: {
        points: routePoints,
        weight: isRoadRoute ? 4 : 3,
        color: isRoadRoute ? "0x1f8660ff" : "0x1f866088",
      },
    };
  }, [isRoadRoute, routePoints, showRoute]);

  const staticPreviewUrl = useMemo(() => {
    const markers = [];
    if (customerCoords) {
      markers.push({ lat: customerCoords.latitude, lng: customerCoords.longitude, color: "green" });
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
      Math.round(windowWidth - spacing.lg * 2),
      160,
      staticPathOptions,
    );
  }, [customerCoords, technicianCoords, staticPathOptions, windowWidth]);

  const androidFullMapUrl = useMemo(() => {
    if (Platform.OS !== "android") return null;
    const markers = [];
    if (customerCoords) {
      markers.push({ lat: customerCoords.latitude, lng: customerCoords.longitude, color: "green" });
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
      Math.round(windowWidth),
      Math.min(640, Math.round(windowHeight * 0.62)),
      staticPathOptions,
    );
  }, [customerCoords, technicianCoords, staticPathOptions, windowHeight, windowWidth]);

  const statusLabel = useMemo(() => {
    if (technicianProfile?.isOnSite) return "On site";
    if (technicianProfile?.isEnRoute) return "En route";
    return "Live tracking";
  }, [technicianProfile?.isEnRoute, technicianProfile?.isOnSite]);

  const statusDescription = useMemo(() => {
    if (technicianProfile?.isOnSite) {
      return "Your technician has arrived and is working on your visit.";
    }
    if (technicianProfile?.isEnRoute) {
      return "Your technician is heading to your service location.";
    }
    return "Location updates every few seconds while your technician is on the way.";
  }, [technicianProfile?.isEnRoute, technicianProfile?.isOnSite]);

  useEffect(() => {
    const pts: LatLng[] = [];
    if (customerCoords) pts.push(customerCoords);
    if (technicianCoords) pts.push(technicianCoords);
    if (pts.length === 0) return;
    const handle = setTimeout(() => {
      mapRef.current?.fitToCoordinates(pts, {
        edgePadding: { top: insets.top + 96, right: 40, bottom: 280, left: 40 },
        animated: true,
      });
    }, 350);
    return () => clearTimeout(handle);
  }, [customerCoords, technicianCoords, insets.top]);

  useEffect(() => {
    if (!mapsKey) {
      setShowMapHelp(true);
      return;
    }
    const handle = setTimeout(() => {
      if (!mapReady) setShowMapHelp(true);
    }, 6000);
    return () => clearTimeout(handle);
  }, [mapReady, mapsKey]);

  const recordedLabel = recordedAt ? formatDisplayDateTime(recordedAt) : null;
  const technicianName = technicianProfile?.displayName ?? "Your technician";
  const partnerLine = technicianProfile?.partnerName
    ? `via ${technicianProfile.partnerName}`
    : null;

  const useAndroidStaticMap = Platform.OS === "android" && androidFullMapUrl != null;

  return (
    <View style={styles.root}>
      {useAndroidStaticMap ? (
        <Image
          source={{ uri: androidFullMapUrl }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onLoad={() => setMapReady(true)}
        />
      ) : (
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          provider={mapProvider}
          initialRegion={mapRegion}
          showsUserLocation={false}
          showsMyLocationButton={false}
          showsCompass={false}
          toolbarEnabled={false}
          onMapReady={() => setMapReady(true)}
        >
          {customerCoords ? (
            <Marker coordinate={customerCoords} anchor={{ x: 0.5, y: 1 }} tracksViewChanges={false}>
              <TrackPin color={colors.primary} label="You" />
            </Marker>
          ) : null}
          {technicianCoords ? (
            <Marker coordinate={technicianCoords} anchor={{ x: 0.5, y: 1 }} tracksViewChanges={false}>
              <TrackPin color={brandColors.man} label="Tech" />
            </Marker>
          ) : null}
          {customerCoords && technicianCoords && showRoute && routePoints.length >= 2 ? (
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

      <View style={[styles.headerShell, { paddingTop: insets.top }]}>{modalHeader}</View>

      {showMapHelp ? (
        <View style={[styles.mapHelpBanner, { top: insets.top + 72 }]}>
          <Text style={styles.mapHelpTitle}>Map preview may be unavailable</Text>
          <Text style={styles.mapHelpBody}>
            {mapsKey
              ? "Tiles did not load on this build. Location updates below are still live."
              : "Add a Google Maps key for this app build to show map tiles."}
          </Text>
        </View>
      ) : null}

      <View style={[styles.bottomSheet, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <View style={styles.sheetHandle} />

        <View style={styles.sheetHeaderRow}>
          <View style={styles.sheetHeaderCopy}>
            <LiveBadge label={statusLabel} />
            <Text style={styles.sheetTitle}>{technicianName}</Text>
            {partnerLine ? <Text style={styles.sheetPartner}>{partnerLine}</Text> : null}
            <Text style={styles.sheetStatus}>{statusDescription}</Text>
          </View>

          {profileLoading ? (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarFallbackText}>…</Text>
            </View>
          ) : technicianProfile ? (
            technicianProfile.avatarSignedUrl ? (
              <Image
                source={{ uri: technicianProfile.avatarSignedUrl }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarFallbackText}>{initials(technicianName)}</Text>
              </View>
            )
          ) : null}
        </View>

        <View style={styles.metricsRow}>
          <View style={styles.metricChip}>
            <View style={[styles.metricDot, { backgroundColor: colors.primary }]} />
            <Text style={styles.metricLabel}>Your site</Text>
          </View>
          <View style={styles.metricChip}>
            <View style={[styles.metricDot, { backgroundColor: brandColors.man }]} />
            <Text style={styles.metricLabel}>Technician</Text>
          </View>
          {separationKm != null ? (
            <Text style={styles.metricDistance}>{formatDistanceKm(separationKm)}</Text>
          ) : null}
        </View>

        {staticPreviewUrl && !useAndroidStaticMap ? (
          <View style={styles.previewCard}>
            <Image source={{ uri: staticPreviewUrl }} style={styles.previewImage} resizeMode="cover" />
          </View>
        ) : null}

        <View style={styles.updateRow}>
          {recordedLabel ? (
            <Text style={styles.updateMeta}>Last updated {recordedLabel} IST</Text>
          ) : (
            <Text style={styles.updateMeta}>Waiting for the first GPS update…</Text>
          )}
        </View>

        {separationKm != null && separationKm > 80 ? (
          <Text style={styles.hint}>
            Technician and your site look very far apart on GPS — the route line is hidden until locations
            look closer.
          </Text>
        ) : null}

        {!customerCoords ? (
          <Text style={styles.hint}>
            Allow location or set your service address on your profile to compare distance to your
            site.
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerShell: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    backgroundColor: "rgba(255,255,255,0.94)",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    shadowColor: colors.foreground,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  mapHelpBanner: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    zIndex: 2,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    shadowColor: colors.foreground,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  mapHelpTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    color: colors.foreground,
  },
  mapHelpBody: {
    marginTop: spacing["3xs"],
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
    lineHeight: 18,
  },
  bottomSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    shadowColor: colors.foreground,
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -6 },
    elevation: 12,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  sheetHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  sheetHeaderCopy: {
    flex: 1,
    gap: spacing["3xs"],
  },
  sheetTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.lg,
    color: colors.foreground,
    marginTop: spacing.xs,
  },
  sheetPartner: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
  },
  sheetStatus: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
    lineHeight: 20,
    marginTop: spacing["3xs"],
  },
  liveBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing["3xs"],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing["3xs"],
    borderRadius: 999,
    backgroundColor: colors.primaryMuted,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  liveBadgeText: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.xs,
    color: colors.primaryBorder,
    letterSpacing: 0.2,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.primaryMuted,
  },
  avatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarFallbackText: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.md,
    color: colors.primaryBorder,
  },
  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  metricChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing["3xs"],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing["3xs"],
    borderRadius: 999,
    backgroundColor: colors.background,
  },
  metricDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  metricLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.foreground,
  },
  metricDistance: {
    marginLeft: "auto",
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    color: colors.foreground,
  },
  previewCard: {
    marginTop: spacing.md,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  previewImage: {
    width: "100%",
    height: 140,
  },
  updateRow: {
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  updateMeta: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
  },
  hint: {
    marginTop: spacing.sm,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
    lineHeight: 18,
  },
  pinWrap: {
    alignItems: "center",
  },
  pinHead: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 3,
    borderColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.foreground,
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  pinHeadInner: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.card,
  },
  pinStem: {
    width: 3,
    height: 10,
    marginTop: -2,
    borderRadius: 999,
    backgroundColor: "rgba(15,41,56,0.35)",
  },
  pinLabel: {
    marginTop: spacing["3xs"],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  pinLabelText: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.xs,
    color: colors.foreground,
  },
});
