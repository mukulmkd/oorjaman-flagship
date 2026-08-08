import Link from "next/link";
import { MarketingPage } from "@/components/MarketingPage";
import { buildPageMetadata } from "@/lib/seo";
import { SUPPORT_EMAIL, vendorPortalPublicUrl } from "@/lib/site";

export const metadata = buildPageMetadata({
  title: "Become a partner",
  description: "Join OorjaMan as a solar O&M partner - bookings, technicians, and settlements on one platform.",
  path: "/partners",
});

export default function PartnersPage() {
  const portal = vendorPortalPublicUrl();

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
        {portal ? (
          <a href={`${portal}/signup`} className="om-btn om-btn--primary" rel="noopener noreferrer">
            Apply as a partner
          </a>
        ) : (
          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Partner application — OorjaMan")}`}
            className="om-btn om-btn--primary"
          >
            Email to apply
          </a>
        )}
        <Link href="/legal/vendor-partner-agreement" className="om-btn om-btn--outline">
          Partner agreement
        </Link>
      </p>
      {!portal ? (
        <p style={{ color: "var(--om-muted)", fontSize: "0.9375rem" }}>
          Partner portal signup will open here once the production portal URL is configured. Until then, email{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> with your city, team size, and GSTIN.
        </p>
      ) : null}
    </MarketingPage>
  );
}
