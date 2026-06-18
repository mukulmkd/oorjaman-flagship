import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
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
 * Camera and gallery shots are often 8–12 MP; decoding them for the stamp overlay can OOM-kill the app
 * or produce blank view-shot output. Downscale on every platform before geocoding / stamping.
 */
export async function prepareSitePhotoUri(
  uri: string,
  _source: SitePhotoSource,
): Promise<PreparedSitePhoto> {
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
        "This photo is too large to process. Try again or pick a smaller image from your gallery.",
      );
    }
    return { uri: readable, width: 0, height: 0 };
  }
}
