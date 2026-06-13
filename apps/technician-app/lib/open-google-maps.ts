import { Alert, Linking } from "react-native";

function normalizeLatLng(
  lat: number | string | null | undefined,
  lng: number | string | null | undefined,
): { lat: number; lng: number } | null {
  const la = typeof lat === "number" ? lat : Number(String(lat ?? "").trim());
  const ln = typeof lng === "number" ? lng : Number(String(lng ?? "").trim());
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null;
  if (la < -90 || la > 90 || ln < -180 || ln > 180) return null;
  return { lat: la, lng: ln };
}

/** Opens the customer site in Google Maps (browser or native Maps app). No API key required. */
export async function openGoogleMapsForCoordinates(
  lat: number | string,
  lng: number | string,
): Promise<void> {
  const coords = normalizeLatLng(lat, lng);
  if (!coords) {
    Alert.alert("Maps", "This site does not have valid GPS coordinates saved.");
    return;
  }
  const urls = [
    `https://www.google.com/maps?q=${coords.lat},${coords.lng}`,
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
