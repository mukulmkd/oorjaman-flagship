import "react-native-url-polyfill/auto";

import { useEffect, useState } from "react";
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
import { HelpSupportProvider } from "../components/help-support-provider";
import {
  hideNativeSplashScreenOnce,
  initBookingNotificationHandler,
  initSupportChatNotificationHandler,
  installMobileAuthConsoleFilters,
  keepNativeSplashScreenVisible,
  MobileAuthSessionGuard,
  MobileOfflineGate,
} from "@oorjaman/ui";

installMobileAuthConsoleFilters();
import { supabase } from "../lib/supabase";

initBookingNotificationHandler();
initSupportChatNotificationHandler();

keepNativeSplashScreenVisible();

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
        <HelpSupportProvider>
        <MobileOfflineGate>
          <MobileAuthSessionGuard client={supabase} loginHref="/login" />
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
          <Stack.Screen name="technician-onboarding" />
          <Stack.Screen name="pending-vendor-review" />
          <Stack.Screen name="vendor-not-onboarded" />
          <Stack.Screen name="wrong-role" />
          <Stack.Screen
            name="profile-documents"
            options={{
              presentation: "modal",
              headerShown: false,
              animation: "slide_from_right",
            }}
          />
          <Stack.Screen name="(main)" options={{ animation: "fade" }} />
        </Stack>
        </MobileOfflineGate>
        </HelpSupportProvider>
      </QueryProvider>
    </SafeAreaProvider>
  );
}
