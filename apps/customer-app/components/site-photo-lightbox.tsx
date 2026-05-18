import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { SitePhotoWithSignedUrl } from "@oorjaman/api";
import { colors, spacing } from "@oorjaman/config";
import { fontFamily, fontSize } from "../constants/fonts";
import { openGoogleMapsInBrowser } from "../lib/google-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type SitePhotoViewerItem = SitePhotoWithSignedUrl & {
  /** Local file URI for optimistic preview right after capture. */
  local_uri?: string | null;
};

function viewerUri(item: SitePhotoViewerItem): string | null {
  return item.local_uri ?? item.signed_url ?? null;
}

type Props = {
  photos: SitePhotoViewerItem[];
  visible: boolean;
  initialIndex: number;
  onClose: () => void;
};

export function SitePhotoLightbox({ photos, visible, initialIndex, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(initialIndex);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (visible) {
      setIndex(Math.min(Math.max(initialIndex, 0), Math.max(photos.length - 1, 0)));
      setLoading(true);
      setLoadError(false);
    }
  }, [visible, initialIndex, photos.length]);

  const photo = photos[index] ?? null;
  const uri = photo ? viewerUri(photo) : null;
  const hasPrev = index > 0;
  const hasNext = index < photos.length - 1;

  const goPrev = useCallback(() => {
    if (!hasPrev) return;
    setIndex((i) => i - 1);
    setLoading(true);
    setLoadError(false);
  }, [hasPrev]);

  const goNext = useCallback(() => {
    if (!hasNext) return;
    setIndex((i) => i + 1);
    setLoading(true);
    setLoadError(false);
  }, [hasNext]);

  if (!visible || !photo || !uri) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close photo viewer"
          onPress={onClose}
          style={[styles.closeBtn, { top: insets.top + spacing.sm }]}
        >
          <Ionicons name="close" size={28} color="#fff" />
        </Pressable>

        {photos.length > 1 ? (
          <Text style={[styles.counter, { top: insets.top + spacing.sm + 4 }]}>
            {index + 1} / {photos.length}
          </Text>
        ) : null}

        <View style={[styles.imageStage, { width, height: height - insets.top - insets.bottom - 120 }]}>
          {loading ? <ActivityIndicator size="large" color="#fff" /> : null}
          {loadError ? (
            <Text style={styles.errorText}>Could not load this photo.</Text>
          ) : (
            <Image
              key={`${photo.id}:${uri}`}
              source={{ uri }}
              style={styles.fullImage}
              resizeMode="contain"
              onLoadStart={() => {
                setLoading(true);
                setLoadError(false);
              }}
              onLoad={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setLoadError(true);
              }}
            />
          )}
        </View>

        <View style={[styles.metaBar, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`Open ${photo.lat.toFixed(5)}, ${photo.lng.toFixed(5)} in Google Maps`}
            onPress={() => void openGoogleMapsInBrowser(photo.lat, photo.lng)}
            style={({ pressed }) => [styles.coordsPress, pressed && styles.coordsPressed]}
          >
            <Text style={styles.coords}>
              {photo.lat.toFixed(5)}, {photo.lng.toFixed(5)}
            </Text>
            <Text style={styles.coordsHint}>Open in Google Maps</Text>
          </Pressable>
        </View>

        {photos.length > 1 ? (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous photo"
              disabled={!hasPrev}
              onPress={goPrev}
              style={[styles.navBtn, styles.navPrev, !hasPrev && styles.navDisabled]}
            >
              <Ionicons name="chevron-back" size={32} color="#fff" />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next photo"
              disabled={!hasNext}
              onPress={goNext}
              style={[styles.navBtn, styles.navNext, !hasNext && styles.navDisabled]}
            >
              <Ionicons name="chevron-forward" size={32} color="#fff" />
            </Pressable>
          </>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.94)",
    justifyContent: "center",
  },
  closeBtn: {
    position: "absolute",
    right: spacing.md,
    zIndex: 10,
    padding: spacing.xs,
  },
  counter: {
    position: "absolute",
    alignSelf: "center",
    zIndex: 10,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.md,
    color: "rgba(255,255,255,0.9)",
  },
  imageStage: {
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
  },
  fullImage: {
    width: "100%",
    height: "100%",
  },
  errorText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
    paddingHorizontal: spacing.lg,
  },
  metaBar: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    alignItems: "center",
  },
  coordsPress: {
    alignItems: "center",
    gap: 2,
  },
  coordsPressed: {
    opacity: 0.88,
  },
  coords: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: "#fff",
    textDecorationLine: "underline",
  },
  coordsHint: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: "rgba(255,255,255,0.75)",
  },
  navBtn: {
    position: "absolute",
    top: "42%",
    padding: spacing.sm,
    backgroundColor: "rgba(0,0,0,0.35)",
    borderRadius: 24,
  },
  navPrev: {
    left: spacing.xs,
  },
  navNext: {
    right: spacing.xs,
  },
  navDisabled: {
    opacity: 0.35,
  },
});
