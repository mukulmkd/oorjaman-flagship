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
  const paid = (paymentsQuery.data ?? []).some(
    (p) => p.status === "success" && p.collection_channel !== "technician_remittance",
  );
  const partnerCollected = (paymentsQuery.data ?? []).some(
    (p) => p.status === "success" && p.provider === "partner_collected",
  );
  const amountPaise = Math.max(
    0,
    booking?.final_price_cents ?? booking?.estimated_price_cents ?? 0,
  );

  const remittanceQuery = useQuery({
    queryKey: ["technician-remittance", bookingId],
    queryFn: () => paymentApi.technicianRemittanceForBooking(supabase!, bookingId!),
    enabled: Boolean(supabase && bookingId && paid),
    refetchInterval: 4000,
  });
  const [remitUrl, setRemitUrl] = useState<string | null>(null);
  const remitPending = remittanceQuery.data?.remittanceStatus === "pending";
  const remitReceived = remittanceQuery.data?.remittanceStatus === "received";
  const remitAmount = remittanceQuery.data?.grossPaise || amountPaise;

  const remitMut = useMutation({
    mutationFn: async () => {
      if (!supabase || !bookingId) throw new Error("Missing booking");
      return paymentApi.createTechnicianRemittanceSession(supabase, {
        bookingId,
        amountPaise: remitAmount,
      });
    },
    onSuccess: (session) => {
      setCollectError(null);
      setRemitUrl(session.paymentLinkUrl);
      if (!session.paymentLinkUrl) {
        const msg = "The transfer link could not be created. Try again in a moment.";
        setCollectError(msg);
        if (Platform.OS !== "web") Alert.alert("Link unavailable", msg);
      }
    },
    onError: (e: Error) => {
      setCollectError(e.message);
      if (Platform.OS !== "web") Alert.alert("Could not start transfer", e.message);
    },
  });

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
        qc.invalidateQueries({ queryKey: ["technician-remittance", bookingId!] }),
        qc.invalidateQueries({ queryKey: ["technician-remittances-pending"] }),
        qc.invalidateQueries({ queryKey: queryKeys.payments.all() }),
      ]);

      if (Platform.OS !== "web") {
        Alert.alert(
          "Marked as partner collected",
          "Customer will not be charged again. Send the full amount to OorjaMan next.",
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

  if (partnerCollected && remittanceQuery.isPending) {
    return (
      <Screen edges={SCREEN_EDGES_BENEATH_NATIVE_HEADER}>
        {modalHeader}
        <SkeletonStack />
      </Screen>
    );
  }

  if (remitReceived) {
    return (
      <Screen edges={SCREEN_EDGES_BENEATH_NATIVE_HEADER}>
        {modalHeader}
        <Card padded>
          <Text style={styles.title}>Transfer received</Text>
          <Text style={styles.body}>
            OorjaMan has this visit amount. Your employer is paid the rest in the monthly settlement.
          </Text>
          <Button variant="primary" onPress={() => router.replace("/(main)/jobs")}>
            Done
          </Button>
        </Card>
      </Screen>
    );
  }

  if (remitPending) {
    return (
      <Screen edges={SCREEN_EDGES_BENEATH_NATIVE_HEADER}>
        {modalHeader}
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.title}>Send {formatInrFromCents(remitAmount)} to OorjaMan</Text>
          <Text style={styles.body}>
            The customer already paid you. Transfer this full amount from your own UPI. OorjaMan keeps the platform
            fee and pays your employer the rest once a month.
          </Text>
          <Card padded>
            <View style={styles.cardBody}>
              <Button
                variant="primary"
                loading={remitMut.isPending}
                onPress={() => {
                  setCollectError(null);
                  remitMut.mutate();
                }}
              >
                {remitUrl ? "Refresh transfer QR" : "Show transfer QR"}
              </Button>
              {collectError ? <Text style={styles.errorText}>{collectError}</Text> : null}
              {remitUrl ? (
                <View style={styles.qrBlock}>
                  <Image source={{ uri: qrImageUrl(remitUrl) }} style={styles.qr} accessibilityLabel="Transfer QR" />
                  <Pressable onPress={() => void Linking.openURL(remitUrl)}>
                    <Text style={styles.link}>{remitUrl}</Text>
                  </Pressable>
                  <Button
                    variant="secondary"
                    onPress={() => void Share.share({ message: `OorjaMan transfer: ${remitUrl}`, url: remitUrl })}
                  >
                    Open link
                  </Button>
                </View>
              ) : null}
            </View>
          </Card>
          <Button variant="ghost" onPress={() => router.replace("/(main)/jobs")}>
            Back to jobs
          </Button>
        </ScrollView>
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
              Use only if the customer paid you cash or by personal UPI. You then transfer the full amount to
              OorjaMan. Do not charge the customer again.
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
