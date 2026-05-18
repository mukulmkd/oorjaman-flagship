import * as Location from "expo-location";

export type SitePhotoGeocode = {
  line1: string;
  cityRegion: string;
  fullAddress: string;
};

export async function reverseGeocodeSitePhoto(lat: number, lng: number): Promise<SitePhotoGeocode> {
  const rows = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
  const g = rows[0];
  if (!g) {
    return {
      line1: "India",
      cityRegion: `Near ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      fullAddress: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
    };
  }

  const city = [g.city, g.subregion, g.district].filter(Boolean).join(", ");
  const state = g.region?.trim() ?? "";
  const country = g.country?.trim() ?? "India";
  const pin = (g.postalCode ?? "").trim();
  const street = [g.streetNumber, g.street, g.name].filter(Boolean).join(" ").trim();
  const line1 = country;
  const cityRegion = [city, state].filter(Boolean).join(", ") || country;
  const fullParts = [street, city, state, pin, country].filter((x) => x && x.length > 0);
  const fullAddress = fullParts.join(", ") || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

  return { line1, cityRegion, fullAddress };
}

export function formatSitePhotoStampTime(date = new Date()): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "shortOffset",
  }).format(date);
}
