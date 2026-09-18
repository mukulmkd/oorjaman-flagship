import { useCallback, useState } from "react";
import {
  Alert,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import {
  bookingApi,
  formatInrFromCents,
  paymentApi,
  queryKeys,
} from "@oorjaman/api";
import { colors, spacing } from "@oorjaman/config";
import {
  Button,
  Card,
  ErrorStateCard,
  Screen,
  SCREEN_EDGES_BENEATH_NATIVE_HEADER,
  SkeletonStack,
  useModalStackHeader,
} from "@oorjaman/ui";
import { fontFamily, fontSize } from "../../../../constants/fonts";
import { TECHNICIAN_POSTPAID_UNPAID_QUERY_KEY } from "../../../../lib/postpaid-collect";
import { supabase } from "../../../../lib/supabase";

function qrImageUrl(data: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(data)}`;
}

export default function PostpaidCollectScreen() {
  const { bookingId: rawId } = useLocalSearchParams<{ bookingId: string }>();
  const bookingId = Array.isArray(rawId) ? rawId[0] : rawId;
  const qc = useQueryClient();
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [collectError, setCollectError] = useState<string | null>(null);

  const modalHeader = useModalStackHeader({
    title: "Collect payment",
    onClose: () => router.back(),
    closeAccessibilityLabel: "Close collect payment",
  });

  const bookingQuery = useQuery({
    queryKey: queryKeys.bookings.detail(bookingId ?? ""),
    queryFn: () => bookingApi.getBookingById(supabase!, bookingId!),
    enabled: Boolean(supabase && bookingId),
  });

  const paymentsQuery = useQuery({
    queryKey: queryKeys.payments.forBooking(bookingId ?? ""),
    queryFn: () => paymentApi.listPaymentsForBooking(supabase!, bookingId!),
    enabled: Boolean(supabase && bookingId),
    refetchInterval: 4000,
  });

  const booking = bookingQuery.data;
  const paid = (paymentsQuery.data ?? []).some((p) => p.status === "success");
  const amountPaise = Math.max(
    0,
    booking?.final_price_cents ?? booking?.estimated_price_cents ?? 0,
  );

  const createLinkMut = useMutation({
    mutationFn: async () => {
      if (!supabase || !bookingId) throw new Error("Missing booking");
      return paymentApi.createPostpaidCollectSession(supabase, {
        bookingId,
        amountPaise,
      });
    },
    onSuccess: (session) => {
      setCollectError(null);
      setLinkUrl(session.paymentLinkUrl);
      if (!session.paymentLinkUrl) {
        const msg =
          "Order was created but Razorpay Payment Link failed. Ask the customer to pay from their app, or mark partner collected if they paid you directly.";
        setCollectError(msg);
        if (Platform.OS !== "web") Alert.alert("Link unavailable", msg);
      }
      void qc.invalidateQueries({ queryKey: queryKeys.payments.forBooking(bookingId!) });
    },
    onError: (e: Error) => {
      setCollectError(e.message);
      if (Platform.OS !== "web") Alert.alert("Could not start collection", e.message);
    },
  });

  const partnerMut = useMutation({
    mutationFn: async () => {
      if (!supabase || !bookingId) throw new Error("Missing booking");
      return paymentApi.markPartnerCollectedPayment(supabase, {
        bookingId,
        amountPaise,
        method: "Partner collected (cash/UPI)",
        note: "Recorded by technician after visit",
      });
    },
    onSuccess: async () => {
      // Drop "Payment due" immediately on Jobs Done / detail before navigation.
      qc.setQueriesData<Record<string, boolean>>(
        { queryKey: [...TECHNICIAN_POSTPAID_UNPAID_QUERY_KEY] },
        (prev) => (prev && bookingId ? { ...prev, [bookingId]: false } : prev),
      );

      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.payments.forBooking(bookingId!) }),
        qc.invalidateQueries({ queryKey: queryKeys.bookings.detail(bookingId!) }),
        qc.invalidateQueries({ queryKey: queryKeys.bookings.list({ scope: "technician-assigned" }) }),
        qc.invalidateQueries({ queryKey: [...TECHNICIAN_POSTPAID_UNPAID_QUERY_KEY] }),
        qc.invalidateQueries({ queryKey: queryKeys.payments.all() }),
      ]);

      router.replace("/(main)/jobs");
      if (Platform.OS !== "web") {
        Alert.alert(
          "Marked as partner collected",
          "Customer will not be charged again. OorjaMan platform fee will be settled with the vendor.",
        );
      }
    },
    onError: (e: Error) => {
      setCollectError(e.message);
      if (Platform.OS !== "web") Alert.alert("Could not record", e.message);
    },
  });

  const shareLink = useCallback(async () => {
    if (!linkUrl) return;
    try {
      await Share.share({ message: `Pay OorjaMan for your visit: ${linkUrl}`, url: linkUrl });
    } catch {
      try {
        if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(linkUrl);
          Alert.alert("Link copied", "Payment link copied to the clipboard.");
          return;
        }
      } catch {
        // fall through
      }
      await Linking.openURL(linkUrl);
    }
  }, [linkUrl]);

  if (bookingQuery.isLoading) {
    return (
      <Screen edges={SCREEN_EDGES_BENEATH_NATIVE_HEADER}>
        {modalHeader}
        <SkeletonStack />
      </Screen>
    );
  }

  if (bookingQuery.isError || !booking) {
    return (
      <Screen edges={SCREEN_EDGES_BENEATH_NATIVE_HEADER}>
        {modalHeader}
        <ErrorStateCard
          title="Booking unavailable"
          message={(bookingQuery.error as Error | null)?.message ?? "Not found"}
          onRetry={() => void bookingQuery.refetch()}
        />
      </Screen>
    );
  }

  if (booking.payment_timing !== "postpaid") {
    return (
      <Screen edges={SCREEN_EDGES_BENEATH_NATIVE_HEADER}>
        {modalHeader}
        <Card padded>
          <Text style={styles.body}>This visit was prepaid — no collection step needed.</Text>
          <Button variant="primary" onPress={() => router.replace("/(main)/jobs")}>
            Back to jobs
          </Button>
        </Card>
      </Screen>
    );
  }

  if (paid) {
    return (
      <Screen edges={SCREEN_EDGES_BENEATH_NATIVE_HEADER}>
        {modalHeader}
        <Card padded>
          <Text style={styles.title}>Payment complete</Text>
          <Text style={styles.body}>This visit is paid. You can leave the site.</Text>
          <Button variant="primary" onPress={() => router.replace("/(main)/jobs")}>
            Done
          </Button>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen edges={SCREEN_EDGES_BENEATH_NATIVE_HEADER}>
      {modalHeader}
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Collect {formatInrFromCents(amountPaise)}</Text>
        <Text style={styles.body}>
          Generate a Razorpay QR / link for the customer to pay via any UPI app or other methods. If they already paid
          partner cash/UPI, record partner collected — do not charge them again.
        </Text>

        <Card padded>
          <View style={styles.cardBody}>
            <Button
              variant="primary"
              loading={createLinkMut.isPending}
              onPress={() => {
                setCollectError(null);
                createLinkMut.mutate();
              }}
            >
              {linkUrl ? "Refresh payment QR / link" : "Generate Razorpay QR / link"}
            </Button>
            {collectError ? <Text style={styles.errorText}>{collectError}</Text> : null}

            {linkUrl ? (
              <View style={styles.qrBlock}>
                <Image source={{ uri: qrImageUrl(linkUrl) }} style={styles.qr} accessibilityLabel="Payment QR" />
                <Pressable onPress={() => void Linking.openURL(linkUrl)}>
                  <Text style={styles.link}>{linkUrl}</Text>
                </Pressable>
                <Button variant="secondary" onPress={() => void shareLink()}>
                  Share link
                </Button>
              </View>
            ) : null}
          </View>
        </Card>

        <Card padded>
          <View style={styles.cardBody}>
            <Text style={styles.section}>Already paid partner?</Text>
            <Text style={styles.body}>
              Use only if customer paid cash or the vendor/technician UPI. Settlement will treat this as partner-held
              funds; OorjaMan fee is collected on vendor settlement.
            </Text>
            <Button
              variant="outline"
              loading={partnerMut.isPending}
              onPress={() => {
                const confirmMsg = `Mark ${formatInrFromCents(amountPaise)} as collected by partner?`;
                if (Platform.OS === "web") {
                  if (typeof window !== "undefined" && !window.confirm(confirmMsg)) return;
                  partnerMut.mutate();
                  return;
                }
                Alert.alert("Confirm partner collection", confirmMsg, [
                  { text: "Cancel", style: "cancel" },
                  { text: "Confirm", onPress: () => partnerMut.mutate() },
                ]);
              }}
            >
              Mark partner collected
            </Button>
          </View>
        </Card>

        <Button variant="ghost" onPress={() => router.replace("/(main)/jobs")}>
          Skip for now
        </Button>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  title: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.xl,
    color: colors.foreground,
  },
  section: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.md,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  body: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  cardBody: { gap: spacing.sm },
  qrBlock: { alignItems: "center", gap: spacing.sm, marginTop: spacing.md },
  qr: { width: 220, height: 220, backgroundColor: colors.card },
  link: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.primary,
    textAlign: "center",
  },
  errorText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.destructive,
    lineHeight: 20,
  },
});
