export type LatLng = {
  latitude: number;
  longitude: number;
};

/** Great-circle distance in kilometres. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function formatDistanceKm(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m away`;
  return `${km < 10 ? km.toFixed(1) : Math.round(km).toString()} km away`;
}

/** Rough road ETA from straight-line distance (no Directions API). */
export function estimateArrivalMinutes(distanceKm: number, avgSpeedKmh = 22): number {
  if (distanceKm <= 0.05) return 0;
  const hours = distanceKm / avgSpeedKmh;
  return Math.max(1, Math.round(hours * 60));
}

export function formatEtaHeadline(
  distanceKm: number | null,
  hasTechnicianFix: boolean,
): { headline: string; subline: string } {
  if (!hasTechnicianFix) {
    return {
      headline: "Locating technician",
      subline: "Waiting for the first GPS update…",
    };
  }
  if (distanceKm == null) {
    return {
      headline: "On the way",
      subline: "Your technician is heading to your site",
    };
  }
  if (distanceKm < 0.3) {
    return {
      headline: "Arriving soon",
      subline: "Your technician is almost at your site",
    };
  }
  const minutes = estimateArrivalMinutes(distanceKm);
  if (minutes >= 60) {
    return {
      headline: "On the way",
      subline: "More than an hour away based on current distance",
    };
  }
  return {
    headline: minutes <= 1 ? "Arriving in 1 min" : `Arriving in ${minutes} min`,
    subline: formatDistanceKm(distanceKm),
  };
}

export type ArrivalTrend = "closer" | "farther" | "steady" | null;

export function compareArrivalTrend(
  previousKm: number | null,
  currentKm: number | null,
  minDeltaKm = 0.08,
): ArrivalTrend {
  if (previousKm == null || currentKm == null) return null;
  const delta = previousKm - currentKm;
  if (Math.abs(delta) < minDeltaKm) return "steady";
  return delta > 0 ? "closer" : "farther";
}
