import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, JobEvidencePhotoPhase } from "@oorjaman/api";
import { technicianApi } from "@oorjaman/api";
import { uploadJobPhotoFromUri } from "./job-photos";

export type { JobEvidencePhotoPhase };

/**
 * Upload an image to Storage (`job-photos/{bookingId}/…`), then append its storage PATH to
 * `job_reports` (`before_photo_urls` or `after_photo_urls`). The bucket is private
 * (SECURITY_REVIEW H2) — display uses signed URLs, not the stored path directly.
 */
export async function uploadAndLinkJobReportPhoto(
  client: SupabaseClient<Database>,
  bookingId: string,
  phase: JobEvidencePhotoPhase,
  localImageUri: string,
  currentBeforeUrls: string[],
  currentAfterUrls: string[],
): Promise<{ beforePhotoUrls: string[]; afterPhotoUrls: string[] }> {
  const storagePath = await uploadJobPhotoFromUri(client, bookingId, phase, localImageUri);
  const beforePhotoUrls = phase === "before" ? [...currentBeforeUrls, storagePath] : currentBeforeUrls;
  const afterPhotoUrls = phase === "after" ? [...currentAfterUrls, storagePath] : currentAfterUrls;

  await technicianApi.technicianSaveJobPhotoUrls(client, bookingId, {
    beforePhotoUrls,
    afterPhotoUrls,
  });

  return { beforePhotoUrls, afterPhotoUrls };
}
