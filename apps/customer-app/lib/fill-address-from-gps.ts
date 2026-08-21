import * as Location from "expo-location";
import { Alert } from "react-native";
import { ensureForegroundLocationAccess } from "./location-access";

export type GpsAddressFill = {
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
  lat: number;
  lng: number;
  accuracyM: number | null;
};

/** Map device reverse-geocode rows directly into the address form (no profile/book defaults). */
export function mapReverseGeocodeToAddressFill(
  g: Location.LocationGeocodedAddress,
  lat: number,
  lng: number,
  accuracyM: number | null,
): GpsAddressFill {
  const street = [g.streetNumber, g.street].filter(Boolean).join(" ").trim();
  const name = typeof g.name === "string" ? g.name.trim() : "";
  const city = (g.city || g.subregion || g.district || "").trim();
  const state = (g.region || "").trim();
  const rawPin = (g.postalCode || "").replace(/\D/g, "");
  const pincode = rawPin.slice(0, 6);

  // Line 1: street address, else place name, else coords (never another field reused as line 1).
  const line1 =
    street ||
    name ||
    `Near ${lat.toFixed(5)}, ${lng.toFixed(5)}`;

  // Line 2: secondary locality from geocoder (area / district) when distinct from city & line 1.
  const secondaryParts = [g.district, g.subregion, name && name !== line1 ? name : ""]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)
    .filter((part, index, arr) => arr.indexOf(part) === index && part !== city && part !== line1);
  const line2 = secondaryParts.join(", ");

  return {
    line1,
    line2,
    city,
    state,
    pincode,
    lat,
    lng,
    accuracyM,
  };
}

/**
 * Requests foreground location, reverse-geocodes, and returns fields for the address form.
 * Caller should show alerts on null (permission / errors).
 */
export async function fillAddressFromCurrentLocation(options?: {
  /** When true, skip Alert dialogs (auto-fill on form open). */
  quiet?: boolean;
}): Promise<GpsAddressFill | null> {
  const quiet = options?.quiet === true;
  const access = await ensureForegroundLocationAccess({
    settingsTitle: "Location required",
    settingsMessage:
      "Allow location access when prompted so we can fill your service address from GPS, or enable it for OorjaMan in Settings.",
  });
  if (!access.ok) {
    return null;
  }

  const enabled = await Location.hasServicesEnabledAsync();
  if (!enabled) {
    if (!quiet) {
      Alert.alert("Location required", "Turn on location services on your device, then try again.");
    }
    return null;
  }

  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  const lat = pos.coords.latitude;
  const lng = pos.coords.longitude;
  const accuracyM = pos.coords.accuracy ?? null;

  const geos = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
  const g = geos[0];
  if (!g) {
    return {
      line1: `Near ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      line2: "",
      city: "",
      state: "",
      pincode: "",
      lat,
      lng,
      accuracyM,
    };
  }

  return mapReverseGeocodeToAddressFill(g, lat, lng, accuracyM);
}
