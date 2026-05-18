import { File, Paths } from "expo-file-system";
import {
  copyAsync,
  getInfoAsync,
  readAsStringAsync,
} from "expo-file-system/legacy";

const MIN_BYTES = 1_000;

function base64ToUint8Array(base64: string): Uint8Array {
  const atobFn = (globalThis as { atob?: (s: string) => string }).atob;
  if (!atobFn) throw new Error("Cannot decode image on this device.");
  const binary = atobFn(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function guessContentType(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".heic") || lower.endsWith(".heif")) return "image/jpeg";
  return "image/jpeg";
}

/** Copy picker URIs (ph://, assets-library) into app cache as a readable file:// path. */
export async function ensureReadableImageFileUri(uri: string): Promise<string> {
  const trimmed = uri.trim();
  if (!trimmed) throw new Error("Empty image path.");

  if (trimmed.startsWith("file://")) {
    const info = await getInfoAsync(trimmed);
    if (info.exists) return trimmed;
  }

  const cacheDir = Paths.cache.uri.endsWith("/") ? Paths.cache.uri : `${Paths.cache.uri}/`;
  const ext = trimmed.toLowerCase().includes(".png") ? "png" : "jpg";
  const dest = `${cacheDir}site-photo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  await copyAsync({ from: trimmed, to: dest });
  const copied = await getInfoAsync(dest);
  if (!copied.exists) {
    throw new Error("Could not prepare image from gallery.");
  }
  return dest;
}

export async function readLocalImageBytes(
  uri: string,
): Promise<{ bytes: Uint8Array; contentType: string; sizeBytes: number; fileUri: string }> {
  const fileUri = await ensureReadableImageFileUri(uri);
  const contentType = guessContentType(fileUri);

  try {
    const file = new File(fileUri);
    if (file.exists) {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const sizeBytes = file.size ?? bytes.byteLength;
      if (sizeBytes >= MIN_BYTES) {
        return { bytes, contentType, sizeBytes, fileUri };
      }
    }
  } catch {
    // fall through to legacy reader
  }

  const info = await getInfoAsync(fileUri);
  if (!info.exists) {
    throw new Error("Image file not found on device.");
  }
  const sizeBytes = "size" in info && typeof info.size === "number" ? info.size : 0;
  const base64 = await readAsStringAsync(fileUri, { encoding: "base64" });
  const bytes = base64ToUint8Array(base64);
  const finalSize = sizeBytes || bytes.byteLength;
  if (finalSize < MIN_BYTES) {
    throw new Error("Photo file looks empty. Try again or pick a different image.");
  }
  return { bytes, contentType, sizeBytes: finalSize, fileUri };
}
