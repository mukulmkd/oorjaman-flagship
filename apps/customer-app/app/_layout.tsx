import "react-native-url-polyfill/auto";

import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { Stack } from "expo-router";
import * as Font from "expo-font";
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from "@expo-google-fonts/plus-jakarta-sans";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { colors } from "@oorjaman/config";
import { QueryProvider } from "../providers/query-provider";
import {
  hideNativeSplashScreenOnce,
  keepNativeSplashScreenVisible,
  MobileAuthSessionGuard,
  MobileOfflineGate,
} from "@oorjaman/ui";
import { SupportChatHeaderButton } from "../components/help-header-button";
import { supabase } from "../lib/supabase";
import { HelpSupportProvider } from "../components/help-support-provider";
import { SitePhotoStampProvider } from "../components/site-photo-stamp-provider";
import { initBookingNotificationHandler } from "@oorjaman/ui";
import { fontFamily, fontSize } from "../constants/fonts";

initBookingNotificationHandler();

keepNativeSplashScreenVisible();

/** Root modals: hide stack back control (we use header close), center title on Android, bottom sheet–style enter on Android. */
const customerModalHeaderOptions = {
  headerBackVisible: false,
  ...(Platform.OS === "android" ? ({ animation: "slide_from_bottom" } as const) : {}),
};

export default function RootLayout() {
  const [fontsReady, setFontsReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        await Font.loadAsync({
          PlusJakartaSans_400Regular,
          PlusJakartaSans_500Medium,
          PlusJakartaSans_600SemiBold,
          PlusJakartaSans_700Bold,
        });
      } catch {
        // Graceful fallback to system fonts when loading fails.
      } finally {
        if (mounted) setFontsReady(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (fontsReady) void hideNativeSplashScreenOnce();
  }, [fontsReady]);

  if (!fontsReady) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <QueryProvider>
        <MobileOfflineGate>
          <MobileAuthSessionGuard client={supabase} loginHref="/login" />
          <HelpSupportProvider>
        <SitePhotoStampProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            animation: "fade",
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="permissions" />
        <Stack.Screen name="login" />
        <Stack.Screen name="customer-registration" />
        <Stack.Screen
          name="book"
          options={{
            presentation: "modal",
            headerShown: false,
            ...customerModalHeaderOptions,
          }}
        />
        <Stack.Screen
          name="preferred-partner"
          options={{
            presentation: "modal",
            headerShown: false,
            ...customerModalHeaderOptions,
          }}
        />
        <Stack.Screen
          name="booking-detail"
          options={{
            presentation: "modal",
            headerShown: false,
            ...customerModalHeaderOptions,
          }}
        />
        <Stack.Screen
          name="booking-track"
          options={{
            presentation: "modal",
            headerShown: false,
            ...customerModalHeaderOptions,
          }}
        />
        <Stack.Screen
          name="booking-reschedule"
          options={{
            presentation: "modal",
            headerShown: false,
            ...customerModalHeaderOptions,
          }}
        />
        <Stack.Screen name="wrong-role" />
        <Stack.Screen name="(main)" options={{ animation: "fade" }} />
        </Stack>
        </SitePhotoStampProvider>
          </HelpSupportProvider>
        </MobileOfflineGate>
      </QueryProvider>
    </SafeAreaProvider>
  );
}
