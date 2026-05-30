import { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  MAX_SITE_PHOTOS_PER_ADDRESS,
  patchAddressEntryGps,
  patchAddressEntrySitePhotos,
  queryKeys,
  signSitePhotoRecords,
  type SitePhotoRecord,
  type SitePhotoWithSignedUrl,
} from "@oorjaman/api";
import { colors, spacing } from "@oorjaman/config";
import { Button } from "@oorjaman/ui";
import { fontFamily, fontSize } from "../constants/fonts";
import { uploadCustomerSitePhotoFromUri } from "../lib/customer-site-photo-upload";
import { openGoogleMapsInBrowser } from "../lib/google-maps";
import { promptSitePhotoSource } from "../lib/site-photo-source-prompt";
import type { ServiceAddressEntry } from "../lib/service-address-book";
import { supabase } from "../lib/supabase";
import { SitePhotoLightbox, type SitePhotoViewerItem } from "./site-photo-lightbox";
import { useSitePhotoStamp } from "./site-photo-stamp-provider";

const EMPTY_SITE_PHOTOS: SitePhotoRecord[] = [];

type Props = {
  addressId: string | null;
  addressLabel: string;
  customerUserId: string;
  entries: ServiceAddressEntry[];
  defaultId: string | null;
  onSaveEntries: (entries: ServiceAddressEntry[], defaultId: string | null) => Promise<void>;
  lat: number | null;
  lng: number | null;
  accuracyM: number | null;
  onGpsChange: (lat: number | null, lng: number | null, accuracyM: number | null) => void;
  locBusy: boolean;
  onCaptureLocation: () => void;
  onClearLocation: () => void;
  /** Raw JSON array length from DB (before normalization); helps detect parse drops. */
  rawSitePhotoCount?: number;
};

export function SitePhotoGallerySection({
  addressId,
  addressLabel,
  customerUserId,
  entries,
  defaultId,
  onSaveEntries,
  lat,
  lng,
  accuracyM,
  onGpsChange,
  locBusy,
  onCaptureLocation,
  onClearLocation,
  rawSitePhotoCount = 0,
}: Props) {
  const qc = useQueryClient();
  const { pickAndStampSitePhoto } = useSitePhotoStamp();
  const [display, setDisplay] = useState<SitePhotoViewerItem[]>([]);
  const [signBusy, setSignBusy] = useState(false);
  const [flowBusy, setFlowBusy] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const entry = addressId ? entries.find((e) => e.id === addressId) ?? null : null;
  const photos = entry?.site_photos ?? EMPTY_SITE_PHOTOS;
  const photosKey = useMemo(
    () => photos.map((p) => `${p.id}:${p.storage_path}`).join("|"),
    [photos],
  );

  const photosOnOtherAddresses = useMemo(() => {
    if (!addressId) return 0;
    return entries.reduce((sum, e) => {
      if (e.id === addressId) return sum;
      return sum + (e.site_photos?.length ?? 0);
    }, 0);
  }, [addressId, entries]);

  useFocusEffect(
    useCallback(() => {
      void qc.invalidateQueries({ queryKey: queryKeys.customers.mine() });
    }, [qc]),
  );

  const refreshSignedUrls = useCallback(async () => {
    if (!supabase || photos.length === 0) {
      setDisplay([]);
      setSignBusy(false);
      return;
    }
    setSignBusy(true);
    try {
      const signed = await signSitePhotoRecords(supabase, photos);
      setDisplay(signed.map((p) => ({ ...p, local_uri: null })));
    } catch (e: unknown) {
      setDisplay(
        photos.map((p) => ({
          ...p,
          signed_url: null,
          storage_missing: true,
          local_uri: null,
        })),
      );
      Alert.alert("Photos", e instanceof Error ? e.message : "Could not load photos.");
    } finally {
      setSignBusy(false);
    }
  }, [photos]);

  useEffect(() => {
    void refreshSignedUrls();
  }, [photosKey, refreshSignedUrls]);

  const persistEntries = useCallback(
    async (nextEntries: ServiceAddressEntry[]) => {
      const id = defaultId ?? addressId;
      if (!id) throw new Error("No saved address selected.");
      await onSaveEntries(nextEntries, id);
    },
    [addressId, defaultId, onSaveEntries],
  );

  const onAddPhoto = useCallback(async () => {
    if (flowBusy) return;
    if (!supabase || !addressId) {
      Alert.alert("Address required", "Save a service address before adding site photos.");
      return;
    }
    if (photos.length >= MAX_SITE_PHOTOS_PER_ADDRESS) {
      Alert.alert("Gallery full", `You can add up to ${MAX_SITE_PHOTOS_PER_ADDRESS} photos per site.`);
      return;
    }

    const source = await promptSitePhotoSource();
    if (!source) return;

    setFlowBusy(true);
    try {
      const pick = await pickAndStampSitePhoto(source, addressLabel);
      if (!pick) return;

      const optimistic: SitePhotoViewerItem = {
        id: `pending-${Date.now()}`,
        storage_path: "",
        lat: pick.geo.lat,
        lng: pick.geo.lng,
        accuracy_m: pick.geo.accuracy_m ?? null,
        captured_at: new Date().toISOString(),
        source: pick.source,
        signed_url: null,
        local_uri: pick.uri,
      };
      setDisplay((prev) => [...prev, optimistic]);

      const record = await uploadCustomerSitePhotoFromUri(supabase, {
        customerUserId,
        serviceAddressId: addressId,
        uri: pick.uri,
        geo: pick.geo,
        source: pick.source,
      });

      const nextPhotos = [...photos.filter((p) => !p.id.startsWith("pending-")), record];
      let nextEntries = patchAddressEntrySitePhotos(entries, addressId, nextPhotos);
      nextEntries = patchAddressEntryGps(nextEntries, addressId, pick.geo);
      await persistEntries(nextEntries);
      onGpsChange(pick.geo.lat, pick.geo.lng, pick.geo.accuracy_m ?? null);
    } catch (e: unknown) {
      setDisplay((prev) => prev.filter((p) => !p.id.startsWith("pending-")));
      Alert.alert("Could not add photo", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setFlowBusy(false);
    }
  }, [
    addressId,
    addressLabel,
    customerUserId,
    entries,
    flowBusy,
    onGpsChange,
    persistEntries,
    photos,
    pickAndStampSitePhoto,
  ]);

  const onRemovePhoto = useCallback(
    (photo: SitePhotoRecord) => {
      if (!addressId) return;
      Alert.alert("Remove photo?", "This deletes the image from your site gallery.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            void (async () => {
              if (!supabase) return;
              setFlowBusy(true);
              try {
                if (photo.storage_path) {
                  await supabase.storage.from("customer-site-photos").remove([photo.storage_path]);
                }
                const nextPhotos = photos.filter((p) => p.id !== photo.id);
                await persistEntries(patchAddressEntrySitePhotos(entries, addressId, nextPhotos));
                setLightboxIndex(null);
              } catch (e: unknown) {
                Alert.alert("Remove failed", e instanceof Error ? e.message : "Try again.");
              } finally {
                setFlowBusy(false);
              }
            })();
          },
        },
      ]);
    },
    [addressId, entries, persistEntries, photos],
  );

  const openViewer = useCallback(
    (index: number) => {
      const item = display[index];
      if (!item) return;
      const uri = item.local_uri ?? item.signed_url;
      if (!uri) {
        Alert.alert(
          "Photo unavailable",
          item.storage_missing
            ? "This photo was never uploaded or was removed from storage. Remove it and add a new one."
            : "Could not load a preview. Pull to refresh or tap Retry below.",
        );
        return;
      }
      setLightboxIndex(index);
    },
    [display],
  );

  if (!addressId) {
    return (
      <Text style={styles.hint}>
        Add and save a service address above before adding site photos or GPS for this location.
      </Text>
    );
  }

  const brokenCount = display.filter((p) => p.storage_missing && !p.local_uri).length;
  const visibleCount = display.filter((p) => !p.id.startsWith("pending-")).length;

  return (
    <View>
      <Text style={styles.hint}>
        For <Text style={styles.hintStrong}>{addressLabel}</Text>. Tap a thumbnail to view full screen. GPS and map
        are stamped on each photo for your assigned partner once the visit is confirmed.
      </Text>
      {photos.length > 0 || display.length > 0 ? (
        <Text style={styles.photoCount}>
          {visibleCount} photo{visibleCount === 1 ? "" : "s"} on this site
          {rawSitePhotoCount > visibleCount
            ? ` (${rawSitePhotoCount} saved in profile - pull down to refresh if one is missing)`
            : ""}
        </Text>
      ) : null}
      {photosOnOtherAddresses > 0 ? (
        <Text style={styles.otherAddrHint}>
          {photosOnOtherAddresses} more photo{photosOnOtherAddresses === 1 ? "" : "s"} on your other saved
          addresses. Switch the default booking address to view them.
        </Text>
      ) : null}

      {signBusy && display.length === 0 && photos.length > 0 ? (
        <ActivityIndicator style={{ marginVertical: spacing.sm }} color={colors.primary} />
      ) : display.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.galleryScroll}>
          {display.map((p, i) => {
            const thumbUri = p.local_uri ?? p.signed_url;
            const missing = p.storage_missing && !p.local_uri;
            return (
              <View key={`${p.storage_path || p.id}-${i}`} style={styles.thumbWrap}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`View site photo ${i + 1} of ${display.length}`}
                  onPress={() => openViewer(i)}
                  style={({ pressed }) => [styles.thumbPress, pressed && styles.thumbPressed]}
                >
                  {thumbUri ? (
                    <Image source={{ uri: thumbUri }} style={styles.thumb} />
                  ) : (
                    <View style={[styles.thumb, styles.thumbMissing]}>
                      <Text style={styles.thumbMissingText}>{missing ? "Missing" : "…"}</Text>
                    </View>
                  )}
                  {thumbUri ? (
                    <View style={styles.thumbOverlay}>
                      <Text style={styles.tapHint}>View</Text>
                    </View>
                  ) : null}
                </Pressable>
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel={`Open ${p.lat.toFixed(4)}, ${p.lng.toFixed(4)} in Google Maps`}
                  onPress={() => void openGoogleMapsInBrowser(p.lat, p.lng)}
                  style={({ pressed }) => [pressed && styles.coordsPressed]}
                >
                  <Text style={styles.thumbMeta} numberOfLines={1}>
                    {p.lat.toFixed(4)}, {p.lng.toFixed(4)}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => onRemovePhoto(p)}
                  style={({ pressed }) => [styles.removeBtn, pressed && { opacity: 0.85 }]}
                >
                  <Text style={styles.removeLabel}>Remove</Text>
                </Pressable>
              </View>
            );
          })}
        </ScrollView>
      ) : photos.length === 0 ? (
        <Text style={styles.empty}>No site photos yet.</Text>
      ) : null}

      {brokenCount > 0 ? (
        <Text style={styles.brokenHint}>
          {brokenCount} photo{brokenCount > 1 ? "s" : ""} failed to load from storage. Remove and add again.
        </Text>
      ) : null}

      <SitePhotoLightbox
        photos={display}
        visible={lightboxIndex != null}
        initialIndex={lightboxIndex ?? 0}
        onClose={() => setLightboxIndex(null)}
      />

      <View style={styles.actions}>
        <Button
          variant="primary"
          size="sm"
          loading={flowBusy}
          disabled={flowBusy || photos.length >= MAX_SITE_PHOTOS_PER_ADDRESS}
          onPress={() => void onAddPhoto()}
        >
          {photos.length >= MAX_SITE_PHOTOS_PER_ADDRESS ? "Gallery full" : "Add site photo"}
        </Button>
        {photos.length > 0 ? (
          <Button variant="outline" size="sm" disabled={flowBusy || signBusy} onPress={() => void refreshSignedUrls()}>
            Refresh
          </Button>
        ) : null}
      </View>

      <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>GPS pin</Text>
      {lat != null && lng != null ? (
        <View style={styles.locCard}>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`Open ${lat.toFixed(5)}, ${lng.toFixed(5)} in Google Maps`}
            onPress={() => void openGoogleMapsInBrowser(lat, lng)}
            style={({ pressed }) => [pressed && styles.coordsPressed]}
          >
            <Text style={styles.locCoords}>
              {lat.toFixed(5)}, {lng.toFixed(5)}
            </Text>
            <Text style={styles.locMapsHint}>Tap to open in Google Maps</Text>
          </Pressable>
          {accuracyM != null ? (
            <Text style={styles.locAcc}>±{Math.round(accuracyM)} m accuracy</Text>
          ) : null}
          <View style={styles.locActions}>
            <Button variant="outline" size="sm" onPress={onCaptureLocation} loading={locBusy}>
              Refresh GPS
            </Button>
            <Button variant="ghost" size="sm" onPress={onClearLocation}>
              Clear
            </Button>
          </View>
        </View>
      ) : (
        <Button variant="outline" size="md" loading={locBusy} onPress={onCaptureLocation}>
          Use current location
        </Button>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hint: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
    lineHeight: 20,
  },
  hintStrong: {
    fontFamily: fontFamily.semiBold,
    color: colors.foreground,
  },
  photoCount: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  otherAddrHint: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
    lineHeight: 18,
  },
  fieldLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
    marginBottom: spacing.xs,
  },
  galleryScroll: {
    marginBottom: spacing.sm,
  },
  thumbWrap: {
    width: 140,
    marginRight: spacing.sm,
  },
  thumbPress: {
    borderRadius: 10,
    overflow: "hidden",
  },
  thumb: {
    width: 140,
    height: 100,
    backgroundColor: colors.muted,
  },
  thumbPressed: {
    opacity: 0.92,
  },
  thumbMissing: {
    alignItems: "center",
    justifyContent: "center",
  },
  thumbMissingText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.mutedForeground,
  },
  thumbOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingVertical: 4,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
  },
  tapHint: {
    fontFamily: fontFamily.medium,
    fontSize: 10,
    color: "#fff",
  },
  thumbMeta: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.primary,
    marginTop: 4,
    textDecorationLine: "underline",
  },
  coordsPressed: {
    opacity: 0.88,
  },
  removeBtn: {
    marginTop: 4,
    alignSelf: "flex-start",
  },
  removeLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.destructive,
  },
  brokenHint: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: colors.destructive,
    marginBottom: spacing.sm,
  },
  empty: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  locCard: {
    padding: spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.muted,
  },
  locCoords: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.md,
    color: colors.primary,
    textDecorationLine: "underline",
  },
  locMapsHint: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  locAcc: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
    marginTop: 4,
  },
  locActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});
