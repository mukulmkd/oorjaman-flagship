import Link from "next/link";
import { MarketingPage } from "@/components/MarketingPage";
import { buildPageMetadata } from "@/lib/seo";
import { SUPPORT_EMAIL } from "@/lib/site";

export const metadata = buildPageMetadata({
  title: "For businesses",
  description: "Commercial solar rooftop cleaning and AMC for factories, warehouses, and offices.",
  path: "/for-businesses",
});

export default function ForBusinessesPage() {
  return (
    <MarketingPage
      title="For businesses"
      lead="Commercial rooftops need reliable uptime. OorjaMan packages visits for larger arrays with the same transparent pricing model."
    >
      <p>
        Factories, warehouses, offices, and campus installations can register sites with access constraints so
        technicians arrive prepared. Use one-time cleans for catch-up work or AMC plans for scheduled care.
      </p>
      <ul>
        <li>Capacity-based packages suitable for larger arrays</li>
        <li>Visit tracking and completion evidence for facilities teams</li>
        <li>Partner network trained for rooftop solar O&amp;M</li>
        <li>Multi-site enquiries via support for rollout planning</li>
      </ul>
      <p style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginTop: "1.5rem" }}>
        <Link href="/download" className="om-btn om-btn--primary">
          Get the app
        </Link>
        <a
          href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Business / multi-site enquiry")}`}
          className="om-btn om-btn--outline"
        >
          Email {SUPPORT_EMAIL}
        </a>
        <Link href="/pricing" className="om-btn om-btn--outline">
          Pricing
        </Link>
      </p>
    </MarketingPage>
  );
}
