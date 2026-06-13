import Link from "next/link";
import { MarketingPage } from "@/components/MarketingPage";
import { buildPageMetadata } from "@/lib/seo";
import {
  formatInrWhole,
  OORJAMAN_AMC_PLANS_INR,
  OORJAMAN_GST_RATE_PERCENT,
  OORJAMAN_ONE_TIME_VISIT_PRICES_INR,
  splitGstFromInclusiveInr,
} from "@/lib/pricing-catalog";

export const metadata = buildPageMetadata({
  title: "Pricing",
  description: "OorjaMan solar cleaning and AMC prices by kW band. GST 18% included.",
  path: "/pricing",
});

export default function PricingPage() {
  const sampleGst = splitGstFromInclusiveInr(1599);

  return (
    <MarketingPage
      title="Pricing"
      lead={`Published catalogue prices for India. All amounts include ${OORJAMAN_GST_RATE_PERCENT}% GST. City-tier surcharges may apply in the app based on your service address.`}
    >
      <p>
        <strong>GST ({OORJAMAN_GST_RATE_PERCENT}%)</strong> is included in every price below. Example for a ₹1,599 AMC
        plan: service value {formatInrWhole(sampleGst.taxableValueInr)}, GST {formatInrWhole(sampleGst.gstInr)}, total{" "}
        {formatInrWhole(sampleGst.totalInr)}.
      </p>

      <h2>One-time panel cleaning</h2>
      <table>
        <thead>
          <tr>
            <th>Panel capacity</th>
            <th>Price (incl. GST)</th>
          </tr>
        </thead>
        <tbody>
          {OORJAMAN_ONE_TIME_VISIT_PRICES_INR.map((row) => (
            <tr key={row.kw}>
              <td>{row.kw} kW</td>
              <td>{formatInrWhole(row.priceInr)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Annual Maintenance Plan (AMP)</h2>
      <p>
        <strong>SP-1</strong> — 3 services in 1 year · <strong>SP-2</strong> — 6 services in 2 years. List price is per-visit
        rate × visits; special customer price is what you pay in the app.
      </p>
      <table>
        <thead>
          <tr>
            <th>Capacity</th>
            <th>Plan</th>
            <th>Visits</th>
            <th>List price</th>
            <th>Special price (incl. GST)</th>
          </tr>
        </thead>
        <tbody>
          {OORJAMAN_AMC_PLANS_INR.map((row) => (
            <tr key={`${row.kw}-${row.spLabel}`}>
              <td>{row.kw} kW</td>
              <td>{row.spLabel}</td>
              <td>{row.visitsLabel}</td>
              <td>{formatInrWhole(row.listPriceInr)}</td>
              <td>{formatInrWhole(row.specialPriceInr)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <ul>
        <li>
          <strong>Geo tiers</strong> — Optional visit and AMC add-ons when your city maps to a surcharge tier.
        </li>
        <li>
          <strong>Cancellation</strong> — Grace window plus late-cancellation fee shown before you confirm.
        </li>
      </ul>
      <p>
        <Link href="/download">See live checkout prices in the app</Link> ·{" "}
        <Link href="/legal/refund-cancellation">Refund &amp; cancellation policy</Link>
      </p>
    </MarketingPage>
  );
}
