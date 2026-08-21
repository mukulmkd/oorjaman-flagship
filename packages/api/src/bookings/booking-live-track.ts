import type { BookingRow, Json } from "../database.types";
import { customerLocationSignalsFromServiceSiteAddress } from "../vendors/vendor-service-area";

export type BookingLiveTrackPhase =
  | "no_technician"
  | "waiting_en_route"
  | "en_route"
  | "in_progress"
  | "inactive";

/** Customer app: map only while accepted + technician marked en route. */
export function isBookingGpsTrackable(
  booking: Pick<BookingRow, "technician_id" | "status" | "technician_en_route_at">,
): boolean {
  if (!booking.technician_id) return false;
  return booking.status === "accepted" && Boolean(booking.technician_en_route_at);
}

/**
 * Admin / vendor portals: show live track panel while visit is assigned and
 * either en route or actively in progress.
 */
export function bookingShowsPortalLiveTrack(
  booking: Pick<BookingRow, "technician_id" | "status" | "technician_en_route_at">,
): boolean {
  if (!booking.technician_id) return false;
  if (booking.status === "in_progress") return true;
  return booking.status === "accepted" && Boolean(booking.technician_en_route_at);
}

/** Whether the portal should render the live-status card at all (includes waiting for en route). */
export function bookingShowsPortalLiveStatusCard(
  booking: Pick<BookingRow, "technician_id" | "status">,
): boolean {
  if (!booking.technician_id) return false;
  return booking.status === "accepted" || booking.status === "in_progress";
}

export function bookingLiveTrackPhase(
  booking: Pick<BookingRow, "technician_id" | "status" | "technician_en_route_at">,
): BookingLiveTrackPhase {
  if (!booking.technician_id) return "no_technician";
  if (booking.status === "in_progress") return "in_progress";
  if (booking.status === "accepted") {
    return booking.technician_en_route_at ? "en_route" : "waiting_en_route";
  }
  return "inactive";
}

export function bookingLiveTrackPhaseLabel(phase: BookingLiveTrackPhase): string {
  switch (phase) {
    case "no_technician":
      return "No technician assigned";
    case "waiting_en_route":
      return "Waiting for technician to go en route";
    case "en_route":
      return "Technician en route";
    case "in_progress":
      return "Visit in progress";
    case "inactive":
      return "Live tracking unavailable";
  }
}

export type PortalTrackCoords = { lat: number; lng: number };

export function serviceSiteCoordsFromBookingAddress(
  serviceSiteAddress: Json | null | undefined,
): PortalTrackCoords | null {
  const signals = customerLocationSignalsFromServiceSiteAddress(serviceSiteAddress);
  if (signals.lat == null || signals.lng == null) return null;
  if (!Number.isFinite(signals.lat) || !Number.isFinite(signals.lng)) return null;
  return { lat: signals.lat, lng: signals.lng };
}

export function buildGoogleMapsDirectionsUrl(
  origin: PortalTrackCoords,
  destination: PortalTrackCoords,
): string {
  const params = new URLSearchParams({
    api: "1",
    origin: `${origin.lat},${origin.lng}`,
    destination: `${destination.lat},${destination.lng}`,
    travelmode: "driving",
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function buildGoogleMapsPinUrl(coords: PortalTrackCoords): string {
  return `https://www.google.com/maps?q=${coords.lat},${coords.lng}`;
}

/** Approximate great-circle distance in km. */
export function portalTrackDistanceKm(a: PortalTrackCoords, b: PortalTrackCoords): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * OpenStreetMap embed (iframe) — no API key.
 * Marker focuses on the technician when present; bbox covers tech + site when both fit.
 */
export function buildOsmEmbedTrackUrl(
  site: PortalTrackCoords | null,
  technician: PortalTrackCoords | null,
): string | null {
  const focus = technician ?? site;
  if (!focus) return null;

  const points = [site, technician].filter(Boolean) as PortalTrackCoords[];
  let minLat = Math.min(...points.map((p) => p.lat));
  let maxLat = Math.max(...points.map((p) => p.lat));
  let minLng = Math.min(...points.map((p) => p.lng));
  let maxLng = Math.max(...points.map((p) => p.lng));

  // If points are continents apart, zoom to technician only (site still in Google Maps link).
  if (site && technician && portalTrackDistanceKm(site, technician) > 80) {
    minLat = maxLat = technician.lat;
    minLng = maxLng = technician.lng;
  }

  const latPad = Math.max((maxLat - minLat) * 0.35, 0.02);
  const lngPad = Math.max((maxLng - minLng) * 0.35, 0.02);
  const bbox = [
    minLng - lngPad,
    minLat - latPad,
    maxLng + lngPad,
    maxLat + latPad,
  ]
    .map((n) => n.toFixed(6))
    .join("%2C");

  return (
    `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}` +
    `&layer=mapnik&marker=${focus.lat.toFixed(6)}%2C${focus.lng.toFixed(6)}`
  );
}
