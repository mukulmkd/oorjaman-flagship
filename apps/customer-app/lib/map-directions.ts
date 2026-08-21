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
};

/** Driving route between two points. Returns null if Directions API is unavailable. */
export async function fetchDrivingRoutePath(
  origin: LatLng,
  destination: LatLng,
): Promise<Array<{ lat: number; lng: number }> | null> {
  const key = getGoogleMapsApiKey();
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
    if (data.status !== "OK") return null;
    const encoded = data.routes?.[0]?.overview_polyline?.points;
    if (!encoded) return null;
    return simplifyPath(decodeGooglePolyline(encoded), 72);
  } catch {
    return null;
  }
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
