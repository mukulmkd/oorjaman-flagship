import Link from "next/link";
import { MarketingPage } from "@/components/MarketingPage";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "How it works",
  description: "Book solar panel cleaning or AMC in three steps with OorjaMan.",
  path: "/how-it-works",
});

export default function HowItWorksPage() {
  return (
    <MarketingPage
      title="How it works"
      lead="From site registration to a completed visit - structured, transparent, and trackable."
    >
      <ol style={{ paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <li>
          <strong>Register your site</strong> - Add rooftop details, photos, and service addresses in the app.
        </li>
        <li>
          <strong>Book a slot</strong> - Choose one-time cleaning or an AMC plan; see pricing before you confirm.
        </li>
        <li>
          <strong>Track the visit</strong> - Follow technician progress, safety checks, and completion evidence.
        </li>
      </ol>
      <p>
        <Link href="/download" className="om-btn om-btn--primary">
          Get the app
        </Link>
      </p>
    </MarketingPage>
  );
}
