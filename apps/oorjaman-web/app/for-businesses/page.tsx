import Link from "next/link";
import { BusinessCallbackForm } from "@/components/BusinessCallbackForm";
import { MarketingPage } from "@/components/MarketingPage";
import { ScrollReveal } from "@/components/ScrollReveal";
import { buildPageMetadata } from "@/lib/seo";
import styles from "@/components/audience-page.module.css";

export const metadata = buildPageMetadata({
  title: "For businesses",
  description: "Commercial solar rooftop cleaning and AMC for factories, warehouses, and offices.",
  path: "/for-businesses",
});

const points = [
  {
    title: "Larger arrays, clear packages",
    body: "Capacity-based packages suited to commercial rooftops with transparent totals before pay.",
  },
  {
    title: "Evidence for facilities",
    body: "Visit tracking, booking codes, and completion photos for audits and vendor accountability.",
  },
  {
    title: "Partner network",
    body: "Verified vendors and technicians trained for rooftop solar O&M - not an ad-hoc crew hunt.",
  },
  {
    title: "Multi-site rollouts",
    body: "Register each rooftop in-app; request a callback below for sequencing across cities or campuses.",
  },
] as const;

export default function ForBusinessesPage() {
  return (
    <MarketingPage
      title="For businesses"
      lead="Commercial rooftops need reliable uptime. OorjaMan packages visits for larger arrays with the same transparent pricing model."
      mediaSrc="/marketing/service-amc.jpg"
      mediaPosition="center 42%"
      wide
      cta={
        <>
          <Link href="/download" className="om-btn om-btn--primary">
            Get the app
          </Link>
          <a href="#callback" className="om-btn om-btn--ghost-light">
            Request a callback
          </a>
        </>
      }
    >
      <ScrollReveal>
        <p className={styles.leadExtra}>
          Factories, warehouses, offices, and campus installations can register sites with access constraints so
          technicians arrive prepared. Use one-time cleans for catch-up work or AMC plans for scheduled care.
        </p>
      </ScrollReveal>

      <div className={styles.grid}>
        {points.map((p, i) => (
          <ScrollReveal key={p.title} className={styles.card} delayMs={i * 50}>
            <h2 className={styles.cardTitle}>{p.title}</h2>
            <p className={styles.cardBody}>{p.body}</p>
          </ScrollReveal>
        ))}
      </div>

      <ScrollReveal className={styles.split}>
        <div className={styles.splitCard}>
          <h2 className={styles.formTitle}>Book in the app</h2>
          <p className={styles.splitBody}>
            Best for single sites and teams ready to register rooftops themselves. Download the customer app and confirm
            partner coverage at each address.
          </p>
          <Link href="/download" className="om-btn om-btn--primary">
            Get the app
          </Link>
        </div>
        <div className={styles.splitCard} id="callback">
          <h2 className={styles.formTitle}>Request a callback</h2>
          <p className={styles.splitBody}>
            For multi-site or commercial rollouts - we will reply from support with next steps.
          </p>
          <BusinessCallbackForm context="business" />
        </div>
      </ScrollReveal>

      <p className={styles.actions}>
        <Link href="/pricing" className="om-btn om-btn--outline">
          Pricing
        </Link>
        <Link href="/how-it-works" className="om-btn om-btn--outline">
          How it works
        </Link>
        <Link href="/contact" className="om-btn om-btn--outline">
          Contact
        </Link>
      </p>
    </MarketingPage>
  );
}
