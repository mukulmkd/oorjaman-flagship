import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { MarketingPage } from "@/components/MarketingPage";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "FAQ",
  description: "Frequently asked questions about OorjaMan solar cleaning, AMC, pricing, and support.",
  path: "/faq",
});

const FAQ = [
  {
    q: "Do I need the app to book?",
    a: "Yes - booking, payments, and visit tracking are available in the OorjaMan customer app for iOS and Android.",
  },
  {
    q: "What is included in an AMC plan?",
    a: "Scheduled visits per contract term, shown when you purchase. Visit counts depend on your system band and plan code.",
  },
  {
    q: "Can I cancel a booking?",
    a: "Yes. A grace window applies after booking; late cancellations may incur a fee shown before you confirm.",
  },
  {
    q: "How do I delete my account?",
    a: "Use Profile → Delete account in the app, or follow our account deletion policy on the web.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: { "@type": "Answer", text: item.a },
  })),
};

export default function FaqPage() {
  return (
    <MarketingPage title="FAQ" lead="Quick answers about booking, pricing, and support.">
      <JsonLd data={faqJsonLd} />
      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        {FAQ.map((item) => (
          <div key={item.q} className="om-card">
            <h2 style={{ fontSize: "1.0625rem", margin: "0 0 0.5rem" }}>{item.q}</h2>
            <p style={{ margin: 0, color: "var(--om-muted)" }}>{item.a}</p>
          </div>
        ))}
      </div>
      <p style={{ marginTop: "1.5rem" }}>
        <Link href="/contact">Contact support</Link> · <Link href="/legal/account-deletion">Account deletion</Link>
      </p>
    </MarketingPage>
  );
}
