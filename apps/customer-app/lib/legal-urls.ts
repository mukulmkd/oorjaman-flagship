import { publicLegalPath, publicLegalUrls } from "@oorjaman/config";

/** Hosted legal pages at https://oorjaman.com. Set EXPO_PUBLIC_SITE_URL in production. */
export const customerLegalUrls = {
  terms: publicLegalUrls.terms,
  privacy: publicLegalUrls.privacy,
  safety: () => publicLegalPath("/safety"),
  accountDeletion: publicLegalUrls.accountDeletion,
  refunds: publicLegalUrls.refunds,
};
