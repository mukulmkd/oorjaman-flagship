/** Normalize local image MIME/extension for Supabase Storage buckets (no HEIC in allowed_mime_types). */
export function normalizeImageUploadMime(
  rawMime: string,
  uri?: string,
): { mime: string; ext: string } {
  const base = rawMime.split(";")[0]!.trim().toLowerCase();
  const lowerUri = (uri ?? "").toLowerCase();
  const isHeic =
    base === "image/heic" ||
    base === "image/heif" ||
    lowerUri.endsWith(".heic") ||
    lowerUri.endsWith(".heif");

  if (isHeic) return { mime: "image/jpeg", ext: "jpg" };
  if (base === "image/png") return { mime: "image/png", ext: "png" };
  if (base === "image/webp") return { mime: "image/webp", ext: "webp" };
  if (base === "image/jpeg" || base === "image/jpg") return { mime: "image/jpeg", ext: "jpg" };
  return { mime: "image/jpeg", ext: "jpg" };
}
