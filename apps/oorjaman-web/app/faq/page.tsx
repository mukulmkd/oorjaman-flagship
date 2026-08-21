import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { MarketingPage } from "@/components/MarketingPage";
import { ScrollReveal } from "@/components/ScrollReveal";
import { FAQ_ITEMS, faqPageJsonLd } from "@/lib/faq";
import { buildPageMetadata } from "@/lib/seo";
import styles from "./faq.module.css";

export const metadata = buildPageMetadata({
  title: "FAQ",
  description:
    "Frequently asked questions about OorjaMan solar cleaning, AMC, pricing, housing societies, commercial sites, and support.",
  path: "/faq",
});

export default function FaqPage() {
  return (
    <MarketingPage
      title="FAQ"
      lead="Clear answers about booking, pricing, AMC, societies, commercial sites, safety, and support."
    >
      <JsonLd data={faqPageJsonLd()} />
      <div className={styles.list}>
        {FAQ_ITEMS.map((item, i) => (
          <ScrollReveal key={item.q} className={styles.item} delayMs={Math.min(i, 6) * 40}>
            <h2 className={styles.question}>{item.q}</h2>
            <p className={styles.answer}>{item.a}</p>
          </ScrollReveal>
        ))}
      </div>
      <p className={styles.footerLinks}>
        <Link href="/contact">Contact support</Link> · <Link href="/pricing">Pricing</Link> ·{" "}
        <Link href="/legal/account-deletion">Account deletion</Link> ·{" "}
        <Link href="/legal/refund-cancellation">Refunds &amp; cancellations</Link>
      </p>
    </MarketingPage>
  );
}
