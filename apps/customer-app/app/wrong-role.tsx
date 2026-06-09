import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { authApi, userApi } from "@oorjaman/api";
import type { UserRole } from "@oorjaman/api";
import { colors, spacing } from "@oorjaman/config";
import { Button, Screen, SCREEN_EDGES_FULL_SCREEN } from "@oorjaman/ui";
import { fontFamily, fontSize, fontWeight } from "../constants/fonts";
import { supabase } from "../lib/supabase";

function hintForRole(role: UserRole): { title: string; body: string } {
  switch (role) {
    case "vendor":
      return {
        title: "Partner accounts use the web portal",
        body: "Solar cleaning partners sign in through the Oorjaman partner web dashboard in a browser - not this customer mobile app. Sign out here and open the partner portal URL from your invitation or operations contact.",
      };
    case "technician":
      return {
        title: "Use the partner app",
        body: "This account is for field partners. Install and open the OorjaMan Partner app on your device.",
      };
    case "admin":
      return {
        title: "Administrator sign-in",
        body: "Operations and analytics run in the browser dashboard. Open the admin URL provided by your team.",
      };
    default:
      return {
        title: "Different account type",
        body: "You signed in with an account that does not use this customer app.",
      };
  }
}

export default function WrongRoleForCustomerAppScreen() {
  const [copy, setCopy] = useState<{ title: string; body: string } | null>(null);

  useEffect(() => {
    if (!supabase) return;
    void userApi.getMyUserRecord(supabase).then((u) => {
      if (!u || u.role === "customer") {
        router.replace("/(main)");
        return;
      }
      setCopy(hintForRole(u.role));
    });
  }, []);

  const onSignOut = useCallback(async () => {
    if (!supabase) return;
    await authApi.signOut(supabase);
    router.replace("/login");
  }, []);

  return (
    <Screen padded edges={SCREEN_EDGES_FULL_SCREEN}>
      <View style={styles.wrap}>
        <Text style={styles.title}>{copy?.title ?? "Checking account…"}</Text>
        <Text style={styles.body}>{copy?.body ?? "One moment."}</Text>
        <Button variant="primary" onPress={() => void onSignOut()} disabled={!copy}>
          Sign out
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
    marginBottom: spacing.sm,
  },
});
