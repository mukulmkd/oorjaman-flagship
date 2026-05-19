import { useEffect, useRef } from "react";
import { Alert, AppState, LogBox, type AppStateStatus } from "react-native";

const MOBILE_AUTH_LOG_IGNORES = [
  /Invalid Refresh Token/i,
  /Refresh Token Not Found/i,
  /Auto refresh tick failed with error/i,
];

let mobileAuthLogFiltersInstalled = false;

/** Call once at app entry (before Supabase client use) to avoid red LogBox noise for stale tokens. */
export function installMobileAuthConsoleFilters(): void {
  if (mobileAuthLogFiltersInstalled) return;
  mobileAuthLogFiltersInstalled = true;
  LogBox.ignoreLogs(MOBILE_AUTH_LOG_IGNORES);
}
import { useRouter, useSegments } from "expo-router";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AUTH_SIGN_IN_AGAIN_MESSAGE,
  AUTH_SIGN_IN_AGAIN_TITLE,
  attachMobileAuthSessionGuard,
  registerMobileSessionExpiredHandler,
} from "@oorjaman/api";
import type { Database } from "@oorjaman/api";

type Props = {
  client: SupabaseClient<Database> | null;
  /** Route to open when session is invalid, e.g. `/login` or `/technician-login`. */
  loginHref: string;
  /** Top-level segment for signed-in area, usually `(main)`. */
  protectedSegment?: string;
};

/**
 * Handles expired / invalid Supabase refresh tokens on mobile: clears local session,
 * shows a single alert, and routes to login. Also pauses token refresh while the app
 * is in the background (Supabase RN recommendation).
 */
export function MobileAuthSessionGuard({
  client,
  loginHref,
  protectedSegment = "(main)",
}: Props) {
  const router = useRouter();
  const segments = useSegments();
  const segmentsRef = useRef(segments);
  segmentsRef.current = segments;

  const alertVisibleRef = useRef(false);

  useEffect(() => {
    if (!client) return;
    installMobileAuthConsoleFilters();

    const isProtectedRoute = () => segmentsRef.current[0] === protectedSegment;

    const goToLogin = () => {
      alertVisibleRef.current = false;
      router.replace(loginHref as never);
    };

    const onRequireSignIn = () => {
      if (!isProtectedRoute()) return;
      if (alertVisibleRef.current) return;
      alertVisibleRef.current = true;

      Alert.alert(
        AUTH_SIGN_IN_AGAIN_TITLE,
        AUTH_SIGN_IN_AGAIN_MESSAGE,
        [{ text: "Sign in", onPress: goToLogin }],
        { cancelable: false },
      );
    };

    registerMobileSessionExpiredHandler(() => onRequireSignIn());

    const detachAuth = attachMobileAuthSessionGuard(client, {
      isProtectedRoute,
      onRequireSignIn: () => onRequireSignIn(),
    });

    const onAppState = (state: AppStateStatus) => {
      if (state === "active") {
        void client.auth.startAutoRefresh();
      } else {
        void client.auth.stopAutoRefresh();
      }
    };

    void client.auth.startAutoRefresh();
    const appStateSub = AppState.addEventListener("change", onAppState);

    return () => {
      registerMobileSessionExpiredHandler(null);
      detachAuth();
      appStateSub.remove();
      void client.auth.stopAutoRefresh();
    };
  }, [client, loginHref, protectedSegment, router]);

  return null;
}
