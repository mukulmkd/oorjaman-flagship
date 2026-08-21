import Link from "next/link";
import { BusinessCallbackForm } from "@/components/BusinessCallbackForm";
import { JsonLd } from "@/components/JsonLd";
import { MarketingPage } from "@/components/MarketingPage";
import { ScrollReveal } from "@/components/ScrollReveal";
import { FeatureCardGrid, SectionHead } from "@/components/marketing-sections";
import { BUSINESS_SOCIETY_FAQ_ITEMS, businessSocietyJsonLd } from "@/lib/faq";
import { buildPageMetadata } from "@/lib/seo";
import styles from "@/components/audience-page.module.css";
import faqStyles from "@/app/faq/faq.module.css";

export const metadata = buildPageMetadata({
  title: "Businesses & societies — solar cleaning & AMC",
  description:
    "Solar panel cleaning and AMC for factories, warehouses, offices, campuses, and housing societies. Multi-site registration, visit tracking, and completion evidence through verified partners.",
  path: "/for-businesses",
});

const points = [
  {
    title: "Larger arrays, clear packages",
    body: "Capacity-based packages suited to commercial rooftops and society plants with transparent totals before pay.",
    icon: "building" as const,
  },
  {
    title: "Evidence for committees & facilities",
    body: "Visit tracking, booking codes, and before/after photos for audits, RWAs, and vendor accountability.",
    icon: "camera" as const,
  },
  {
    title: "Verified partner network",
    body: "Approved vendors and technicians trained for rooftop solar O&M — not an ad-hoc crew hunt.",
    icon: "shield" as const,
  },
  {
    title: "Multi-site & multi-block rollouts",
    body: "Register each rooftop or block in-app; request a callback for sequencing across campuses or society towers.",
    icon: "pin" as const,
  },
] as const;

export default function ForBusinessesPage() {
  return (
    <MarketingPage
      title="Businesses & societies"
      lead="Commercial rooftops and housing societies need reliable uptime. OorjaMan packages cleaning and AMC for larger arrays and shared plants — with transparent pricing and visit evidence."
      mediaSrc="/marketing/service-amc.jpg"
      mediaPosition="center 42%"
      wide
      cta={
        <>
          <Link href="/download" className="om-btn om-btn--primary">
            Book now
          </Link>
          <a href="#callback" className="om-btn om-btn--ghost-light">
            Request a callback
          </a>
        </>
      }
    >
      <JsonLd data={businessSocietyJsonLd()} />

      <ScrollReveal>
        <p className={styles.leadExtra}>
          Factories, warehouses, offices, campuses, and housing societies (RWAs) can register sites with access and water
          notes so technicians arrive prepared. Use one-time cleans for catch-up work or AMC plans for scheduled care.
          Confirm partner coverage at each address in the app.
        </p>
      </ScrollReveal>

      <FeatureCardGrid items={points} />

      <section className={styles.segmentBlock} id="societies">
        <ScrollReveal>
          <SectionHead
            eyebrow="Housing societies"
            title="Shared rooftops for RWAs and committees"
            lead="Society plants need scheduled care and a clear record after every visit — not one-off crew calls."
          />
          <ul className={styles.segmentList}>
            <li>Register the society plant (or each block) with capacity and terrace access notes.</li>
            <li>Choose one-time cleaning or an AMC so visits recur instead of emergency call-outs.</li>
            <li>Share completion photos and visit status with the committee from the customer app.</li>
          </ul>
          <p className={styles.segmentCta}>
            <Link href="/services/amc-maintenance" className="om-btn om-btn--outline">
              Explore AMC plans
            </Link>
            <Link href="/how-it-works" className="om-btn om-btn--outline">
              How visits work
            </Link>
          </p>
        </ScrollReveal>
      </section>

      <section className={styles.segmentBlock} id="commercial">
        <ScrollReveal>
          <SectionHead
            eyebrow="Commercial sites"
            title="Factories, warehouses, offices, and campuses"
            lead="Facilities teams get clearer scheduling across sites and evidence after every rooftop visit."
          />
          <ul className={styles.segmentList}>
            <li>Capacity-based packages sized for larger commercial arrays.</li>
            <li>Access constraints and water notes captured per rooftop at registration.</li>
            <li>Multi-site or multi-city sequencing — start with a callback when you need support planning coverage.</li>
          </ul>
        </ScrollReveal>
      </section>

      <ScrollReveal className={styles.split}>
        <div className={styles.splitCard}>
          <h2 className={styles.formTitle}>Book in the app</h2>
          <p className={styles.splitBody}>
            Best for single sites and teams ready to register rooftops themselves. Download the customer app and confirm
            partner coverage at each address.
          </p>
          <Link href="/download" className="om-btn om-btn--primary">
            Book now
          </Link>
        </div>
        <div className={styles.splitCard} id="callback">
          <h2 className={styles.formTitle}>Request a callback</h2>
          <p className={styles.splitBody}>
            For multi-site, multi-block, or commercial rollouts — we will reply from support with next steps.
          </p>
          <BusinessCallbackForm context="business" />
        </div>
      </ScrollReveal>

      <ScrollReveal className={styles.segmentBlock}>
        <SectionHead
          eyebrow="FAQ"
          title="Commercial & society questions"
          lead="Short answers facilities teams and society committees ask most often."
        />
        <div className={faqStyles.list}>
          {BUSINESS_SOCIETY_FAQ_ITEMS.map((item) => (
            <div key={item.q} className={faqStyles.item}>
              <h3 className={faqStyles.question}>{item.q}</h3>
              <p className={faqStyles.answer}>{item.a}</p>
            </div>
          ))}
        </div>
        <p className={styles.segmentCta}>
          <Link href="/faq">Full FAQ</Link>
          <span aria-hidden> · </span>
          <Link href="/contact">Contact</Link>
        </p>
      </ScrollReveal>
    </MarketingPage>
  );
}
