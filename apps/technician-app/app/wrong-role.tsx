import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { authApi, resolveTechnicianAppPostAuthPath, userApi } from "@oorjaman/api";
import type { UserRole } from "@oorjaman/api";
import { colors, spacing } from "@oorjaman/config";
import { Button, Screen, SCREEN_EDGES_FULL_SCREEN } from "@oorjaman/ui";
import { fontFamily, fontSize, fontWeight } from "../constants/fonts";
import { supabase } from "../lib/supabase";

function hintForRole(role: UserRole | undefined): { title: string; body: string } {
  switch (role) {
    case "customer":
    case "vendor":
      return {
        title: "Use the customer app",
        body: "Book visits and manage AMC in the OorjaMan Customer app.",
      };
    case "admin":
      return {
        title: "Administrator access",
        body: "Use the admin dashboard in your web browser.",
      };
    default:
      return {
        title: "Wrong account for this app",
        body: "This install is for OorjaMan partners only.",
      };
  }
}

export default function WrongRoleForTechnicianAppScreen() {
  const [copy, setCopy] = useState<{ title: string; body: string } | null>(null);

  useEffect(() => {
    if (!supabase) return;
    void (async () => {
      try {
        const session = await authApi.getSession(supabase);
        if (!session?.user) {
          router.replace("/login");
          return;
        }
        const path = await resolveTechnicianAppPostAuthPath(supabase);
        if (path !== "/wrong-role") {
          router.replace(path);
          return;
        }
        const u = await userApi.getMyUserRecord(supabase);
        setCopy(hintForRole(u?.role));
      } catch {
        router.replace("/login");
      }
    })();
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
