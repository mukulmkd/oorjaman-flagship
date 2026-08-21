import { permanentRedirect } from "next/navigation";

/** Alias for society / RWA SEO queries — canonical is /for-businesses. */
export default function ForSocietiesAliasPage() {
  permanentRedirect("/for-businesses");
}
