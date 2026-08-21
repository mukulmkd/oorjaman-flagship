import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import type { SitePhotoCaptureGeo } from "@oorjaman/api";
import { fontFamily } from "../constants/fonts";
import {
  formatSitePhotoStampTime,
  reverseGeocodeSitePhoto,
  type SitePhotoGeocode,
} from "../lib/site-photo-geocode";
import { buildGoogleStaticMapImageUrl, buildOpenStreetMapStaticUrl } from "../lib/google-maps";

const MAP_BOX = 140;
const MAP_BOX_COMPACT = 72;

export type SitePhotoStampDisplay = {
  geo: SitePhotoCaptureGeo;
  geocode?: SitePhotoGeocode | null;
  timestamp?: string | null;
  siteLabel?: string | null;
  mapUri?: string | null;
  capturedAt?: string | null;
};

type Props = {
  data: SitePhotoStampDisplay;
  /** Smaller map + type for gallery thumbnails. */
  compact?: boolean;
};

function mapUrlForGeo(lat: number, lng: number, size: number): string | null {
  return buildGoogleStaticMapImageUrl(lat, lng, size) ?? buildOpenStreetMapStaticUrl(lat, lng, size);
}

export function SitePhotoStampFooter({ data, compact = false }: Props) {
  const mapSize = compact ? MAP_BOX_COMPACT : MAP_BOX;
  const [geocode, setGeocode] = useState<SitePhotoGeocode | null>(data.geocode ?? null);
  const [mapUri, setMapUri] = useState<string | null>(data.mapUri ?? null);
  const timestamp =
    data.timestamp ??
    (data.capturedAt ? formatSitePhotoStampTime(new Date(data.capturedAt)) : formatSitePhotoStampTime());

  useEffect(() => {
    if (data.geocode) {
      setGeocode(data.geocode);
      return;
    }
    let cancelled = false;
    void reverseGeocodeSitePhoto(data.geo.lat, data.geo.lng).then((result) => {
      if (!cancelled) setGeocode(result);
    });
    return () => {
      cancelled = true;
    };
  }, [data.geo.lat, data.geo.lng, data.geocode]);

  useEffect(() => {
    if (data.mapUri) {
      setMapUri(data.mapUri);
      return;
    }
    const url = mapUrlForGeo(data.geo.lat, data.geo.lng, mapSize);
    setMapUri(url);
  }, [data.geo.lat, data.geo.lng, data.mapUri, mapSize]);

  const mapHeight = compact ? MAP_BOX_COMPACT : MAP_BOX;

  return (
    <View style={[styles.footer, compact && styles.footerCompact]} collapsable={false}>
      <View style={[styles.mapWrap, { width: mapSize, height: mapHeight }]} collapsable={false}>
        {mapUri ? (
          <Image
            source={{ uri: mapUri }}
            style={{ width: mapSize, height: mapHeight }}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.mapPlaceholder, { width: mapSize, height: mapHeight }]} />
        )}
      </View>
      <View style={styles.metaCol} collapsable={false}>
        <View style={styles.brandRow}>
          <Text style={[styles.brand, compact && styles.brandCompact]}>OorjaMan</Text>
          {!compact ? <Text style={styles.brandSub}>Site photo</Text> : null}
        </View>
        {data.siteLabel ? (
          <Text style={[styles.siteLabel, compact && styles.siteLabelCompact]} numberOfLines={1}>
            {data.siteLabel}
          </Text>
        ) : null}
        {geocode ? (
          <>
            <Text style={[styles.cityLine, compact && styles.cityLineCompact]} numberOfLines={1}>
              {geocode.cityRegion}
            </Text>
            {!compact ? (
              <>
                <Text style={styles.countryLine} numberOfLines={1}>
                  {geocode.line1}
                </Text>
                <Text style={styles.addressLine} numberOfLines={compact ? 1 : 3}>
                  {geocode.fullAddress}
                </Text>
              </>
            ) : null}
          </>
        ) : (
          <Text style={styles.loadingLine}>Loading location…</Text>
        )}
        <Text style={[styles.coords, compact && styles.coordsCompact]} numberOfLines={1}>
          Lat {data.geo.lat.toFixed(compact ? 4 : 6)}, Long {data.geo.lng.toFixed(compact ? 4 : 6)}
        </Text>
        {!compact ? <Text style={styles.timeLine}>{timestamp}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "rgba(0,0,0,0.88)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  footerCompact: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 8,
  },
  mapWrap: {
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#333",
    flexShrink: 0,
  },
  mapPlaceholder: {
    backgroundColor: "#3d5a80",
  },
  metaCol: {
    flex: 1,
    justifyContent: "flex-start",
    gap: 2,
    minWidth: 0,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    marginBottom: 2,
  },
  brand: {
    fontFamily: fontFamily.bold,
    fontSize: 20,
    color: "#fff",
  },
  brandCompact: {
    fontSize: 13,
  },
  brandSub: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
    color: "rgba(255,255,255,0.75)",
  },
  siteLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: 14,
    color: "#7dcea0",
  },
  siteLabelCompact: {
    fontSize: 11,
  },
  cityLine: {
    fontFamily: fontFamily.semiBold,
    fontSize: 14,
    color: "#fff",
  },
  cityLineCompact: {
    fontSize: 11,
  },
  countryLine: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
    color: "rgba(255,255,255,0.9)",
  },
  addressLine: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    color: "rgba(255,255,255,0.82)",
    lineHeight: 16,
  },
  coords: {
    fontFamily: fontFamily.regular,
    fontSize: 11,
    color: "rgba(255,255,255,0.65)",
    marginTop: 2,
  },
  coordsCompact: {
    fontSize: 9,
  },
  timeLine: {
    fontFamily: fontFamily.regular,
    fontSize: 11,
    color: "rgba(255,255,255,0.55)",
    marginTop: 2,
  },
  loadingLine: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
  },
});
