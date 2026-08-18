import Link from "next/link";
import { MarketingPage } from "@/components/MarketingPage";
import { ScrollReveal } from "@/components/ScrollReveal";
import { SocialLinks } from "@/components/SocialLinks";
import { buildPageMetadata } from "@/lib/seo";
import {
  COMPANY_ADDRESS,
  COMPANY_GSTIN,
  COMPANY_LEGAL_NAME,
  INFO_EMAIL,
  SUPPORT_EMAIL,
} from "@/lib/site";
import styles from "./about.module.css";

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
      mediaSrc="/marketing/team-rooftop.jpg"
      mediaPosition="center 42%"
      wide
      cta={
        <>
          <Link href="/download" className="om-btn om-btn--primary">
            Get the app
          </Link>
          <Link href="/contact" className="om-btn om-btn--ghost-light">
            Contact
          </Link>
        </>
      }
    >
      <ScrollReveal>
        <p className={styles.leadExtra}>
          OorjaMan is a premium clean-tech <strong>technology marketplace</strong> for solar panel cleaning and annual
          maintenance contracts (AMC). Homeowners and businesses book in the customer app; independent vetted partners
          accept jobs, assign technicians, and close visits with safety checks and photo evidence.
        </p>
      </ScrollReveal>

      <div className={styles.split}>
        <ScrollReveal className={styles.card}>
          <h2 className={styles.cardTitle}>What OorjaMan operates</h2>
          <p className={styles.cardBody}>
            Scheduling, catalogue pricing, payments, safety workflows, partner approvals, and settlements - the platform
            layer that keeps visits accountable.
          </p>
        </ScrollReveal>
        <ScrollReveal className={styles.card} delayMs={70}>
          <h2 className={styles.cardTitle}>What partners fulfil</h2>
          <p className={styles.cardBody}>
            On-roof cleaning and maintenance by independent verified vendors and technicians - not an OorjaMan
            in-house crew.
          </p>
        </ScrollReveal>
      </div>

      <ScrollReveal className={styles.section}>
        <p>
          Platform operators manage vendor approvals, pricing catalogues, and support from dedicated admin and support
          tools. Our brand promise remains: partners clean so you can keep generating.
        </p>
      </ScrollReveal>

      <ScrollReveal className={styles.section}>
        <h2 className="om-h3">Company</h2>
        <p>
          <strong>{COMPANY_LEGAL_NAME}</strong>
          <br />
          {COMPANY_ADDRESS}
          {COMPANY_GSTIN ? (
            <>
              <br />
              GSTIN: {COMPANY_GSTIN}
            </>
          ) : null}
        </p>
        <p>
          General enquiries: <a href={`mailto:${INFO_EMAIL}`}>{INFO_EMAIL}</a>
          <br />
          Customer support: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        </p>
        <SocialLinks tone="onLight" />
      </ScrollReveal>

      <p className={styles.actions}>
        <Link href="/contact" className="om-btn om-btn--outline">
          Contact
        </Link>
        <Link href="/partners" className="om-btn om-btn--outline">
          Partner programme
        </Link>
        <Link href="/safety" className="om-btn om-btn--outline">
          Safety &amp; quality
        </Link>
        <Link href="/legal" className="om-btn om-btn--outline">
          Legal policies
        </Link>
      </p>
    </MarketingPage>
  );
}
