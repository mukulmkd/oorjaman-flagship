import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import { useQuery } from "@tanstack/react-query";
import { queryKeys, technicianApi, technicianPushApi, userApi } from "@oorjaman/api";
import {
  getExpoNotifications,
  initBookingNotificationHandler,
  isNativeNotificationsSupported,
} from "@oorjaman/ui";
import { supabase } from "../lib/supabase";

function resolveExpoProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  const fromExtra = extra?.eas?.projectId?.trim();
  if (fromExtra) return fromExtra;
  const fromEas = (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId?.trim();
  return fromEas || undefined;
}

export function TechnicianPushRegistration() {
  const registeredTokenRef = useRef<string | null>(null);

  const userQ = useQuery({
    queryKey: queryKeys.users.me(),
    queryFn: () => userApi.getMyUserRecord(supabase!),
    enabled: Boolean(supabase),
  });

  const techQ = useQuery({
    queryKey: queryKeys.technicians.me(),
    queryFn: () => technicianApi.getMyTechnicianProfile(supabase!),
    enabled: Boolean(supabase),
  });

  const ready =
    isNativeNotificationsSupported() &&
    Boolean(supabase) &&
    userQ.data?.role === "technician" &&
    technicianApi.technicianIsFullyOnboarded(techQ.data);

  useEffect(() => {
    if (!ready || !supabase) return;
    let cancelled = false;

    void (async () => {
      initBookingNotificationHandler();
      const Notifications = getExpoNotifications();
      if (!Notifications || !Device.isDevice) return;

      const projectId = resolveExpoProjectId();
      if (!projectId) {
        if (__DEV__) {
          console.warn(
            "[TechnicianPushRegistration] Missing EAS project id. Set EXPO_PUBLIC_EAS_PROJECT_ID for remote push.",
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
      await technicianPushApi.upsertTechnicianPushToken(supabase, {
        expo_push_token: token,
        platform,
      });
      if (!cancelled) registeredTokenRef.current = token;
    })().catch(() => {
      /* Permission denied or Expo token unavailable - local notifications still work. */
    });

    return () => {
      cancelled = true;
    };
  }, [ready]);

  return null;
}
