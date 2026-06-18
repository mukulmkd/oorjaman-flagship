import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import { useQuery } from "@tanstack/react-query";
import { customerApi, customerPushApi, queryKeys, userApi } from "@oorjaman/api";
import {
  getExpoNotifications,
  initBookingNotificationHandler,
  isNativeNotificationsSupported,
  runAfterUiSettled,
} from "@oorjaman/ui";
import { supabase } from "../lib/supabase";
import { useCustomerPostLoginPrompts } from "./customer-post-login-prompts";

function resolveExpoProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  const fromExtra = extra?.eas?.projectId?.trim();
  if (fromExtra) return fromExtra;
  const fromEas = (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId?.trim();
  return fromEas || undefined;
}

/**
 * Registers the device Expo push token for remote support (and future) notifications.
 * Requires a physical device and EXPO_PUBLIC_EAS_PROJECT_ID (or EAS project in app config).
 */
export function CustomerPushRegistration() {
  const registeredTokenRef = useRef<string | null>(null);
  const { backgroundPromptsAllowed } = useCustomerPostLoginPrompts();

  const userQ = useQuery({
    queryKey: queryKeys.users.me(),
    queryFn: () => userApi.getMyUserRecord(supabase!),
    enabled: Boolean(supabase),
  });

  const custQ = useQuery({
    queryKey: queryKeys.customers.mine(),
    queryFn: () => customerApi.getMyCustomer(supabase!),
    enabled: Boolean(supabase) && userQ.data?.role === "customer",
  });

  const ready =
    isNativeNotificationsSupported() &&
    Boolean(supabase) &&
    userQ.data?.role === "customer" &&
    Boolean(custQ.data?.onboarding_completed_at);

  useEffect(() => {
    const client = supabase;
    if (!ready || !client || !backgroundPromptsAllowed) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const interactionTask = runAfterUiSettled(() => {
      timer = setTimeout(() => {
        void (async () => {
          initBookingNotificationHandler();
          const Notifications = getExpoNotifications();
          if (!Notifications || !Device.isDevice) return;

          const projectId = resolveExpoProjectId();
          if (!projectId) {
            if (__DEV__) {
              console.warn(
                "[CustomerPushRegistration] Missing EAS project id. Set EXPO_PUBLIC_EAS_PROJECT_ID for remote push.",
              );
            }
            return;
          }

          const existing = await Notifications.getPermissionsAsync();
          let status = existing.status;
          if (status !== "granted") {
            const requested = await Notifications.requestPermissionsAsync();
            status = requested.status;
          }
          if (status !== "granted" || cancelled) return;

          const tokenResult = await Notifications.getExpoPushTokenAsync({ projectId });
          const token = tokenResult.data?.trim();
          if (!token || cancelled) return;
          if (registeredTokenRef.current === token) return;

          const platform = Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "unknown";
          await customerPushApi.upsertCustomerPushToken(client, {
            expo_push_token: token,
            platform,
          });
          if (!cancelled) registeredTokenRef.current = token;
        })().catch(() => {
          /* Permission denied or Expo token unavailable - local notifications still work. */
        });
      }, Platform.OS === "android" ? 600 : 0);
    });

    return () => {
      cancelled = true;
      interactionTask.cancel();
      if (timer) clearTimeout(timer);
    };
  }, [ready, backgroundPromptsAllowed]);

  return null;
}
