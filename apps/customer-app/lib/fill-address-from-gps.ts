import * as Location from "expo-location";

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

/**
 * Requests foreground location, reverse-geocodes, and returns fields for the address form.
 * Caller should show alerts on null (permission / errors).
 */
export async function fillAddressFromCurrentLocation(): Promise<GpsAddressFill | null> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") {
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

  const street = [g.streetNumber, g.street].filter(Boolean).join(" ").trim();
  const line1 =
    street ||
    (typeof g.name === "string" && g.name.trim()) ||
    [g.city, g.region].filter(Boolean).join(", ") ||
    `Near ${lat.toFixed(5)}, ${lng.toFixed(5)}`;

  const city = (g.city || g.subregion || g.district || "").trim();
  const state = (g.region || "").trim();
  const rawPin = (g.postalCode || "").replace(/\D/g, "");
  const pincode = rawPin.slice(0, 6);

  return {
    line1,
    line2: "",
    city,
    state,
    pincode,
    lat,
    lng,
    accuracyM,
  };
}
