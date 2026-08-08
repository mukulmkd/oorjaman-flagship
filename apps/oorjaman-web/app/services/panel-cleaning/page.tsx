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
      lead="One-time visits sized to your kW band — cleaning, inspection, and photo evidence so you know the job was done right."
    >
      <p>
        Dust, pollen, bird droppings, and urban grime cut rooftop yield. OorjaMan schedules a verified partner for a
        single cleaning visit matched to your system size, with transparent package pricing before you pay.
      </p>
      <h2 className="om-h3">What you get</h2>
      <ul>
        <li>Package pricing by typical system capacity (kW bands)</li>
        <li>City-tier surcharges where your service address maps to a geo tier</li>
        <li>Per-panel reference pricing for transparency</li>
        <li>Before/after photo evidence and visit status in the app</li>
        <li>Safety checklist and booking-code verification before work starts</li>
      </ul>
      <h2 className="om-h3">How booking works</h2>
      <ol>
        <li>Register your site (capacity, roof access, water availability).</li>
        <li>Pick a slot and confirm the price shown in the app.</li>
        <li>A partner accepts within the acceptance window and assigns a technician.</li>
        <li>Track the visit live and review completion evidence.</li>
      </ol>
      <p style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginTop: "1.5rem" }}>
        <Link href="/download" className="om-btn om-btn--primary">
          Get the app
        </Link>
        <Link href="/pricing" className="om-btn om-btn--outline">
          View pricing
        </Link>
        <Link href="/services/amc-maintenance" className="om-btn om-btn--outline">
          Compare AMC plans
        </Link>
      </p>
    </MarketingPage>
  );
}
