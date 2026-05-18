import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, Text } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { createTechnicianDocumentSignedUrl, queryKeys, technicianApi } from "@oorjaman/api";
import type { TechnicianDocKind, TechnicianRow } from "@oorjaman/api";
import {
  Button,
  Card,
  modalScrollContentStyle,
  Screen,
  SCREEN_EDGES_BENEATH_NATIVE_HEADER,
  useModalStackHeader,
} from "@oorjaman/ui";
import { colors, spacing } from "@oorjaman/config";
import { fontFamily, fontSize } from "../constants/fonts";
import { supabase } from "../lib/supabase";

const DOC_ROWS: { kind: TechnicianDocKind; label: string; field: keyof TechnicianRow }[] = [
  { kind: "aadhaar", label: "Aadhaar copy", field: "doc_aadhaar_url" },
  { kind: "pan", label: "PAN copy", field: "doc_pan_url" },
  { kind: "passport_photo", label: "Passport photo", field: "doc_passport_url" },
  { kind: "safety_certificate", label: "Safety certificate", field: "doc_safety_certificate_url" },
  { kind: "bank_proof", label: "Bank proof", field: "doc_bank_proof_url" },
];

export default function ProfileDocumentsScreen() {
  const router = useRouter();
  const [opening, setOpening] = useState<string | null>(null);

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

  const openDoc = useCallback(async (kind: TechnicianDocKind, path: string) => {
    if (!supabase) return;
    setOpening(kind);
    try {
      const url = await createTechnicianDocumentSignedUrl(supabase, path);
      const ok = await Linking.canOpenURL(url);
      if (!ok) {
        Alert.alert("Cannot open", "No app available to view this document.");
        return;
      }
      await Linking.openURL(url);
    } catch (e) {
      Alert.alert("Could not open document", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setOpening(null);
    }
  }, []);

  const tech = techQ.data;

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
          contentContainerStyle={[modalScrollContentStyle, styles.list]}
        >
          <Text style={styles.lede}>Registration uploads stored for your OorjaMan profile.</Text>
          {DOC_ROWS.map((row) => {
            const path = tech?.[row.field];
            const stored = typeof path === "string" && path.trim().length > 0;
            return (
              <Card key={row.kind} variant="elevated" padded>
                <Text style={styles.docLabel}>{row.label}</Text>
                <Text style={styles.docMeta}>{stored ? "On file" : "Not uploaded"}</Text>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!stored || opening === row.kind}
                  loading={opening === row.kind}
                  onPress={() => stored && void openDoc(row.kind, path as string)}
                >
                  View
                </Button>
              </Card>
            );
          })}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  lede: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    lineHeight: 22,
    color: colors.mutedForeground,
  },
  list: {
    gap: spacing.md,
  },
  docLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.md,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  docMeta: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
    marginBottom: spacing.md,
  },
});
