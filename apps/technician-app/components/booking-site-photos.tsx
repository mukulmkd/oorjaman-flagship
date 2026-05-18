import { useQuery } from "@tanstack/react-query";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { bookingShowsSitePhotos, getSitePhotosForBooking, queryKeys } from "@oorjaman/api";
import type { BookingRow } from "@oorjaman/api";
import { colors, spacing } from "@oorjaman/config";
import { fontFamily, fontSize } from "../constants/fonts";
import { supabase } from "../lib/supabase";

type Props = {
  booking: Pick<BookingRow, "id" | "customer_id" | "metadata" | "status" | "technician_id">;
};

export function BookingSitePhotos({ booking }: Props) {
  const enabled = Boolean(supabase && bookingShowsSitePhotos(booking));

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
  if (query.isError || !query.data?.length) {
    return query.isError ? (
      <Text style={styles.meta}>Could not load site photos.</Text>
    ) : (
      <Text style={styles.meta}>No site photos from customer for this address.</Text>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Customer site photos</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {query.data
          .filter((p) => p.signed_url)
          .map((p) => (
          <View key={p.id} style={styles.thumbWrap}>
            <Image source={{ uri: p.signed_url! }} style={styles.thumb} accessibilityLabel="Customer site" />
            <Text style={styles.caption}>
              {p.lat.toFixed(4)}, {p.lng.toFixed(4)}
            </Text>
          </View>
        ))}
      </ScrollView>
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
});
