import "react-native-url-polyfill/auto";

import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { Stack } from "expo-router";
import { useFonts } from "expo-font";
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
  installMobileAuthConsoleFilters,
  initBookingNotificationHandler,
  initSupportChatNotificationHandler,
  keepNativeSplashScreenVisible,
  MobileAuthSessionGuard,
  MobileOfflineGate,
} from "@oorjaman/ui";
import { hideNativeSplashScreenOnce } from "@oorjaman/ui/safe-splash-screen";
import { supabase } from "../lib/supabase";
import { HelpSupportProvider } from "../components/help-support-provider";
import { CustomerPostLoginPromptsProvider } from "../components/customer-post-login-prompts";
import { SitePhotoStampProvider } from "../components/site-photo-stamp-provider";

installMobileAuthConsoleFilters();
keepNativeSplashScreenVisible();

/** Root modals: hide stack back control (we use header close), center title on Android, bottom sheet-style enter on Android. */
const customerModalHeaderOptions = {
  headerBackVisible: false,
  ...(Platform.OS === "android" ? ({ animation: "slide_from_bottom" } as const) : {}),
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });
  const [devFontFallback, setDevFontFallback] = useState(false);

  const fontsReady = fontsLoaded || fontError || (__DEV__ && devFontFallback);

  useEffect(() => {
    initBookingNotificationHandler();
    initSupportChatNotificationHandler();
  }, []);

  useEffect(() => {
    if (!__DEV__ || fontsLoaded || fontError) return;
    const timer = setTimeout(() => setDevFontFallback(true), 2_000);
    return () => clearTimeout(timer);
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    if (fontsReady) {
      void hideNativeSplashScreenOnce();
    }
  }, [fontsReady]);

  if (!fontsReady) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <QueryProvider>
        <MobileOfflineGate>
          <MobileAuthSessionGuard client={supabase} loginHref="/login" />
          <CustomerPostLoginPromptsProvider initiallyAllowed={false}>
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
            presentation: Platform.OS === "ios" ? "transparentModal" : "modal",
            headerShown: false,
            contentStyle: Platform.OS === "ios" ? { backgroundColor: "transparent" } : undefined,
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
        <Stack.Screen
          name="credits"
          options={{
            presentation: Platform.OS === "ios" ? "transparentModal" : "modal",
            headerShown: false,
            contentStyle: Platform.OS === "ios" ? { backgroundColor: "transparent" } : undefined,
            ...customerModalHeaderOptions,
          }}
        />
        <Stack.Screen
          name="support-chat"
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
          </CustomerPostLoginPromptsProvider>
        </MobileOfflineGate>
      </QueryProvider>
    </SafeAreaProvider>
  );
}
