import { useEffect, useState } from "react";
import { fetchDrivingRoutePath, straightLinePath } from "./map-directions";
import type { LatLng } from "./map-geo";

type RoutePathState = {
  points: Array<{ lat: number; lng: number }>;
  isRoadRoute: boolean;
};

/**
 * Resolves a road-following path when Directions API is available;
 * falls back to a straight segment between origin and destination.
 */
export function useTrackRoutePath(
  origin: LatLng | null,
  destination: LatLng | null,
  enabled: boolean,
): RoutePathState {
  const [state, setState] = useState<RoutePathState>({ points: [], isRoadRoute: false });

  useEffect(() => {
    if (!enabled || !origin || !destination) {
      setState({ points: [], isRoadRoute: false });
      return;
    }

    let cancelled = false;
    void (async () => {
      const road = await fetchDrivingRoutePath(origin, destination);
      if (cancelled) return;
      if (road && road.length >= 2) {
        setState({ points: road, isRoadRoute: true });
        return;
      }
      setState({
        points: straightLinePath(origin, destination),
        isRoadRoute: false,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [
    enabled,
    destination?.latitude,
    destination?.longitude,
    origin?.latitude,
    origin?.longitude,
  ]);

  return state;
}
