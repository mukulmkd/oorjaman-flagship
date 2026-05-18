import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Href } from "expo-router";
import { router } from "expo-router";
import { authApi, resolveTechnicianAppPostAuthPath } from "@oorjaman/api";
import { colors } from "@oorjaman/config";
import { fontFamily, fontSize, fontWeight } from "../constants/fonts";
import {
  STORAGE_KEY_LOCATION_PROMPT_DONE,
  STORAGE_KEY_ONBOARDING,
} from "../constants/storage";
import { supabase } from "../lib/supabase";

const MIN_SPLASH_MS = 1200;

export default function SplashRoute() {
  const opacity = useRef(new Animated.Value(0)).current;
  const cancelledRef = useRef(false);

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 480,
      useNativeDriver: true,
    }).start();
  }, [opacity]);

  useEffect(() => {
    const run = async () => {
      const started = Date.now();
      let signedIn = false;
      if (supabase) {
        try {
          const session = await authApi.recoverStoredSupabaseSession(supabase);
          signedIn = Boolean(session?.user);
        } catch {
          signedIn = false;
        }
      }

      const [onboardingDone, locationPromptDone] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY_ONBOARDING),
        AsyncStorage.getItem(STORAGE_KEY_LOCATION_PROMPT_DONE),
      ]);

      const waited = Date.now() - started;
      await new Promise((r) => setTimeout(r, Math.max(0, MIN_SPLASH_MS - waited)));
      if (cancelledRef.current) return;

      let dest: Href;
      if (signedIn) {
        if (supabase) {
          try {
            dest = (await resolveTechnicianAppPostAuthPath(supabase)) as Href;
          } catch {
            dest = "/wrong-role" as Href;
          }
        } else {
          dest = "/(main)";
        }
      } else if (onboardingDone !== "true") {
        dest = "/onboarding";
      } else if (locationPromptDone !== "true") {
        dest = "/permissions";
      } else {
        dest = "/login";
      }

      Animated.timing(opacity, {
        toValue: 0,
        duration: 360,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished && !cancelledRef.current) {
          router.replace(dest);
        }
      });
    };

    void run();
    return () => {
      cancelledRef.current = true;
    };
  }, [opacity]);

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.block, { opacity }]}>
        <View style={styles.logo}>
          <Text style={styles.logoLetter}>O</Text>
        </View>
        <Text style={styles.title}>OorjaMan</Text>
        <Text style={styles.tagline}>Field jobs, clear workflow.</Text>
        <Text style={styles.badge}>Technician</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  block: {
    alignItems: "center",
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  logoLetter: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.display,
    color: colors.primaryForeground,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxl,
    letterSpacing: -0.5,
    color: colors.foreground,
  },
  tagline: {
    marginTop: 8,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    color: colors.mutedForeground,
    textAlign: "center",
  },
  badge: {
    marginTop: 16,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
});
