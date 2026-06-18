import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Href } from "expo-router";
import { router } from "expo-router";
import { resolveTechnicianAppPostAuthPath } from "@oorjaman/api";
import {
  BrandSplash,
  SPLASH_LOADING_DELAY_MS,
  SPLASH_LOADING_FILL_MS,
  SPLASH_LOADING_FADE_MS,
} from "@oorjaman/ui";
import {
  STORAGE_KEY_LOCATION_PROMPT_DONE,
  STORAGE_KEY_ONBOARDING,
} from "../constants/storage";
import { supabase, supabaseAuthReady } from "../lib/supabase";

/** Max wait if the loading animation is interrupted (e.g. React Strict Mode). */
const SPLASH_MAX_WAIT_MS =
  SPLASH_LOADING_DELAY_MS + SPLASH_LOADING_FADE_MS + SPLASH_LOADING_FILL_MS + 800;

export default function SplashRoute() {
  const fadeOut = useRef(new Animated.Value(1)).current;
  const navigatedRef = useRef(false);
  const splashCompleteRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;
    let splashTimeout: ReturnType<typeof setTimeout> | undefined;

    const splashDone = new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      splashCompleteRef.current = finish;
      splashTimeout = setTimeout(finish, SPLASH_MAX_WAIT_MS);
    });

    void (async () => {
      const bootstrap = (async () => {
        let signedIn = false;
        if (supabase) {
          try {
            const session = await supabaseAuthReady;
            signedIn = Boolean(session?.user);
          } catch {
            signedIn = false;
          }
        }

        const [onboardingDone, locationPromptDone] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_ONBOARDING),
          AsyncStorage.getItem(STORAGE_KEY_LOCATION_PROMPT_DONE),
        ]);

        return { signedIn, onboardingDone, locationPromptDone };
      })();

      const [, boot] = await Promise.all([splashDone, bootstrap]);
      if (cancelled || navigatedRef.current) return;

      const { signedIn, onboardingDone, locationPromptDone } = boot;

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

      Animated.timing(fadeOut, {
        toValue: 0,
        duration: 360,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished && !cancelled && !navigatedRef.current) {
          navigatedRef.current = true;
          router.replace(dest);
        }
      });
    })();

    return () => {
      cancelled = true;
      if (splashTimeout) clearTimeout(splashTimeout);
      splashCompleteRef.current = null;
    };
  }, [fadeOut]);

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.fill, { opacity: fadeOut }]}>
        <BrandSplash variant="partner" onAnimationsComplete={() => splashCompleteRef.current?.()} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  fill: {
    flex: 1,
  },
});
