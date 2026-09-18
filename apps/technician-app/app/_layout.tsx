import "react-native-url-polyfill/auto";

import { useEffect, useState } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import Head from "expo-router/head";
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
import { HelpSupportProvider } from "../components/help-support-provider";
import {
  installMobileAuthConsoleFilters,
  installWebFocusReset,
  keepNativeSplashScreenVisible,
  MobileAuthSessionGuard,
  MobileOfflineGate,
  USE_WEB_LAYOUT,
  webModalContentStyle,
  webPageCanvasStyle,
} from "@oorjaman/ui";
import { hideNativeSplashScreenOnce } from "@oorjaman/ui/safe-splash-screen";
import { supabase } from "../lib/supabase";
import { AppKeyboardProvider } from "../lib/platform/keyboard";
import { initAppNotificationHandlers } from "../lib/platform/notifications";

installMobileAuthConsoleFilters();
keepNativeSplashScreenVisible();
installWebFocusReset();

const webModalOptions = USE_WEB_LAYOUT
  ? { contentStyle: webModalContentStyle({ backgroundColor: colors.background }) }
  : {};

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
    initAppNotificationHandlers();
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

  const stack = (
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
          ...webModalOptions,
        }}
      />
      <Stack.Screen name="(main)" options={{ animation: "fade" }} />
    </Stack>
  );

  return (
    <AppKeyboardProvider>
      <Head>
        <meta name="robots" content="noindex, nofollow" />
        <link rel="icon" type="image/png" href="/favicon.png" />
        <link rel="shortcut icon" href="/favicon.ico" />
      </Head>
      <SafeAreaProvider>
        <QueryProvider>
          <HelpSupportProvider>
            <MobileOfflineGate>
              <MobileAuthSessionGuard client={supabase} loginHref="/login" />
              <StatusBar style="dark" />
              {USE_WEB_LAYOUT ? (
                <View style={webPageCanvasStyle()}>{stack}</View>
              ) : (
                stack
              )}
            </MobileOfflineGate>
          </HelpSupportProvider>
        </QueryProvider>
      </SafeAreaProvider>
    </AppKeyboardProvider>
  );
}
