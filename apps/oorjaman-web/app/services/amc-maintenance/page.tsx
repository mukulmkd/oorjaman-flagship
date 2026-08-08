import Link from "next/link";
import { MarketingPage } from "@/components/MarketingPage";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "Solar AMC maintenance plans",
  description: "Annual maintenance contracts for solar rooftops with scheduled visits per kW band.",
  path: "/services/amc-maintenance",
});

export default function AmcMaintenancePage() {
  return (
    <MarketingPage
      title="AMC maintenance"
      lead="Stay ahead of dust and debris with annual contracts — scheduled visits, visit allowances, and renewal nudges in the app."
    >
      <p>
        An AMC (annual maintenance contract) keeps cleaning on a calendar instead of waiting until output drops. Choose a
        plan sized to your rooftop capacity; the platform generates upcoming visits and tracks entitlements for you.
      </p>
      <h2 className="om-h3">Plan highlights</h2>
      <ul>
        <li>12- and 24-month contracts by system band</li>
        <li>Visit entitlements per plan code (shown at purchase)</li>
        <li>Stacked with geo-tier AMC surcharges where applicable</li>
        <li>Pause, resume, or cancel according to the terms shown in-app</li>
        <li>Same safety checklist and evidence capture as one-time visits</li>
      </ul>
      <p style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginTop: "1.5rem" }}>
        <Link href="/download" className="om-btn om-btn--primary">
          Get the app
        </Link>
        <Link href="/pricing" className="om-btn om-btn--outline">
          View pricing
        </Link>
        <Link href="/services/panel-cleaning" className="om-btn om-btn--outline">
          One-time visits
        </Link>
      </p>
    </MarketingPage>
  );
}
