import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";

/**
 * Job site evidence photos: Storage bucket name + phase labels for technician uploads.
 * Object paths: `{booking_id}/before-….ext` | `{booking_id}/after-….ext` (`supabase/storage.sql`).
 * Storage paths are persisted on `job_reports.before_photo_urls` / `after_photo_urls`
 * (JSON string arrays) and the start selfie path on `job_reports.checklist.pre_start.start_selfie_url`.
 *
 * The bucket is PRIVATE (SECURITY_REVIEW H2): reads must use short-lived signed URLs
 * (see `createSignedJobEvidenceUrl`), never `getPublicUrl`.
 */
export const JOB_EVIDENCE_PHOTOS_BUCKET = "job-photos" as const;

export type JobEvidencePhotoPhase = "before" | "after";

/**
 * Bucket-relative object path for a stored evidence value. New writes store the path
 * directly (e.g. `{bookingId}/before-….jpg`); legacy rows stored a full public URL, so we
 * also strip a `…/job-photos/<path>` prefix and any query string for backward compatibility.
 */
export function jobEvidenceStoragePath(stored: string): string {
  const value = stored.trim();
  const marker = `/${JOB_EVIDENCE_PHOTOS_BUCKET}/`;
  const idx = value.indexOf(marker);
  const raw = idx >= 0 ? value.slice(idx + marker.length) : value;
  const withoutQuery = raw.split("?")[0] ?? raw;
  return withoutQuery.replace(/^\/+/, "");
}

/** Signed URL for one job-evidence object (accepts a storage path or a legacy public URL). */
export async function createSignedJobEvidenceUrl(
  client: SupabaseClient<Database>,
  stored: string,
  expiresInSec = 3600,
): Promise<string | null> {
  const path = jobEvidenceStoragePath(stored);
  if (!path) return null;
  const { data, error } = await client.storage
    .from(JOB_EVIDENCE_PHOTOS_BUCKET)
    .createSignedUrl(path, expiresInSec);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/** Map of stored value → signed URL for display (skips entries that fail to sign). */
export async function createSignedJobEvidenceUrlMap(
  client: SupabaseClient<Database>,
  stored: string[],
  expiresInSec = 3600,
): Promise<Record<string, string>> {
  const entries = await Promise.all(
    stored.map(async (value) => {
      const url = await createSignedJobEvidenceUrl(client, value, expiresInSec);
      return [value, url] as const;
    }),
  );
  const out: Record<string, string> = {};
  for (const [value, url] of entries) {
    if (url) out[value] = url;
  }
  return out;
}
