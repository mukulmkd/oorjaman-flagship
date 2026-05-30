import { Alert, Linking } from "react-native";

/** Web + native static map fallback (Maps Static API). */
export function getGoogleMapsApiKey(): string | null {
  const key = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
  return key ? key : null;
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
