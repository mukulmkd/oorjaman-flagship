import { Alert, Linking, Platform } from "react-native";

/** Native MapView + Maps Static API — platform key when set, else legacy single key. */
export function getGoogleMapsApiKey(): string | null {
  const legacy = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
  const ios = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS?.trim();
  const android = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID?.trim();
  if (Platform.OS === "ios") return ios || legacy || null;
  if (Platform.OS === "android") return android || legacy || null;
  return legacy || ios || android || null;
}

export function normalizeLatLng(
  lat: number | string | null | undefined,
  lng: number | string | null | undefined,
): { lat: number; lng: number } | null {
  const la = typeof lat === "number" ? lat : Number(String(lat ?? "").trim());
  const ln = typeof lng === "number" ? lng : Number(String(lng ?? "").trim());
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null;
  if (la < -90 || la > 90 || ln < -180 || ln > 180) return null;
  return { lat: la, lng: ln };
}

/** Universal Google Maps link - works in Safari and the Maps app on iOS and Android. */
export function buildGoogleMapsBrowserUrl(lat: number, lng: number): string {
  const coords = normalizeLatLng(lat, lng);
  if (!coords) throw new Error("Invalid coordinates.");
  const { lat: la, lng: ln } = coords;
  return `https://www.google.com/maps?q=${la},${ln}`;
}

export async function openGoogleMapsInBrowser(
  lat: number | string,
  lng: number | string,
): Promise<void> {
  const coords = normalizeLatLng(lat, lng);
  if (!coords) {
    Alert.alert("Maps", "These GPS coordinates are not valid.");
    return;
  }
  const urls = [
    buildGoogleMapsBrowserUrl(coords.lat, coords.lng),
    `https://maps.google.com/maps?q=${coords.lat},${coords.lng}`,
  ];
  for (const url of urls) {
    try {
      await Linking.openURL(url);
      return;
    } catch {
      // try alternate host
    }
  }
  Alert.alert("Maps", "Could not open Google Maps. Try again.");
}

export type StaticMapMarker = {
  lat: number;
  lng: number;
  /** Static Maps color token, e.g. `green`, `blue`, or `0x1f8660`. */
  color: string;
};

function staticMapZoomForSpan(span: number): number {
  if (span > 0.5) return 10;
  if (span > 0.2) return 11;
  if (span > 0.08) return 12;
  if (span > 0.03) return 13;
  if (span > 0.012) return 14;
  if (span > 0.005) return 15;
  return 16;
}

export type StaticMapPath = {
  points: Array<{ lat: number; lng: number }>;
  /** Static Maps color, e.g. `0x1f8660ff` (ARGB). */
  color?: string;
  weight?: number;
};

/** Preview map with one or more markers (live tracking fallback / Android primary map). */
export function buildGoogleStaticMapTrackUrl(
  markers: StaticMapMarker[],
  width: number,
  height: number,
  options?: { path?: StaticMapPath | null },
): string | null {
  const key = getGoogleMapsApiKey();
  if (!key || markers.length === 0) return null;

  const w = Math.min(640, Math.max(200, Math.round(width)));
  const h = Math.min(640, Math.max(120, Math.round(height)));
  const lats = markers.map((m) => m.lat);
  const lngs = markers.map((m) => m.lng);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const midLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
  const span = Math.max(
    Math.max(...lats) - Math.min(...lats),
    Math.max(...lngs) - Math.min(...lngs),
  );
  const markerQuery = markers
    .map((m) => `markers=color:${m.color}|${m.lat},${m.lng}`)
    .join("&");

  const params = new URLSearchParams({
    size: `${w}x${h}`,
    scale: "2",
    maptype: "roadmap",
    key,
  });

  // Auto-fit both pins when tracking — avoids overly zoomed-out collapsed previews.
  if (markers.length >= 2) {
    params.set("visible", markers.map((m) => `${m.lat},${m.lng}`).join("|"));
  } else {
    params.set("center", `${midLat},${midLng}`);
    params.set("zoom", String(staticMapZoomForSpan(span)));
  }

  let url = `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}&${markerQuery}`;
  const path = options?.path;
  if (path && path.points.length >= 2) {
    const color = path.color ?? "0x1f8660ff";
    const weight = path.weight ?? 4;
    const coords = path.points.map((p) => `${p.lat},${p.lng}`).join("|");
    url += `&path=color:${color}|weight:${weight}|${coords}`;
  }
  return url;
}

export function buildGoogleStaticMapImageUrl(
  lat: number,
  lng: number,
  size: number,
): string | null {
  const key = getGoogleMapsApiKey();
  if (!key) return null;
  const s = Math.min(640, Math.max(120, Math.round(size)));
  const params = new URLSearchParams({
    center: `${lat},${lng}`,
    zoom: "16",
    size: `${s}x${s}`,
    scale: "2",
    maptype: "roadmap",
    markers: `color:red|${lat},${lng}`,
    key,
  });
  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
}

/** No API key — used when Google Static Maps is not configured (local dev / missing env). */
export function buildOpenStreetMapStaticUrl(lat: number, lng: number, size: number): string {
  const s = Math.min(640, Math.max(120, Math.round(size)));
  const q = new URLSearchParams({
    center: `${lat},${lng}`,
    zoom: "16",
    size: `${s}x${s}`,
    maptype: "mapnik",
  });
  return `https://staticmap.openstreetmap.de/staticmap.php?${q.toString()}&markers=${lat},${lng},red`;
}

/** Single OSM raster tile centered on the coordinates (last-resort when static map HTTP fails). */
export function buildOpenStreetMapTileUrl(lat: number, lng: number, zoom = 16): string {
  const n = 2 ** zoom;
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n,
  );
  return `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`;
}
