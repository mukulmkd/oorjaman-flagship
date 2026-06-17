import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { Platform } from "react-native";
import { getInfoAsync } from "expo-file-system/legacy";
import type { SitePhotoSource } from "./site-photo-source-prompt";
import { ensureReadableImageFileUri } from "./read-local-image-bytes";

const STAMP_MAX_WIDTH = 1280;
/** Camera originals above this are too large to upload reliably on mobile data. */
const LARGE_FILE_BYTES = 2_000_000;

export type PreparedSitePhoto = {
  uri: string;
  width: number;
  height: number;
};

/**
 * Camera shots on Android are often 8–12 MP; decoding them for the stamp overlay can OOM-kill the app.
 * Downscale before geocoding / view-shot so camera and gallery follow the same safe path.
 */
export async function prepareSitePhotoUri(
  uri: string,
  source: SitePhotoSource,
): Promise<PreparedSitePhoto> {
  const shouldDownscale = source === "camera" || Platform.OS === "android";
  if (!shouldDownscale) {
    return { uri, width: 0, height: 0 };
  }

  try {
    const readable = await ensureReadableImageFileUri(uri);
    const result = await manipulateAsync(readable, [{ resize: { width: STAMP_MAX_WIDTH } }], {
      compress: 0.82,
      format: SaveFormat.JPEG,
    });
    return {
      uri: result.uri,
      width: result.width,
      height: result.height,
    };
  } catch {
    const readable = await ensureReadableImageFileUri(uri);
    const info = await getInfoAsync(readable);
    const size = "size" in info && typeof info.size === "number" ? info.size : 0;
    if (size > LARGE_FILE_BYTES) {
      throw new Error(
        "This photo is too large to upload from the camera. Try again or pick a smaller image from gallery.",
      );
    }
    return { uri: readable, width: 0, height: 0 };
  }
}
