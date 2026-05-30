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
      lead="Stay ahead of dust and debris with annual contracts - scheduled visits, visit allowances, and renewal nudges in the app."
    >
      <ul>
        <li>12- and 24-month contracts by system band</li>
        <li>Visit entitlements per plan code (shown at purchase)</li>
        <li>Stacked with geo-tier AMC surcharges where applicable</li>
      </ul>
      <p>
        <Link href="/download">Subscribe in the app</Link> · <Link href="/services/panel-cleaning">One-time visits</Link>
      </p>
    </MarketingPage>
  );
}
