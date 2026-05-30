import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { createTechnicianDocumentSignedUrl, queryKeys, technicianApi } from "@oorjaman/api";
import type { TechnicianDocKind, TechnicianRow } from "@oorjaman/api";
import {
  Card,
  modalScrollContentStyle,
  Screen,
  SCREEN_EDGES_BENEATH_NATIVE_HEADER,
  useModalStackHeader,
} from "@oorjaman/ui";
import { DocumentViewerModal } from "../components/document-viewer-modal";
import { colors, spacing } from "@oorjaman/config";
import { fontFamily, fontSize } from "../constants/fonts";
import { basenameFromStoragePath, documentPreviewKind } from "../lib/document-preview";
import { supabase } from "../lib/supabase";

const DOC_ROWS: { kind: TechnicianDocKind; label: string; field: keyof TechnicianRow }[] = [
  { kind: "aadhaar", label: "Aadhaar copy", field: "doc_aadhaar_url" },
  { kind: "pan", label: "PAN copy", field: "doc_pan_url" },
  { kind: "passport_photo", label: "Passport photo", field: "doc_passport_url" },
  { kind: "safety_certificate", label: "Safety certificate", field: "doc_safety_certificate_url" },
  { kind: "bank_proof", label: "Bank proof", field: "doc_bank_proof_url" },
];

function docRowIcon(kind: TechnicianDocKind, storagePath: string | null): keyof typeof Ionicons.glyphMap {
  if (kind === "passport_photo") return "person-circle-outline";
  if (storagePath && documentPreviewKind(storagePath) === "pdf") return "document-text-outline";
  return "image-outline";
}

export default function ProfileDocumentsScreen() {
  const router = useRouter();
  const [opening, setOpening] = useState<TechnicianDocKind | null>(null);
  const [viewer, setViewer] = useState<{
    kind: TechnicianDocKind;
    label: string;
    url: string;
    storagePath: string;
  } | null>(null);

  const modalHeader = useModalStackHeader({
    title: "Documents",
    onClose: () => router.back(),
    closeAccessibilityLabel: "Close documents",
  });

  const techQ = useQuery({
    queryKey: queryKeys.technicians.me(),
    queryFn: () => technicianApi.getMyTechnicianProfile(supabase!),
    enabled: Boolean(supabase),
  });

  const openDoc = useCallback(async (kind: TechnicianDocKind, label: string, path: string) => {
    if (!supabase) return;
    setOpening(kind);
    try {
      const url = await createTechnicianDocumentSignedUrl(supabase, path);
      setViewer({ kind, label, url, storagePath: path });
    } catch (e) {
      Alert.alert("Could not open document", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setOpening(null);
    }
  }, []);

  const tech = techQ.data;
  const uploadedCount = DOC_ROWS.filter((row) => {
    const path = tech?.[row.field];
    return typeof path === "string" && path.trim().length > 0;
  }).length;

  return (
    <Screen padded={false} edges={SCREEN_EDGES_BENEATH_NATIVE_HEADER}>
      {modalHeader}
      {techQ.isPending ? (
        <View style={modalScrollContentStyle}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[modalScrollContentStyle, styles.scroll]}
        >
          <Text style={styles.lede}>
            Verification documents from your OorjaMan registration. Tap an uploaded item to preview it here.
          </Text>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryText}>
              {uploadedCount} of {DOC_ROWS.length} uploaded
            </Text>
          </View>

          <Card variant="elevated" padded={false}>
            {DOC_ROWS.map((row, index) => {
              const path = tech?.[row.field];
              const stored = typeof path === "string" && path.trim().length > 0;
              const busy = opening === row.kind;
              const filename = stored ? basenameFromStoragePath(path as string) : null;

              return (
                <Pressable
                  key={row.kind}
                  accessibilityRole="button"
                  accessibilityLabel={
                    stored ? `${row.label}, uploaded, tap to preview` : `${row.label}, not uploaded`
                  }
                  disabled={!stored || busy}
                  onPress={() => stored && void openDoc(row.kind, row.label, path as string)}
                  style={({ pressed }) => [
                    styles.row,
                    index < DOC_ROWS.length - 1 && styles.rowBorder,
                    pressed && stored && styles.rowPressed,
                    !stored && styles.rowDisabled,
                  ]}
                >
                  <View style={[styles.iconWrap, stored ? styles.iconWrapReady : styles.iconWrapMissing]}>
                    <Ionicons
                      name={docRowIcon(row.kind, stored ? (path as string) : null)}
                      size={22}
                      color={stored ? colors.primary : colors.mutedForeground}
                    />
                  </View>

                  <View style={styles.rowBody}>
                    <Text style={styles.rowLabel}>{row.label}</Text>
                    <Text style={styles.rowHint} numberOfLines={1}>
                      {stored
                        ? busy
                          ? "Opening…"
                          : filename ?? "Tap to preview"
                        : "Not uploaded - complete onboarding to add"}
                    </Text>
                  </View>

                  <View style={styles.rowTrailing}>
                    {busy ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : stored ? (
                      <>
                        <View style={styles.uploadedBadge}>
                          <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                          <Text style={styles.uploadedText}>Uploaded</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
                      </>
                    ) : (
                      <Text style={styles.missingText}>Missing</Text>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </Card>
        </ScrollView>
      )}

      <DocumentViewerModal
        visible={Boolean(viewer)}
        title={viewer?.label ?? "Document"}
        url={viewer?.url ?? null}
        storagePath={viewer?.storagePath ?? ""}
        onClose={() => setViewer(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    gap: spacing.md,
  },
  lede: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    lineHeight: 22,
    color: colors.mutedForeground,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  summaryText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.foreground,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 72,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowPressed: {
    opacity: 0.94,
  },
  rowDisabled: {
    opacity: 0.72,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapReady: {
    backgroundColor: colors.primaryMuted,
  },
  iconWrapMissing: {
    backgroundColor: colors.muted,
  },
  rowBody: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  rowLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.md,
    color: colors.foreground,
  },
  rowHint: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
  },
  rowTrailing: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    flexShrink: 0,
  },
  uploadedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  uploadedText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.primary,
  },
  missingText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.mutedForeground,
  },
});
