import { useCallback, useEffect, useRef } from "react";
import { BackHandler, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { authApi } from "@oorjaman/api";
import { colors, spacing } from "@oorjaman/config";
import { Button, Screen, SCREEN_EDGES_FULL_SCREEN } from "@oorjaman/ui";
import { fontFamily, fontSize } from "../constants/fonts";
import { supabase } from "../lib/supabase";

/**
 * Shown when a technician signs in with a phone number that has no vendor invite
 * and no existing technician profile. Session is cleared so reopening the app
 * returns to splash → login.
 */
export default function VendorNotOnboardedScreen() {
  const signedOutRef = useRef(false);

  const returnToSignIn = useCallback(async () => {
    if (supabase) {
      try {
        await authApi.signOut(supabase);
      } catch {
        /* still navigate */
      }
    }
    router.replace("/login");
  }, []);

  useEffect(() => {
    if (!supabase || signedOutRef.current) return;
    signedOutRef.current = true;
    void authApi.signOut(supabase).catch(() => {
      /* show message anyway */
    });
  }, []);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      void returnToSignIn();
      return true;
    });
    return () => sub.remove();
  }, [returnToSignIn]);

  return (
    <Screen padded edges={SCREEN_EDGES_FULL_SCREEN}>
      <View style={styles.wrap}>
        <Text style={styles.title}>Not onboarded yet</Text>
        <Text style={styles.body}>
          Your vendor has not onboarded you yet. Contact your vendor for the same.
        </Text>
        <Text style={styles.hint}>
          Ask them to add your mobile number from the partner portal, then sign in again with that number.
        </Text>
        <Button variant="primary" size="lg" onPress={() => void returnToSignIn()}>
          Return to sign in
        </Button>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: "center",
    gap: spacing.md,
    paddingVertical: spacing.xl,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    color: colors.foreground,
  },
  body: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    lineHeight: 24,
    color: colors.mutedForeground,
  },
  hint: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
  },
});
