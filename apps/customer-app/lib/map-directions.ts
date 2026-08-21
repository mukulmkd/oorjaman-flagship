import { getGoogleMapsApiKey } from "./google-maps";
import type { LatLng } from "./map-geo";

/** Decode Google's encoded polyline (Directions overview_polyline). */
export function decodeGooglePolyline(encoded: string): Array<{ lat: number; lng: number }> {
  const points: Array<{ lat: number; lng: number }> = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return points;
}

function simplifyPath(
  points: Array<{ lat: number; lng: number }>,
  maxPoints: number,
): Array<{ lat: number; lng: number }> {
  if (points.length <= maxPoints) return points;
  const step = Math.ceil(points.length / maxPoints);
  const simplified: Array<{ lat: number; lng: number }> = [];
  for (let i = 0; i < points.length; i += step) {
    simplified.push(points[i]!);
  }
  const last = points[points.length - 1];
  if (last && simplified[simplified.length - 1] !== last) {
    simplified.push(last);
  }
  return simplified;
}

type DirectionsResponse = {
  routes?: Array<{
    overview_polyline?: { points?: string };
  }>;
  status?: string;
  error_message?: string;
};

/**
 * Key for Directions / Routes HTTP APIs.
 * Prefer a dedicated unrestricted (or IP-restricted server) key — Maps SDK
 * application-restricted keys cannot call Directions from the device.
 */
export function getGoogleDirectionsApiKey(): string | null {
  const dedicated = process.env.EXPO_PUBLIC_GOOGLE_MAPS_DIRECTIONS_API_KEY?.trim();
  if (dedicated) return dedicated;
  return getGoogleMapsApiKey();
}

async function fetchGoogleDrivingRoute(
  origin: LatLng,
  destination: LatLng,
): Promise<Array<{ lat: number; lng: number }> | null> {
  const key = getGoogleDirectionsApiKey();
  if (!key) return null;

  const params = new URLSearchParams({
    origin: `${origin.latitude},${origin.longitude}`,
    destination: `${destination.latitude},${destination.longitude}`,
    mode: "driving",
    key,
  });

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/directions/json?${params.toString()}`,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as DirectionsResponse;
    if (data.status !== "OK") {
      if (__DEV__) {
        console.warn(
          "[map-directions] Google Directions:",
          data.status,
          data.error_message ?? "",
        );
      }
      return null;
    }
    const encoded = data.routes?.[0]?.overview_polyline?.points;
    if (!encoded) return null;
    return simplifyPath(decodeGooglePolyline(encoded), 72);
  } catch (err) {
    if (__DEV__) {
      console.warn("[map-directions] Google Directions request failed", err);
    }
    return null;
  }
}

type OsrmResponse = {
  code?: string;
  routes?: Array<{
    geometry?: {
      coordinates?: Array<[number, number]>;
    };
  }>;
};

/**
 * Public OSRM demo server — road-following fallback when Google Directions
 * is unavailable (common with Maps SDK–restricted API keys).
 */
async function fetchOsrmDrivingRoute(
  origin: LatLng,
  destination: LatLng,
): Promise<Array<{ lat: number; lng: number }> | null> {
  const path = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
  const url =
    `https://router.project-osrm.org/route/v1/driving/${path}` +
    "?overview=simplified&geometries=geojson";

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as OsrmResponse;
    if (data.code !== "Ok") return null;
    const coords = data.routes?.[0]?.geometry?.coordinates;
    if (!coords || coords.length < 2) return null;
    const points = coords.map(([lng, lat]) => ({ lat, lng }));
    return simplifyPath(points, 72);
  } catch (err) {
    if (__DEV__) {
      console.warn("[map-directions] OSRM request failed", err);
    }
    return null;
  }
}

/**
 * Driving route between two points.
 * Tries Google Directions, then OSRM. Returns null only if both fail
 * (caller should fall back to a straight segment).
 */
export async function fetchDrivingRoutePath(
  origin: LatLng,
  destination: LatLng,
): Promise<Array<{ lat: number; lng: number }> | null> {
  const google = await fetchGoogleDrivingRoute(origin, destination);
  if (google && google.length >= 2) return google;

  const osrm = await fetchOsrmDrivingRoute(origin, destination);
  if (osrm && osrm.length >= 2) return osrm;

  return null;
}

export function straightLinePath(
  origin: LatLng,
  destination: LatLng,
): Array<{ lat: number; lng: number }> {
  return [
    { lat: origin.latitude, lng: origin.longitude },
    { lat: destination.latitude, lng: destination.longitude },
  ];
}
