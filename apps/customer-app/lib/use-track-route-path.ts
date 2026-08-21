import { useEffect, useRef, useState } from "react";
import { fetchDrivingRoutePath, straightLinePath } from "./map-directions";
import type { LatLng } from "./map-geo";

type RoutePathState = {
  points: Array<{ lat: number; lng: number }>;
  isRoadRoute: boolean;
};

/** ~110 m — avoids re-fetching Directions on every GPS jitter. */
function quantizeCoord(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * Resolves a road-following path (Google Directions, then OSRM);
 * falls back to a straight segment only when both fail.
 */
export function useTrackRoutePath(
  origin: LatLng | null,
  destination: LatLng | null,
  enabled: boolean,
): RoutePathState {
  const [state, setState] = useState<RoutePathState>({ points: [], isRoadRoute: false });
  const originRef = useRef(origin);
  const destinationRef = useRef(destination);
  originRef.current = origin;
  destinationRef.current = destination;

  const originLatQ = origin ? quantizeCoord(origin.latitude) : null;
  const originLngQ = origin ? quantizeCoord(origin.longitude) : null;
  const destLatQ = destination ? quantizeCoord(destination.latitude) : null;
  const destLngQ = destination ? quantizeCoord(destination.longitude) : null;

  useEffect(() => {
    const from = originRef.current;
    const to = destinationRef.current;
    if (
      !enabled ||
      originLatQ == null ||
      originLngQ == null ||
      destLatQ == null ||
      destLngQ == null ||
      !from ||
      !to
    ) {
      setState({ points: [], isRoadRoute: false });
      return;
    }

    let cancelled = false;
    void (async () => {
      const road = await fetchDrivingRoutePath(from, to);
      if (cancelled) return;
      if (road && road.length >= 2) {
        setState({ points: road, isRoadRoute: true });
        return;
      }
      setState({
        points: straightLinePath(from, to),
        isRoadRoute: false,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, originLatQ, originLngQ, destLatQ, destLngQ]);

  return state;
}
