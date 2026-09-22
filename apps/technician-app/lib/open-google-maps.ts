import { Alert, Linking, Platform } from "react-native";

export type MapCoords = { lat: number; lng: number };

function normalizeLatLng(
  lat: number | string | null | undefined,
  lng: number | string | null | undefined,
): MapCoords | null {
  const la = typeof lat === "number" ? lat : Number(String(lat ?? "").trim());
  const ln = typeof lng === "number" ? lng : Number(String(lng ?? "").trim());
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null;
  if (la < -90 || la > 90 || ln < -180 || ln > 180) return null;
  return { lat: la, lng: ln };
}

function oneLineAddress(value: string | null | undefined): string | null {
  const line = (value ?? "").replace(/\s+/g, " ").trim();
  if (!line || line === "-") return null;
  return line;
}

/** Google Maps directions (browser or native Maps app). No API key required. */
export function buildTechnicianDirectionsUrl(opts: {
  origin?: MapCoords | null;
  destination?: MapCoords | null;
  destinationQuery?: string | null;
}): string | null {
  const origin = opts.origin ?? null;
  const destination = opts.destination ?? null;
  const query = oneLineAddress(opts.destinationQuery ?? null);
  if (!destination && !query) return null;

  const params = new URLSearchParams({ api: "1", travelmode: "driving" });
  if (origin) params.set("origin", `${origin.lat},${origin.lng}`);
  if (destination) params.set("destination", `${destination.lat},${destination.lng}`);
  else if (query) params.set("destination", query);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export async function openUrl(url: string): Promise<boolean> {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    return opened != null;
  }
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

/** Opens the customer site as a pin. Prefer `openGoogleMapsDirections` for navigation. */
export async function openGoogleMapsForCoordinates(
  lat: number | string,
  lng: number | string,
): Promise<void> {
  const coords = normalizeLatLng(lat, lng);
  if (!coords) {
    Alert.alert("Maps", "This site does not have valid GPS coordinates saved.");
    return;
  }
  const opened = await openUrl(`https://www.google.com/maps?q=${coords.lat},${coords.lng}`);
  if (!opened) Alert.alert("Maps", "Could not open Google Maps. Try again.");
}

export async function openGoogleMapsDirections(opts: {
  origin?: MapCoords | null;
  destination?: MapCoords | null;
  destinationQuery?: string | null;
  silent?: boolean;
}): Promise<void> {
  const destination = opts.destination ?? null;
  const query = oneLineAddress(opts.destinationQuery ?? null);
  if (!destination && !query) {
    if (!opts.silent) {
      Alert.alert("Maps", "This site does not have a saved location to navigate to.");
    }
    return;
  }

  const urls: string[] = [];
  if (Platform.OS === "android" && destination) {
    // Turn-by-turn in the Google Maps app; uses the phone GPS as origin.
    urls.push(`google.navigation:q=${destination.lat},${destination.lng}`);
  }
  const https = buildTechnicianDirectionsUrl(opts);
  if (https) urls.push(https);

  for (const url of urls) {
    if (await openUrl(url)) return;
  }
  if (!opts.silent) Alert.alert("Maps", "Could not open Google Maps. Try again.");
}
