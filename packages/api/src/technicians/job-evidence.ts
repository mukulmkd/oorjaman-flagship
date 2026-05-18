/**
 * Job site evidence photos: Storage bucket name + phase labels for technician uploads.
 * Object paths: `{booking_id}/before-….ext` | `{booking_id}/after-….ext` (`supabase/storage.sql`).
 * URLs are persisted on `job_reports.before_photo_urls` / `after_photo_urls` (JSON string arrays).
 */
export const JOB_EVIDENCE_PHOTOS_BUCKET = "job-photos" as const;

export type JobEvidencePhotoPhase = "before" | "after";
