import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { bookingShowsSitePhotos, getSitePhotosForBooking, queryKeys } from "@oorjaman/api";
import type { BookingRow } from "@oorjaman/api";
import { colors, spacing } from "@oorjaman/config";
import { Ionicons } from "@expo/vector-icons";
import { fontFamily, fontSize } from "../constants/fonts";
import { supabase } from "../lib/supabase";

type Props = {
  booking: Pick<
    BookingRow,
    "id" | "customer_id" | "metadata" | "status" | "technician_id" | "subscription_id"
  >;
  /** When true, omit the section title (parent already labeled). */
  compact?: boolean;
};

export function BookingSitePhotos({ booking, compact = false }: Props) {
  const enabled = Boolean(supabase && bookingShowsSitePhotos(booking));
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [viewerUri, setViewerUri] = useState<string | null>(null);

  const query = useQuery({
    queryKey: queryKeys.customers.sitePhotosForBooking(booking.id),
    queryFn: () => getSitePhotosForBooking(supabase!, booking),
    enabled,
    staleTime: 5 * 60 * 1000,
  });

  if (!enabled) return null;
  if (query.isPending) {
    return <Text style={styles.meta}>Loading customer site photos…</Text>;
  }
  if (query.isError) {
    return <Text style={styles.meta}>Could not load site photos.</Text>;
  }
  if (!query.data?.length) {
    return <Text style={styles.meta}>No site photos from customer for this address.</Text>;
  }

  const visible = query.data.filter((p) => p.signed_url);

  return (
    <View style={styles.wrap}>
      {compact ? null : <Text style={styles.title}>Customer site photos</Text>}
      <Text style={styles.hint}>Tap a photo to view full size before you travel.</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {visible.map((p, index) => (
          <Pressable
            key={p.id}
            accessibilityRole="button"
            accessibilityLabel={`View customer site photo ${index + 1}`}
            onPress={() => setViewerUri(p.signed_url!)}
            style={styles.thumbWrap}
          >
            <Image source={{ uri: p.signed_url! }} style={styles.thumb} />
            <Text style={styles.caption}>
              {p.lat.toFixed(4)}, {p.lng.toFixed(4)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <Modal
        visible={Boolean(viewerUri)}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerUri(null)}
      >
        <View style={styles.viewerRoot}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close photo"
            onPress={() => setViewerUri(null)}
            style={styles.viewerClose}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </Pressable>
          {viewerUri ? (
            <Image
              source={{ uri: viewerUri }}
              style={{ width: windowWidth, height: windowHeight * 0.75 }}
              resizeMode="contain"
              accessibilityLabel="Customer site photo full size"
            />
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing.sm,
  },
  title: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  hint: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
  },
  meta: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  thumbWrap: {
    width: 128,
    marginRight: spacing.sm,
  },
  thumb: {
    width: 128,
    height: 96,
    borderRadius: 8,
    backgroundColor: colors.muted,
  },
  caption: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: colors.mutedForeground,
    marginTop: 4,
  },
  viewerRoot: {
    flex: 1,
    backgroundColor: "rgba(15, 41, 56, 0.94)",
    justifyContent: "center",
    alignItems: "center",
  },
  viewerClose: {
    position: "absolute",
    top: 56,
    right: 20,
    zIndex: 2,
    padding: 8,
  },
});
