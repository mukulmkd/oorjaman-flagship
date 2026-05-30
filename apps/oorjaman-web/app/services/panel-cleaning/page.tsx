import Link from "next/link";
import { MarketingPage } from "@/components/MarketingPage";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "Solar panel cleaning",
  description: "Professional one-time solar panel cleaning visits by system size with verified OorjaMan partners.",
  path: "/services/panel-cleaning",
});

export default function PanelCleaningPage() {
  return (
    <MarketingPage
      title="Solar panel cleaning"
      lead="One-time visits sized to your kW band - cleaning, inspection, and photo evidence so you know the job was done right."
    >
      <ul>
        <li>Package pricing by typical system capacity (kW bands)</li>
        <li>City-tier surcharges where your service address maps to a geo tier</li>
        <li>Per-panel reference pricing for transparency</li>
      </ul>
      <p>
        <Link href="/download">Book in the app</Link> · <Link href="/services/amc-maintenance">Compare AMC plans</Link>
      </p>
    </MarketingPage>
  );
}
