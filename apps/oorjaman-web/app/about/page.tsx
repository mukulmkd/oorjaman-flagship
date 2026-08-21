import Link from "next/link";
import { MarketingPage } from "@/components/MarketingPage";
import { ScrollReveal } from "@/components/ScrollReveal";
import { FeatureCardGrid } from "@/components/marketing-sections";
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

const pillars = [
  {
    title: "What OorjaMan operates",
    body: "Scheduling, catalogue pricing, payments, safety workflows, partner approvals, and settlements — the platform layer that keeps visits accountable.",
    icon: "check" as const,
  },
  {
    title: "What partners fulfil",
    body: "On-roof cleaning and maintenance by independent verified vendors and technicians — not an OorjaMan in-house crew.",
    icon: "shield" as const,
  },
  {
    title: "How support works",
    body: "Platform operators manage vendor approvals, pricing catalogues, and support so partners clean and you keep generating.",
    icon: "clock" as const,
  },
] as const;

export default function AboutPage() {
  return (
    <MarketingPage
      title="About OorjaMan"
      lead="We connect property owners with verified solar O&M partners — technology for scheduling, pricing, safety workflows, and settlements."
      mediaSrc="/marketing/team-rooftop.jpg"
      mediaPosition="center 42%"
      wide
      cta={
        <>
          <Link href="/download" className="om-btn om-btn--primary">
            Book now
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

      <FeatureCardGrid items={pillars} />

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
    </MarketingPage>
  );
}
