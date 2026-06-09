import Link from "next/link";
import { MarketingPage } from "@/components/MarketingPage";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "Become a partner",
  description: "Join OorjaMan as a solar O&M partner - bookings, technicians, and settlements on one platform.",
  path: "/partners",
});

const PARTNER_PORTAL_URL = process.env.NEXT_PUBLIC_VENDOR_PORTAL_URL ?? "http://localhost:5174";

export default function PartnersPage() {
  return (
    <MarketingPage
      title="Partner with OorjaMan"
      lead="Grow demand for your solar cleaning and maintenance business. Manage technicians, accept bookings, and view settlements in the partner portal."
    >
      <ul>
        <li>Marketplace and assigned bookings</li>
        <li>OorjaMan Partner app with safety workflows and evidence capture</li>
        <li>Finance dashboard for visit payouts and penalties</li>
      </ul>
      <p style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
        <a href={`${PARTNER_PORTAL_URL}/signup`} className="om-btn om-btn--primary" rel="noopener noreferrer">
          Apply as a partner
        </a>
        <Link href="/legal/vendor-partner-agreement" className="om-btn om-btn--outline">
          Partner agreement
        </Link>
      </p>
    </MarketingPage>
  );
}
