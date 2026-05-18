import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@oorjaman/api";
import { JOB_EVIDENCE_PHOTOS_BUCKET } from "@oorjaman/api";

export const JOB_PHOTOS_BUCKET = JOB_EVIDENCE_PHOTOS_BUCKET;

function randomSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Upload a captured library image into `job-photos/{bookingId}/{phase}-….jpg`.
 * Returns the public URL (bucket must be public or URL policy documented separately).
 */
export async function uploadJobPhotoFromUri(
  client: SupabaseClient<Database>,
  bookingId: string,
  phase: "before" | "after",
  uri: string,
): Promise<string> {
  const response = await fetch(uri);
  const buf = await response.arrayBuffer();
  const rawMime = response.headers.get("content-type") ?? "image/jpeg";
  const mime = rawMime.startsWith("image/") ? rawMime.split(";")[0]!.trim() : "image/jpeg";
  const ext =
    mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : mime.includes("jpeg") ? "jpg" : "jpg";
  const path = `${bookingId}/${phase}-${randomSuffix()}.${ext}`;
  const { error } = await client.storage.from(JOB_EVIDENCE_PHOTOS_BUCKET).upload(path, buf, {
    contentType: mime,
    upsert: false,
  });
  if (error) throw new Error(error.message);

  const { data } = client.storage.from(JOB_EVIDENCE_PHOTOS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
