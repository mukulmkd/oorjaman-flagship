import { useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus, Platform } from "react-native";
import * as Location from "expo-location";
import { useQuery } from "@tanstack/react-query";
import { queryKeys, technicianApi } from "@oorjaman/api";
import { supabase } from "../lib/supabase";

/** ~12s - middle of the 10-15s window; balanced accuracy limits GPS wake-ups. */
const LOCATION_TICK_MS = 12_000;

/**
 * Foreground-only GPS samples while the technician is en route (before on-site start).
 * Native: expo-location interval. Web (approved degrade): browser geolocation while tab visible.
 */
export function TechnicianLocationTracker() {
  const [appActive, setAppActive] = useState(() => AppState.currentState === "active");
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      appStateRef.current = next;
      setAppActive(next === "active");
    });
    return () => sub.remove();
  }, []);

  const activeJobQuery = useQuery({
    queryKey: queryKeys.bookings.technicianGpsTrackable(),
    queryFn: () => technicianApi.listMyGpsTrackableBookings(supabase!),
    enabled: Boolean(supabase) && appActive,
    refetchInterval: appActive ? 25_000 : false,
    staleTime: 15_000,
  });

  const hasActiveJob = (activeJobQuery.data?.length ?? 0) > 0;
  const shouldTrack = Boolean(supabase) && hasActiveJob;

  useEffect(() => {
    if (!supabase || !shouldTrack) return;
    const client = supabase;

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | undefined;

    const sampleNative = async () => {
      if (cancelled || appStateRef.current !== "active") return;
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (perm.status !== "granted") return;

        const servicesOn = await Location.hasServicesEnabledAsync();
        if (!servicesOn) return;

        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          mayShowUserSettingsDialog: false,
          timeInterval: LOCATION_TICK_MS,
        });
        if (cancelled) return;

        await technicianApi.recordTechnicianLocation(client, {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          recordedAt: new Date(pos.timestamp).toISOString(),
        });
      } catch {
        // Avoid tight loops on transient GPS/network errors
      }
    };

    const sampleWeb = async () => {
      if (cancelled || appStateRef.current !== "active") return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      if (typeof navigator === "undefined" || !navigator.geolocation) return;
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 15_000,
            maximumAge: LOCATION_TICK_MS,
          });
        });
        if (cancelled) return;
        await technicianApi.recordTechnicianLocation(client, {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          recordedAt: new Date(pos.timestamp).toISOString(),
        });
      } catch {
        // Denied / unavailable — En Route gate is the hard block; tracker stays best-effort.
      }
    };

    const sample = Platform.OS === "web" ? sampleWeb : sampleNative;

    void sample();
    intervalId = setInterval(sample, LOCATION_TICK_MS);

    return () => {
      cancelled = true;
      if (intervalId != null) clearInterval(intervalId);
    };
  }, [shouldTrack, supabase]);

  return null;
}
