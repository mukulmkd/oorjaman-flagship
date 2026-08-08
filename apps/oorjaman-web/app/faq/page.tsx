import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { MarketingPage } from "@/components/MarketingPage";
import { FAQ_ITEMS, faqPageJsonLd } from "@/lib/faq";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "FAQ",
  description: "Frequently asked questions about OorjaMan solar cleaning, AMC, pricing, and support.",
  path: "/faq",
});

export default function FaqPage() {
  return (
    <MarketingPage title="FAQ" lead="Clear answers about booking, pricing, AMC, safety, and support.">
      <JsonLd data={faqPageJsonLd()} />
      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        {FAQ_ITEMS.map((item) => (
          <div key={item.q} className="om-card">
            <h2 style={{ fontSize: "1.0625rem", margin: "0 0 0.5rem" }}>{item.q}</h2>
            <p style={{ margin: 0, color: "var(--om-muted)" }}>{item.a}</p>
          </div>
        ))}
      </div>
      <p style={{ marginTop: "1.5rem" }}>
        <Link href="/contact">Contact support</Link> · <Link href="/pricing">Pricing</Link> ·{" "}
        <Link href="/legal/account-deletion">Account deletion</Link> ·{" "}
        <Link href="/legal/refund-cancellation">Refunds &amp; cancellations</Link>
      </p>
    </MarketingPage>
  );
}
