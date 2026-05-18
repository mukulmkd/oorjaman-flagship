import { File, Paths } from "expo-file-system";
import { buildGoogleStaticMapImageUrl } from "./google-maps";

/** Try downloading a remote static map into cache when native snapshot is unavailable. */
export async function downloadStaticMapFallback(
  lat: number,
  lng: number,
  size: number,
): Promise<string | null> {
  const googleUrl = buildGoogleStaticMapImageUrl(lat, lng, size);
  const urls = [
    ...(googleUrl ? [googleUrl] : []),
  ];
  const cacheDir = Paths.cache.uri.endsWith("/") ? Paths.cache.uri : `${Paths.cache.uri}/`;
  for (let i = 0; i < urls.length; i++) {
    try {
      const dest = `${cacheDir}site-map-${Date.now()}-${i}.jpg`;
      const result = await File.downloadFileAsync(urls[i]!, new File(dest));
      if (result.exists && (result.size ?? 0) > 500) {
        return result.uri;
      }
    } catch {
      // try next mirror
    }
  }
  return null;
}
