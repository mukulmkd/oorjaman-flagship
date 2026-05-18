import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { bookingApi, queryKeys, technicianApi } from "@oorjaman/api";
import type { BookingRow, Json } from "@oorjaman/api";
import { readBookingOpsMeta, readBookingRecipientMeta } from "@oorjaman/api";
import { colors, spacing } from "@oorjaman/config";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Button,
  Card,
  EmptyStateCard,
  ErrorStateCard,
  FadeInView,
  notifyTechnicianJobCompleted,
  Screen,
  SCREEN_EDGES_BENEATH_NATIVE_HEADER,
  modalScrollContentStyle,
  SkeletonStack,
  useModalStackHeader,
} from "@oorjaman/ui";
import { fontFamily, fontSize, fontWeight } from "../../../../constants/fonts";
import { supabase } from "../../../../lib/supabase";
import { uploadAndLinkJobReportPhoto } from "../../../../lib/job-evidence-upload";
import {
  allSafetyChecked,
  emptySafetyRecord,
  SAFETY_ITEMS,
  type SafetyKey,
} from "../../../../lib/safety-checklist";
import { jobStatusLabel } from "../../../../lib/job-status";
import { formatElapsed, formatJobTimestamp, useJobElapsedMs } from "../../../../lib/job-timer";

const STEPS = ["verify", "checklist", "start", "before", "after", "issues", "submit"] as const;

const STEP_HEADING: Record<(typeof STEPS)[number], string> = {
  verify: "Verify Job Start Code",
  checklist: "Safety checklist",
  start: "Start timer",
  before: "Before photos",
  after: "After photos",
  issues: "Issues & notes",
  submit: "Submit completion",
};

function normalizeVisitCode(s: string): string {
  return s.trim().toUpperCase();
}

function parsePhotoUrlArray(value: Json | null | undefined): string[] {
  if (!value || !Array.isArray(value)) return [];
  return value.filter((u): u is string => typeof u === "string");
}

function useBookingGuard(booking: BookingRow | undefined): boolean {
  return Boolean(booking && (booking.status === "accepted" || booking.status === "in_progress"));
}

function stringifyAddressPreview(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "formatted" in value) {
    const f = (value as { formatted?: unknown }).formatted;
    if (typeof f === "string") return f;
  }
  try {
    const lines: string[] = [];
    const o = value as Record<string, unknown>;
    for (const k of ["line1", "city"]) {
      const v = o[k];
      if (typeof v === "string" && v.trim()) lines.push(v.trim());
    }
    return lines.join(", ");
  } catch {
    return "";
  }
}

function serviceForLabel(booking: BookingRow): string {
  const rec = readBookingRecipientMeta(booking.metadata);
  if (!rec || rec.is_self) return "Customer";
  const rel = rec.relationship?.trim() ? ` (${rec.relationship.trim()})` : "";
  return `${rec.recipient_name?.trim() || "Someone else"}${rel}`;
}

export default function JobExecutionWizardScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ bookingId: string | string[] }>();
  const bookingId = Array.isArray(params.bookingId) ? params.bookingId[0] : params.bookingId;

  const queryClient = useQueryClient();

  const bookingQuery = useQuery({
    queryKey: bookingId ? queryKeys.bookings.detail(bookingId) : [],
    queryFn: () => bookingApi.getBookingById(supabase!, bookingId!),
    enabled: Boolean(supabase && bookingId),
  });

  const b = bookingQuery.data;
  const serviceOtp = b ? bookingApi.readBookingServiceOtpMeta(b.metadata) : null;
  const opsMeta = b ? readBookingOpsMeta(b.metadata) : null;
  const startAlreadyVerified = Boolean(serviceOtp?.startVerifiedAt) || b?.status === "in_progress";

  const resumed = b?.status === "in_progress";

  const canExecute = useBookingGuard(b);

  const jobReportQuery = useQuery({
    queryKey: bookingId ? queryKeys.jobReports.byBooking(bookingId) : [],
    queryFn: () => technicianApi.getJobReportByBookingId(supabase!, bookingId!),
    enabled: Boolean(supabase && bookingId && canExecute),
  });

  const restoreWizardRef = useRef(false);

  useEffect(() => {
    restoreWizardRef.current = false;
  }, [bookingId]);

  useFocusEffect(
    useCallback(() => {
      void bookingQuery.refetch();
      void jobReportQuery.refetch();
    }, [bookingQuery.refetch, jobReportQuery.refetch]),
  );

  useLayoutEffect(() => {
    const tabNav = navigation.getParent()?.getParent();
    if (!tabNav || typeof tabNav.setOptions !== "function") return;
    tabNav.setOptions({ tabBarStyle: { display: "none" } });
    return () => {
      tabNav.setOptions({ tabBarStyle: undefined });
    };
  }, [navigation]);

  const [step, setStep] = useState(0);
  const [visitCodeInput, setVisitCodeInput] = useState("");
  const [happyCodeInput, setHappyCodeInput] = useState("");

  useEffect(() => {
    if (b?.status === "accepted") {
      setStep(startAlreadyVerified ? 1 : 0);
      restoreWizardRef.current = false;
    }
  }, [b?.id, b?.status, startAlreadyVerified]);

  useEffect(() => {
    if (!resumed || !b?.actual_start) return;
    setStep((s) => (s < 3 ? 3 : s));
  }, [resumed, b?.actual_start, b?.id]);

  const [safety, setSafety] = useState(() => emptySafetyRecord());
  const [beforeUrls, setBeforeUrls] = useState<string[]>([]);
  const [afterUrls, setAfterUrls] = useState<string[]>([]);
  const [issueNotes, setIssueNotes] = useState("");
  const [uploading, setUploading] = useState<"before" | "after" | null>(null);

  const stepKey = STEPS[step] ?? "checklist";
  const modalHeader = useModalStackHeader({
    title: b?.reference_code ?? "Field visit",
    subtitle: b
      ? `Step ${step + 1} of ${STEPS.length} · ${STEP_HEADING[stepKey]}`
      : undefined,
    onClose: () => router.back(),
    closeAccessibilityLabel: "Close field visit",
  });

  useEffect(() => {
    if (b?.status !== "in_progress" || !jobReportQuery.data || restoreWizardRef.current) return;
    restoreWizardRef.current = true;
    const r = jobReportQuery.data;
    const before = parsePhotoUrlArray(r.before_photo_urls);
    const after = parsePhotoUrlArray(r.after_photo_urls);
    setBeforeUrls(before);
    setAfterUrls(after);
    setIssueNotes(typeof r.anomaly_notes === "string" ? r.anomaly_notes : "");
    if (before.length > 0 && after.length > 0) setStep(5);
    else if (before.length > 0) setStep(4);
    else setStep(3);
  }, [b?.status, b?.id, jobReportQuery.data]);

  const elapsedMs = useJobElapsedMs(b?.actual_start, b?.actual_end);

  const startJob = useMutation({
    mutationFn: () =>
      technicianApi.technicianStartJob(supabase!, bookingId!, {
        startCode: visitCodeInput,
        preStartSafety: {
          aware_of_safety_measures: safety.aware_of_safety_measures,
          reviewed_guidelines: safety.reviewed_guidelines,
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.bookings.detail(bookingId!) });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.bookings.list({ scope: "technician-assigned" }),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.bookings.technicianActiveInProgress() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobReports.byBooking(bookingId!) });
      restoreWizardRef.current = false;
      setStep(3);
    },
    onError: (err: Error) => Alert.alert("Could not start job", err.message),
  });

  const finalize = useMutation({
    mutationFn: async () => {
      let existingChecklist: Record<string, unknown> = {};
      if (resumed && supabase && bookingId) {
        const report = await technicianApi.getJobReportByBookingId(supabase, bookingId);
        const c = report?.checklist;
        if (c && typeof c === "object" && !Array.isArray(c)) {
          existingChecklist = c as Record<string, unknown>;
        }
      }

      const checklist = resumed
        ? {
            ...existingChecklist,
            resumed_after_service_start: true,
            version: 2,
          }
        : {
            pre_start: {
              aware_of_safety_measures: safety.aware_of_safety_measures,
              reviewed_guidelines: safety.reviewed_guidelines,
              confirmed_at: new Date().toISOString(),
            },
            acknowledged_at: new Date().toISOString(),
            version: 2,
          };

      return technicianApi.technicianFinalizeJobReport(supabase!, bookingId!, {
        beforePhotoUrls: beforeUrls,
        afterPhotoUrls: afterUrls,
        anomalyNotes: issueNotes.trim() || null,
        checklist,
        happyCode: happyCodeInput,
      });
    },
    onSuccess: async (result) => {
      if (bookingId) void notifyTechnicianJobCompleted(result.booking.id);
      await queryClient.invalidateQueries({ queryKey: queryKeys.bookings.detail(bookingId!) });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.bookings.list({ scope: "technician-assigned" }),
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.bookings.technicianActiveInProgress() });
      await queryClient.invalidateQueries({ queryKey: queryKeys.jobReports.all() });
      await queryClient.invalidateQueries({ queryKey: queryKeys.jobReports.byBooking(bookingId!) });
      Alert.alert(
        "Job completed",
        "Timer stopped, completion report saved, and booking marked completed.",
        [{ text: "OK", onPress: () => router.replace("/(main)/jobs") }],
      );
    },
    onError: (err: Error) => Alert.alert("Submit failed", err.message),
  });

  async function captureAndUpload(phase: "before" | "after") {
    if (!supabase || !bookingId) return;

    const choice = await new Promise<"library" | "camera" | null>((resolve) => {
      Alert.alert("Add photo", "Choose a source", [
        { text: "Photo library", onPress: () => resolve("library") },
        { text: "Camera", onPress: () => resolve("camera") },
        { text: "Cancel", style: "cancel", onPress: () => resolve(null) },
      ]);
    });

    let uri: string | null = null;

    if (choice === "library") {
      const libraryPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!libraryPerm.granted) {
        Alert.alert("Photos", "Allow photo library access to attach evidence.");
        return;
      }
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
      });
      uri = picked.canceled ? null : (picked.assets[0]?.uri ?? null);
    } else if (choice === "camera") {
      const camPerm = await ImagePicker.requestCameraPermissionsAsync();
      if (!camPerm.granted) {
        Alert.alert("Camera", "Camera permission is required to take a photo.");
        return;
      }
      const shot = await ImagePicker.launchCameraAsync({
        quality: 0.85,
      });
      uri = shot.canceled ? null : (shot.assets[0]?.uri ?? null);
    }

    if (!uri) return;

    try {
      setUploading(phase);
      const { beforePhotoUrls, afterPhotoUrls } = await uploadAndLinkJobReportPhoto(
        supabase,
        bookingId,
        phase,
        uri,
        beforeUrls,
        afterUrls,
      );
      setBeforeUrls(beforePhotoUrls);
      setAfterUrls(afterPhotoUrls);
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobReports.byBooking(bookingId) });
    } catch (e) {
      Alert.alert("Upload failed", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setUploading(null);
    }
  }

  function toggleSafety(key: SafetyKey) {
    setSafety((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  if (!supabase || !bookingId) {
    return (
      <Screen padded edges={SCREEN_EDGES_BENEATH_NATIVE_HEADER}>
        {modalHeader}
        <Text style={styles.muted}>Missing booking.</Text>
      </Screen>
    );
  }

  if (bookingQuery.isPending) {
    return (
      <Screen padded edges={SCREEN_EDGES_BENEATH_NATIVE_HEADER}>
        {modalHeader}
        <Card variant="muted" padded>
          <SkeletonStack rows={5} />
        </Card>
      </Screen>
    );
  }

  if (bookingQuery.isError) {
    return (
      <Screen padded edges={SCREEN_EDGES_BENEATH_NATIVE_HEADER}>
        {modalHeader}
        <ErrorStateCard
          title="Couldn't load booking"
          message={(bookingQuery.error as Error).message}
          onRetry={() => void bookingQuery.refetch()}
          retryLabel="Retry"
        />
      </Screen>
    );
  }

  if (!b || !canExecute) {
    const description = !b
      ? "Booking not found."
      : b.status === "completed"
        ? "This visit is already completed."
        : `Status is ${jobStatusLabel(b.status)} - execution is only available for accepted or in-progress jobs.`;

    return (
      <Screen padded edges={SCREEN_EDGES_BENEATH_NATIVE_HEADER}>
        {modalHeader}
        <EmptyStateCard
          title="Can't run this flow"
          description={description}
          action={
            <Button variant="outline" size="md" onPress={() => navigation.goBack()}>
              Go back
            </Button>
          }
        />
      </Screen>
    );
  }

  const checklistDone = resumed || allSafetyChecked(safety);
  const stepLabel = STEPS[step] ?? "checklist";

  const startCodeTarget = (serviceOtp?.startCode ?? b.booking_code ?? "").trim();
  const startCodeRequired = startCodeTarget.length > 0;
  const startCodeOk =
    !startCodeRequired || normalizeVisitCode(visitCodeInput) === normalizeVisitCode(startCodeTarget);
  const happyCodeRequired = Boolean(serviceOtp?.happyCode);
  const happyCodeOk =
    !happyCodeRequired ||
    normalizeVisitCode(happyCodeInput) === normalizeVisitCode(serviceOtp?.happyCode ?? "");
  const minStep = resumed ? 3 : 0;

  const primaryButton = (() => {
    if (step === 0) {
      return {
        label: "Continue",
        disabled: startCodeRequired && !startCodeOk,
        loading: false,
        onPress: () => setStep(1),
      };
    }
    if (step === 1) {
      return { label: "Continue", disabled: !checklistDone, loading: false, onPress: () => setStep(2) };
    }
    if (step === 2) {
      return {
        label: "Start job & timer",
        disabled: false,
        loading: startJob.isPending,
        onPress: () => startJob.mutate(),
      };
    }
    if (step === 3) {
      return { label: "Continue", disabled: beforeUrls.length === 0, loading: false, onPress: () => setStep(4) };
    }
    if (step === 4) {
      return { label: "Continue", disabled: afterUrls.length === 0, loading: false, onPress: () => setStep(5) };
    }
    if (step === 5) {
      return { label: "Continue to submit", disabled: false, loading: false, onPress: () => setStep(6) };
    }
    return {
      label: "Submit completion report",
      disabled: beforeUrls.length === 0 || afterUrls.length === 0 || !b.actual_start || !happyCodeOk,
      loading: finalize.isPending,
      onPress: () => finalize.mutate(),
    };
  })();

  return (
    <Screen padded={false} edges={SCREEN_EDGES_BENEATH_NATIVE_HEADER}>
      {modalHeader}
      <FadeInView style={styles.fadeFlex}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.progress}>
          <Text style={styles.progressText}>
            Step {step + 1} of {STEPS.length}:{" "}
            {stepLabel === "verify"
              ? "Verify Job Start Code"
              : stepLabel === "checklist"
                ? "Safety"
                : stepLabel === "start"
                  ? "Start timer"
                  : stepLabel === "before"
                    ? "Before cleaning"
                    : stepLabel === "after"
                      ? "After cleaning"
                      : stepLabel === "issues"
                        ? "Issues (optional)"
                        : "Complete job"}
          </Text>
        </View>

        {b.actual_start ? (
          <Card variant="elevated" padded>
            <Text style={styles.timerLabel}>Job timer</Text>
            <Text style={styles.timerValue}>{formatElapsed(elapsedMs)}</Text>
            <Text style={styles.timerMeta}>Started {formatJobTimestamp(b.actual_start)}</Text>
            {b.actual_end ? (
              <Text style={styles.timerMeta}>Ended {formatJobTimestamp(b.actual_end)}</Text>
            ) : (
              <Text style={styles.timerHint}>
                End time is recorded when you submit and complete the job. Times are stored on the server so the
                timer survives app restarts.
              </Text>
            )}
          </Card>
        ) : null}

        {step === 0 ? (
          <Card variant="elevated" padded>
            <Text style={styles.sectionTitle}>Job Start Code</Text>
            <Text style={styles.bodyMuted}>
              Ask the customer for the Job Start Code shown in their app after partner acceptance. It must
              match before you continue.
            </Text>
            {startCodeRequired ? (
              <>
                <Text style={styles.label}>Job Start Code (from customer app)</Text>
                <TextInput
                  accessibilityLabel="Job Start Code from customer"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  editable={!startAlreadyVerified}
                  onChangeText={setVisitCodeInput}
                  placeholder="Same code customer sees after partner accepts"
                  placeholderTextColor={colors.mutedForeground}
                  style={styles.codeInput}
                  value={visitCodeInput}
                />
                {startAlreadyVerified ? (
                  <Text style={styles.bodyMuted}>Start code already verified for this visit.</Text>
                ) : null}
                {!startCodeOk && visitCodeInput.trim().length > 0 ? (
                  <Text style={styles.codeWarn}>Job Start Code does not match this booking.</Text>
                ) : null}
              </>
            ) : (
              <Text style={styles.bodyMuted}>
                No Job Start Code on this booking yet. Ask your vendor to assign you and accept the visit so the
                customer receives their code.
              </Text>
            )}
          </Card>
        ) : null}

        {step === 1 ? (
          <Card variant="elevated" padded>
            <Text style={styles.sectionTitle}>Safety checklist</Text>
            <Text style={styles.bodyMuted}>Confirm both items before you can start the job timer.</Text>
            <View style={styles.checklist}>
              {SAFETY_ITEMS.map((item) => (
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: safety[item.key] }}
                  key={item.key}
                  onPress={() => toggleSafety(item.key)}
                  style={({ pressed }) => [styles.checkRow, pressed && styles.checkRowPressed]}
                >
                  <Ionicons
                    name={safety[item.key] ? "checkbox" : "square-outline"}
                    size={28}
                    color={safety[item.key] ? colors.primary : colors.mutedForeground}
                  />
                  <Text style={styles.checkLabel}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
          </Card>
        ) : null}

        {step === 2 ? (
          <Card variant="elevated" padded>
            <Text style={styles.sectionTitle}>Start job</Text>
            <Text style={styles.bodyMuted}>
              This saves your start time on the server and begins the job timer. You can leave the app - the timer
              picks up from the saved start when you return.
            </Text>
          </Card>
        ) : null}

        {step === 3 ? (
          <Card variant="elevated" padded>
            <Text style={styles.sectionTitle}>Before cleaning</Text>
            <Text style={styles.bodyMuted}>
              Upload site photo(s) before cleaning. Stored in Supabase Storage and linked to this job report.
            </Text>
            <View style={styles.photoActions}>
              <Button
                loading={uploading === "before"}
                size="lg"
                variant="primary"
                onPress={() => void captureAndUpload("before")}
              >
                Upload before cleaning photo
              </Button>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbRow}>
              {beforeUrls.map((uri) => (
                <Image key={uri} source={{ uri }} style={styles.thumb} />
              ))}
            </ScrollView>
          </Card>
        ) : null}

        {step === 4 ? (
          <Card variant="elevated" padded>
            <Text style={styles.sectionTitle}>After cleaning</Text>
            <Text style={styles.bodyMuted}>
              Upload result photo(s) after cleaning. Stored in Supabase Storage and linked to this job report.
            </Text>
            <View style={styles.photoActions}>
              <Button
                loading={uploading === "after"}
                size="lg"
                variant="primary"
                onPress={() => void captureAndUpload("after")}
              >
                Upload after cleaning photo
              </Button>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbRow}>
              {afterUrls.map((uri) => (
                <Image key={uri} source={{ uri }} style={styles.thumb} />
              ))}
            </ScrollView>
          </Card>
        ) : null}

        {step === 5 ? (
          <Card variant="elevated" padded>
            <Text style={styles.sectionTitle}>Optional issues</Text>
            <Text style={styles.bodyMuted}>
              Report equipment damage, access problems, or anything operations should know. Skip if the visit was
              routine.
            </Text>
            <Text style={styles.label}>Issue details (optional)</Text>
            <TextInput
              accessibilityLabel="Optional issue or site notes"
              editable={!finalize.isPending}
              multiline
              onChangeText={setIssueNotes}
              placeholder="e.g. String 3 combiner cover loose - customer aware…"
              placeholderTextColor={colors.mutedForeground}
              style={styles.issueInput}
              textAlignVertical="top"
              value={issueNotes}
            />
          </Card>
        ) : null}

        {step === 6 ? (
          <Card variant="elevated" padded>
            <Text style={styles.sectionTitle}>Complete job</Text>
            <Text style={styles.bodyMuted}>
              Submitting stops the job timer, saves this report (including any issue notes), and sets the visit to
              completed.
            </Text>
            <Text style={styles.label}>Happy Code (from customer app)</Text>
            <Text style={styles.bodyMuted}>
              Ask the customer for the Happy Code shown in their booking after you finish cleaning.
            </Text>
            <TextInput
              accessibilityLabel="Happy Code from customer"
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!finalize.isPending}
              onChangeText={setHappyCodeInput}
              placeholder="Customer Happy Code"
              placeholderTextColor={colors.mutedForeground}
              style={styles.codeInput}
              value={happyCodeInput}
            />
            {!happyCodeOk && happyCodeInput.trim().length > 0 ? (
              <Text style={styles.codeWarn}>Happy Code does not match this booking.</Text>
            ) : null}
            <Text style={styles.meta}>Booking</Text>
            <Text style={styles.body}>{b.reference_code}</Text>
            <Text style={styles.meta}>Site</Text>
            <Text style={styles.body}>{stringifyAddressPreview(b.service_site_address) || "-"}</Text>
            <Text style={styles.meta}>Service for</Text>
            <Text style={styles.body}>{serviceForLabel(b)}</Text>
            {opsMeta && opsMeta.issue_count > 0 ? (
              <Text style={styles.opsWatchNote}>Ops watch: prioritize updates and timeline accuracy.</Text>
            ) : null}
            <Text style={styles.meta}>Evidence (Storage → job report)</Text>
            <Text style={styles.body}>
              {beforeUrls.length} before cleaning · {afterUrls.length} after cleaning
            </Text>
            {issueNotes.trim() ? (
              <>
                <Text style={styles.meta}>Issue report</Text>
                <Text style={styles.body}>{issueNotes.trim()}</Text>
              </>
            ) : null}
          </Card>
        ) : null}
      </ScrollView>
      <View style={[styles.stickyCta, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
        <View style={styles.stickyCtaRow}>
          {step > minStep ? (
            <View style={styles.stickyBtn}>
              <Button
                variant="outline"
                size="lg"
                onPress={() => setStep((s) => Math.max(minStep, s - 1))}
              >
                Back
              </Button>
            </View>
          ) : null}
          <View style={styles.stickyBtn}>
            <Button
              loading={primaryButton.loading}
              size="lg"
              variant="primary"
              disabled={primaryButton.disabled}
              onPress={primaryButton.onPress}
            >
              {primaryButton.label}
            </Button>
          </View>
        </View>
      </View>
      </FadeInView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fadeFlex: {
    flex: 1,
  },
  scroll: {
    ...modalScrollContentStyle,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  progress: {},
  progressText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
  },
  timerLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  timerValue: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.display,
    letterSpacing: 1,
    color: colors.foreground,
    marginVertical: spacing.xs,
  },
  timerHint: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.mutedForeground,
  },
  timerMeta: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  bodyMuted: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    lineHeight: 22,
    color: colors.mutedForeground,
    marginBottom: spacing.md,
  },
  label: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  issueInput: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    lineHeight: 22,
    color: colors.foreground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
    minHeight: 120,
    backgroundColor: colors.background,
  },
  body: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    lineHeight: 24,
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  opsWatchNote: {
    marginTop: spacing.xs,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.primaryBorder,
  },
  meta: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: spacing.sm,
  },
  checklist: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.background,
    minHeight: 56,
  },
  checkRowPressed: {
    opacity: 0.92,
  },
  checkLabel: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    lineHeight: 24,
    color: colors.foreground,
  },
  photoActions: {
    marginBottom: spacing.md,
  },
  thumbRow: {
    marginBottom: spacing.md,
    maxHeight: 100,
  },
  thumb: {
    width: 96,
    height: 96,
    borderRadius: 12,
    marginRight: spacing.sm,
    backgroundColor: colors.muted,
  },
  stickyCta: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  stickyCtaRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  stickyBtn: {
    flex: 1,
  },
  muted: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    color: colors.mutedForeground,
  },
  codeInput: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.lg,
    letterSpacing: 1,
    color: colors.foreground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  codeWarn: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.primary,
    marginBottom: spacing.md,
  },
});
