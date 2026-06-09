import Link from "next/link";
import { MarketingPage } from "@/components/MarketingPage";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "About OorjaMan",
  description: "OorjaMan is India's solar rooftop care platform for cleaning, maintenance, and AMC.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <MarketingPage
      title="About OorjaMan"
      lead="We connect property owners with verified solar O&M partners - technology for scheduling, pricing, safety workflows, and settlements."
    >
      <p>
        Customers use our mobile app. Partners use the partner portal and OorjaMan Partner app. Platform operators run pricing
        and approvals from admin tools.
      </p>
      <p>
        <Link href="/contact">Contact us</Link> · <Link href="/partners">Partner programme</Link>
      </p>
    </MarketingPage>
  );
}
