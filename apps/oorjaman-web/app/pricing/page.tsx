import Link from "next/link";
import { MarketingPage } from "@/components/MarketingPage";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "Pricing",
  description: "How OorjaMan pricing works - kW bands, AMC plans, and city-tier surcharges.",
  path: "/pricing",
});

export default function PricingPage() {
  return (
    <MarketingPage
      title="Pricing"
      lead="Exact amounts are shown in the app at booking time. Below is how the catalogue is structured."
    >
      <ul>
        <li>
          <strong>Capacity bands</strong> - Discrete kW packages (no arbitrary sizes); each band has a one-time visit
          price and AMC options.
        </li>
        <li>
          <strong>Geo tiers</strong> - Visit and AMC add-ons when your city maps to a tier (configured by platform
          ops).
        </li>
        <li>
          <strong>Cancellation</strong> - Grace window plus late-cancellation fee published before you confirm cancel.
        </li>
      </ul>
      <p>
        <Link href="/download">See live prices in the app</Link> ·{" "}
        <Link href="/legal/refund-cancellation">Refund &amp; cancellation policy</Link>
      </p>
    </MarketingPage>
  );
}
