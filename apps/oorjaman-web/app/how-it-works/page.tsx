import Link from "next/link";
import { MarketingPage } from "@/components/MarketingPage";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "How it works",
  description: "Book solar panel cleaning or AMC in clear steps with OorjaMan.",
  path: "/how-it-works",
});

export default function HowItWorksPage() {
  return (
    <MarketingPage
      title="How it works"
      lead="From site registration to a completed visit — structured, transparent, and trackable."
    >
      <ol style={{ paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <li>
          <strong>Register your site</strong> — Add rooftop details, photos, access notes, and water availability in
          the customer app.
        </li>
        <li>
          <strong>Book a slot</strong> — Choose one-time cleaning or an AMC plan; confirm package pricing (and any
          city-tier surcharge) before you pay.
        </li>
        <li>
          <strong>Partner accepts</strong> — A verified partner accepts within the acceptance window and assigns a
          technician. You receive a booking code for job start.
        </li>
        <li>
          <strong>Track the visit</strong> — Follow safety checks, job progress, and completion evidence in the app.
        </li>
      </ol>
      <p style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginTop: "1.5rem" }}>
        <Link href="/download" className="om-btn om-btn--primary">
          Get the app
        </Link>
        <Link href="/pricing" className="om-btn om-btn--outline">
          Pricing
        </Link>
        <Link href="/safety" className="om-btn om-btn--outline">
          Safety
        </Link>
      </p>
    </MarketingPage>
  );
}
