import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CUSTOMER_SITE_PHOTOS_BUCKET,
  isTransientNetworkError,
  uploadCustomerSitePhotoBytes,
  type Database,
  type SitePhotoRecord,
} from "@oorjaman/api";
import type { SitePhotoCaptureGeo } from "@oorjaman/api";
import { prepareSitePhotoUri } from "./prepare-site-photo-uri";
import { readLocalImageBytes } from "./read-local-image-bytes";

const MIN_IMAGE_BYTES = 8_000;
const MAX_UPLOAD_BYTES = 6_000_000;

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function withNetworkRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e: unknown) {
    if (!isTransientNetworkError(e)) throw e;
    await sleep(900);
    return fn();
  }
}

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
  const prepared = await prepareSitePhotoUri(input.uri, input.source);
  const { bytes, contentType, sizeBytes } = await readLocalImageBytes(prepared.uri);
  if (sizeBytes < MIN_IMAGE_BYTES) {
    throw new Error("Photo file looks empty. Try taking the photo again.");
  }
  if (sizeBytes > MAX_UPLOAD_BYTES) {
    throw new Error("Photo is too large to upload. Try again closer to the site or use gallery.");
  }

  const record = await withNetworkRetry(() =>
    uploadCustomerSitePhotoBytes(client, {
      customerUserId: input.customerUserId,
      serviceAddressId: input.serviceAddressId,
      bytes,
      contentType,
      geo: input.geo,
      source: input.source,
    }),
  );

  try {
    await withNetworkRetry(async () => {
      const { data, error } = await client.storage
        .from(CUSTOMER_SITE_PHOTOS_BUCKET)
        .createSignedUrl(record.storage_path, 60);
      if (error || !data?.signedUrl) {
        const msg = error?.message ?? "Upload could not be verified.";
        if (/not found|does not exist/i.test(msg)) {
          throw new Error(
            "Photo storage is not set up on the server. Ask support to apply the customer-site-photos migration.",
          );
        }
        throw new Error(msg);
      }
    });
  } catch (e: unknown) {
    if (isTransientNetworkError(e)) {
      // Upload succeeded; flaky mobile data after returning from the camera should not roll back.
      return record;
    }
    await client.storage.from(CUSTOMER_SITE_PHOTOS_BUCKET).remove([record.storage_path]);
    throw e;
  }

  return record;
}
