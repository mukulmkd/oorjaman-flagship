import { useCallback, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { authApi, markUserInitiatedSignOut, userApi } from "@oorjaman/api";
import { colors, publicLegalUrls, spacing } from "@oorjaman/config";
import { Button, KEYBOARD_AVOIDING_BEHAVIOR, ModalSheetHeader, modalBodyInsetStyle } from "@oorjaman/ui";
import { fontFamily, fontSize } from "../constants/fonts";
import { clearPartnerSessionQueries } from "../lib/partner-session-cache";
import { supabase } from "../lib/supabase";

const SUPPORT_DELETE_MAILTO =
  "mailto:support@oorjaman.com?subject=" + encodeURIComponent("Partner account deletion request");

type Props = {
  size?: "md" | "lg";
  disabled?: boolean;
};

export function DeletePartnerAccountButton({ size = "md", disabled = false }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const confirmed = confirmText.trim().toUpperCase() === "DELETE";

  const close = useCallback(() => {
    if (busy) return;
    setOpen(false);
    setConfirmText("");
  }, [busy]);

  const confirmDelete = useCallback(async () => {
    if (!supabase) return;
    if (!confirmed) {
      Alert.alert("Confirm deletion", "Type DELETE in capital letters to confirm.");
      return;
    }
    setBusy(true);
    try {
      const result = await userApi.requestDeleteMyTechnicianAccount(supabase);
      if (!result.ok) {
        Alert.alert("Could not delete account", result.message);
        return;
      }
      setOpen(false);
      setConfirmText("");
      markUserInitiatedSignOut();
      try {
        await authApi.signOut(supabase);
      } catch {
        /* session may already be invalid after auth user delete */
      }
      clearPartnerSessionQueries(qc);
      Alert.alert("Account deleted", "Your OorjaMan Partner account has been deleted.");
      router.replace("/login");
    } catch (e) {
      Alert.alert("Could not delete account", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }, [confirmed, qc]);

  return (
    <>
      <Button
        variant="destructive"
        size={size}
        disabled={disabled || busy}
        onPress={() => {
          setConfirmText("");
          setOpen(true);
        }}
      >
        Delete account
      </Button>
      <Modal visible={open} animationType="slide" transparent onRequestClose={close}>
        <KeyboardAvoidingView behavior={KEYBOARD_AVOIDING_BEHAVIOR} style={styles.backdrop}>
          <View style={styles.sheet}>
            <ModalSheetHeader
              title="Delete your account?"
              subtitle="This removes your sign-in, profile, identity documents, and location history. Completed visits stay on record without your personal details. A visit that has already started must be finished first. If a visit is assigned and has not started, your employer moves it with Change technician in the vendor portal."
              onClose={close}
              closeAccessibilityLabel="Close delete account dialog"
              showClose={!busy}
            />
            <View style={modalBodyInsetStyle}>
              <Text style={styles.hint}>Type DELETE to confirm</Text>
              <TextInput
                value={confirmText}
                onChangeText={setConfirmText}
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!busy}
                placeholder="DELETE"
                placeholderTextColor={colors.mutedForeground}
                style={styles.input}
              />
              <View style={styles.actions}>
                <Button
                  variant="destructive"
                  size="md"
                  loading={busy}
                  disabled={busy || !confirmed}
                  onPress={() => void confirmDelete()}
                >
                  Permanently delete
                </Button>
                <Button
                  variant="outline"
                  size="md"
                  disabled={busy}
                  onPress={() => void Linking.openURL(SUPPORT_DELETE_MAILTO)}
                >
                  Email support instead
                </Button>
                <Pressable
                  accessibilityRole="link"
                  onPress={() => void Linking.openURL(publicLegalUrls.accountDeletion())}
                  style={styles.policyWrap}
                >
                  <Text style={styles.policy}>Account deletion policy</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15, 41, 56, 0.45)",
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: spacing.xl,
    maxHeight: "88%",
  },
  hint: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.md,
    color: colors.foreground,
    backgroundColor: colors.background,
    marginBottom: spacing.md,
  },
  actions: {
    gap: spacing.sm,
  },
  policyWrap: {
    alignSelf: "flex-start",
    paddingVertical: spacing.xs,
  },
  policy: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.primary,
    textDecorationLine: "underline",
  },
});
