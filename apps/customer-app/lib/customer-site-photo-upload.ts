import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CUSTOMER_SITE_PHOTOS_BUCKET,
  uploadCustomerSitePhotoBytes,
  type Database,
  type SitePhotoRecord,
} from "@oorjaman/api";
import type { SitePhotoCaptureGeo } from "@oorjaman/api";
import { readLocalImageBytes } from "./read-local-image-bytes";

const MIN_IMAGE_BYTES = 8_000;

export async function uploadCustomerSitePhotoFromUri(
  client: SupabaseClient<Database>,
  input: {
    customerUserId: string;
    serviceAddressId: string;
    uri: string;
    geo: SitePhotoCaptureGeo;
    source: SitePhotoRecord["source"];
  },
): Promise<SitePhotoRecord> {
  const { bytes, contentType, sizeBytes } = await readLocalImageBytes(input.uri);
  if (sizeBytes < MIN_IMAGE_BYTES) {
    throw new Error("Photo file looks empty. Try taking the photo again.");
  }

  const record = await uploadCustomerSitePhotoBytes(client, {
    customerUserId: input.customerUserId,
    serviceAddressId: input.serviceAddressId,
    bytes,
    contentType,
    geo: input.geo,
    source: input.source,
  });

  const { data, error } = await client.storage
    .from(CUSTOMER_SITE_PHOTOS_BUCKET)
    .createSignedUrl(record.storage_path, 60);

  if (error || !data?.signedUrl) {
    await client.storage.from(CUSTOMER_SITE_PHOTOS_BUCKET).remove([record.storage_path]);
    const msg = error?.message ?? "Upload could not be verified.";
    if (/not found|does not exist/i.test(msg)) {
      throw new Error(
        "Photo storage is not set up on the server. Ask support to apply the customer-site-photos migration.",
      );
    }
    throw new Error(msg);
  }

  return record;
}
