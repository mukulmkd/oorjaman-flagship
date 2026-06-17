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
 * Pauses in background (battery + no background location mode in app config).
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
  const shouldSample = Boolean(supabase) && appActive && hasActiveJob;

  useEffect(() => {
    if (!supabase || Platform.OS === "web" || !shouldSample) return;
    const client = supabase;

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | undefined;

    const sample = async () => {
      if (cancelled || appStateRef.current !== "active") return;
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (perm.status !== "granted") return;

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

    void (async () => {
      const req = await Location.requestForegroundPermissionsAsync();
      if (cancelled || req.status !== "granted") return;

      await sample();
      intervalId = setInterval(sample, LOCATION_TICK_MS);
    })();

    return () => {
      cancelled = true;
      if (intervalId != null) clearInterval(intervalId);
    };
  }, [shouldSample, supabase]);

  return null;
}
