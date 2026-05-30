import Link from "next/link";
import { MarketingPage } from "@/components/MarketingPage";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "For businesses",
  description: "Commercial solar rooftop cleaning and AMC for factories, warehouses, and offices.",
  path: "/for-businesses",
});

export default function ForBusinessesPage() {
  return (
    <MarketingPage
      title="For businesses"
      lead="Commercial rooftops need reliable uptime. OorjaMan packages visits for larger arrays with the same transparent pricing model."
    >
      <p>Capture installation category and access constraints during registration so technicians arrive prepared.</p>
      <Link href="/contact">Talk to support about multi-site accounts</Link>
    </MarketingPage>
  );
}
