import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";
import { requireSessionUserId, SupabaseApiError } from "../result";

export const TECHNICIAN_DOCS_BUCKET = "technician-documents" as const;

export type TechnicianDocKind = "aadhaar" | "pan" | "bank_proof" | "passport_photo" | "safety_certificate";

function sanitizeFilename(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 96);
}

export async function uploadTechnicianDocument(
  client: SupabaseClient<Database>,
  bytes: ArrayBuffer | Uint8Array,
  docKind: TechnicianDocKind,
  originalFilename: string,
  contentType?: string,
): Promise<string> {
  const { data: userData, error: userErr } = await client.auth.getUser();
  if (userErr) throw new SupabaseApiError(userErr.message, userErr);
  const uid = requireSessionUserId(userData.user?.id);

  const safe = sanitizeFilename(originalFilename || "document");
  const path = `${uid}/${docKind}_${Date.now()}_${safe}`;
  const body = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);

  const { error } = await client.storage.from(TECHNICIAN_DOCS_BUCKET).upload(path, body, {
    contentType: contentType ?? "application/octet-stream",
    upsert: true,
  });
  if (error) throw new SupabaseApiError(error.message, error);
  return path;
}

export async function createTechnicianDocumentSignedUrl(
  client: SupabaseClient<Database>,
  storagePath: string,
  expiresInSec = 3600,
): Promise<string> {
  const { data, error } = await client.storage
    .from(TECHNICIAN_DOCS_BUCKET)
    .createSignedUrl(storagePath, expiresInSec);
  if (error) throw new SupabaseApiError(error.message, error);
  if (!data?.signedUrl) throw new SupabaseApiError("No signed URL returned");
  return data.signedUrl;
}
