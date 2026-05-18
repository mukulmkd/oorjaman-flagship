import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";
import { requireSessionUserId, SupabaseApiError } from "../result";

export const VENDOR_DOCS_BUCKET = "vendor-documents" as const;

/** Pre-approval partner uploads (path `{intake_id}/{draft_access_token}/…` - required for storage RLS). */
export const VENDOR_INTAKE_BUCKET = "vendor-intake" as const;

export type VendorDocKind = "pan" | "aadhaar" | "gst" | "bank_proof" | "logo";

function sanitizeFilename(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 96);
}

/**
 * Upload a registration document to the private `vendor-documents` bucket.
 * Object path is `{user_id}/{kind}_{timestamp}_{filename}` - store returned path in vendors.doc_*_url.
 */
export async function uploadVendorDocument(
  client: SupabaseClient<Database>,
  bytes: ArrayBuffer | Uint8Array,
  docKind: VendorDocKind,
  originalFilename: string,
  contentType?: string,
): Promise<string> {
  const { data: userData, error: userErr } = await client.auth.getUser();
  if (userErr) throw new SupabaseApiError(userErr.message, userErr);
  const uid = requireSessionUserId(userData.user?.id);

  const safe = sanitizeFilename(originalFilename || "document");
  const path = `${uid}/${docKind}_${Date.now()}_${safe}`;
  const body = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);

  const { error } = await client.storage.from(VENDOR_DOCS_BUCKET).upload(path, body, {
    contentType: contentType ?? "application/octet-stream",
    upsert: true,
  });
  if (error) throw new SupabaseApiError(error.message, error);
  return path;
}

/**
 * Upload a registration document for an in-progress intake (no auth).
 * Object path `{intake_id}/{draft_access_token}/{kind}_{timestamp}_{filename}` - store full path in `form_data` doc_*.
 */
export async function uploadVendorIntakeDocument(
  client: SupabaseClient<Database>,
  intakeId: string,
  draftAccessToken: string,
  bytes: ArrayBuffer | Uint8Array,
  docKind: VendorDocKind,
  originalFilename: string,
  contentType?: string,
): Promise<string> {
  const safe = sanitizeFilename(originalFilename || "document");
  const path = `${intakeId}/${draftAccessToken}/${docKind}_${Date.now()}_${safe}`;
  const body = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);

  const { error } = await client.storage.from(VENDOR_INTAKE_BUCKET).upload(path, body, {
    contentType: contentType ?? "application/octet-stream",
    upsert: true,
  });
  if (error) throw new SupabaseApiError(error.message, error);
  return path;
}

/** Signed URL for admin to review an intake document (RLS: admin only on vendor-intake). */
export async function createVendorIntakeDocumentSignedUrl(
  client: SupabaseClient<Database>,
  storagePath: string,
  expiresInSec = 3600,
): Promise<string> {
  const { data, error } = await client.storage
    .from(VENDOR_INTAKE_BUCKET)
    .createSignedUrl(storagePath, expiresInSec);
  if (error) throw new SupabaseApiError(error.message, error);
  if (!data?.signedUrl) throw new SupabaseApiError("No signed URL returned");
  return data.signedUrl;
}

/** Signed URL for admin or vendor to open a private document (RLS must allow read). */
export async function createVendorDocumentSignedUrl(
  client: SupabaseClient<Database>,
  storagePath: string,
  expiresInSec = 3600,
): Promise<string> {
  const { data, error } = await client.storage
    .from(VENDOR_DOCS_BUCKET)
    .createSignedUrl(storagePath, expiresInSec);
  if (error) throw new SupabaseApiError(error.message, error);
  if (!data?.signedUrl) throw new SupabaseApiError("No signed URL returned");
  return data.signedUrl;
}
