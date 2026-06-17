import { File, Paths } from "expo-file-system";
import { buildGoogleStaticMapImageUrl, buildOpenStreetMapStaticUrl, buildOpenStreetMapTileUrl } from "./google-maps";

async function downloadMapImage(url: string, dest: string): Promise<string | null> {
  try {
    const result = await File.downloadFileAsync(url, new File(dest));
    if (result.exists && (result.size ?? 0) > 500) {
      return result.uri;
    }
  } catch {
    // try next mirror
  }
  return null;
}

/** Download a small map image into cache (Google Static API, then OpenStreetMap). */
export async function downloadStaticMapFallback(
  lat: number,
  lng: number,
  size: number,
): Promise<string | null> {
  const googleUrl = buildGoogleStaticMapImageUrl(lat, lng, size);
  const urls = [
    ...(googleUrl ? [googleUrl] : []),
    buildOpenStreetMapStaticUrl(lat, lng, size),
    buildOpenStreetMapTileUrl(lat, lng, 16),
  ];
  const cacheDir = Paths.cache.uri.endsWith("/") ? Paths.cache.uri : `${Paths.cache.uri}/`;
  for (let i = 0; i < urls.length; i++) {
    const dest = `${cacheDir}site-map-${Date.now()}-${i}.jpg`;
    const uri = await downloadMapImage(urls[i]!, dest);
    if (uri) return uri;
  }
  return null;
}
