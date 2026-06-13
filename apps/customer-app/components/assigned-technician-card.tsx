import { useMemo } from "react";
import { Image, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { getCustomerBookingTechnicianProfile, queryKeys } from "@oorjaman/api";
import { colors, spacing } from "@oorjaman/config";
import { Card } from "@oorjaman/ui";
import { fontFamily, fontSize } from "../constants/fonts";
import { supabase } from "../lib/supabase";

type Props = {
  bookingId: string;
  enRouteAt?: string | null;
  status?: string;
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

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  return phone;
}

export function AssignedTechnicianCard({ bookingId, enRouteAt, status }: Props) {
  const profileQ = useQuery({
    queryKey: queryKeys.bookings.technicianProfile(bookingId),
    queryFn: () => getCustomerBookingTechnicianProfile(supabase!, bookingId),
    enabled: Boolean(supabase && bookingId),
  });

  const profile = profileQ.data;
  const statusLine = useMemo(() => {
    if (status === "in_progress" || profile?.isOnSite) {
      return "On site for your visit";
    }
    if (enRouteAt || profile?.isEnRoute) {
      return "On the way to your site";
    }
    return "Assigned to your visit";
  }, [enRouteAt, profile?.isEnRoute, profile?.isOnSite, status]);

  if (profileQ.isPending) {
    return (
      <Card variant="elevated" padded>
        <Text style={styles.title}>Your technician</Text>
        <Text style={styles.meta}>Loading technician details…</Text>
      </Card>
    );
  }

  if (!profile) {
    return null;
  }

  const chip = initials(profile.displayName);

  return (
    <Card variant="elevated" padded>
      <Text style={styles.title}>Your technician</Text>
      <Text style={styles.meta}>{statusLine}</Text>
      <View style={styles.row}>
        {profile.avatarSignedUrl ? (
          <Image source={{ uri: profile.avatarSignedUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarFallbackText}>{chip}</Text>
          </View>
        )}
        <View style={styles.info}>
          <Text style={styles.name}>{profile.displayName}</Text>
          {profile.partnerName ? (
            <Text style={styles.partner}>{profile.partnerName}</Text>
          ) : null}
          {profile.phoneE164 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Call ${profile.displayName}`}
              onPress={() => {
                void Linking.openURL(`tel:${profile.phoneE164}`).catch(() => undefined);
              }}
              style={styles.phoneBtn}
            >
              <Text style={styles.phone}>{formatPhone(profile.phoneE164)}</Text>
            </Pressable>
          ) : (
            <Text style={styles.meta}>Phone shared when they are en route</Text>
          )}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
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
    marginTop: spacing.xs,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.muted,
  },
  avatarFallback: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarFallbackText: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.md,
    color: colors.primaryForeground,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.md,
    color: colors.foreground,
  },
  partner: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
  },
  phoneBtn: {
    alignSelf: "flex-start",
    paddingVertical: 2,
  },
  phone: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    color: colors.primary,
  },
});
