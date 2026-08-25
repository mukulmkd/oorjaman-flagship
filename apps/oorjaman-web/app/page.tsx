import Link from "next/link";
import { HomeHero } from "@/components/HomeHero";
import { JsonLd } from "@/components/JsonLd";
import { ScrollReveal } from "@/components/ScrollReveal";
import {
  ClosingCtaBand,
  CommercialBand,
  FeatureCardGrid,
  SectionBlock,
  SectionHead,
  ServicePriceCards,
  StepRail,
  TrustIconRow,
} from "@/components/marketing-sections";
import { faqPageJsonLd } from "@/lib/faq";
import {
  commercialPoints,
  homeSteps,
  trustItems,
  whyFeatures,
} from "@/lib/home-content";
import { getMarketingMedia } from "@/lib/marketing-media";
import {
  formatInrWhole,
  OORJAMAN_AMC_PLANS_INR,
  OORJAMAN_ONE_TIME_VISIT_PRICES_INR,
} from "@/lib/pricing-catalog";
import { homeMetadata } from "@/lib/seo";
import { customerStoreListingsLive } from "@/lib/site";
import styles from "@/components/home.module.css";

export const metadata = homeMetadata;

export default function HomePage() {
  const storesLive = customerStoreListingsLive();
  const primaryCta = storesLive ? "Book now" : "Get notified";
  const media = getMarketingMedia();
  const cleaningFrom = OORJAMAN_ONE_TIME_VISIT_PRICES_INR[0]?.priceInr ?? 619;
  const amcFrom = Math.min(...OORJAMAN_AMC_PLANS_INR.map((p) => p.specialPriceInr));

  return (
    <>
      <JsonLd data={faqPageJsonLd()} />

      <HomeHero
        primaryCtaLabel={primaryCta}
        photoSrc={media.heroPhoto}
        videoSrc={media.heroVideo}
      />

      <div className={styles.businessStrip}>
        <div className={`om-container ${styles.businessStripInner}`}>
          <p className={styles.businessStripCopy}>
            Managing multiple rooftops? Get a commercial quote for societies, factories, and campuses.
          </p>
          <Link href="/for-businesses" className="om-btn om-btn--outline">
            Businesses &amp; societies
          </Link>
        </div>
      </div>

      <SectionBlock compact>
        <TrustIconRow items={trustItems} />
      </SectionBlock>

      <SectionBlock alt id="why">
        <ScrollReveal>
          <SectionHead
            eyebrow="Why OorjaMan"
            title="Clean panels. Clear accountability."
            lead="Transparent pricing, verified partners, and visit evidence — fulfilled on a technology marketplace."
            center
          />
        </ScrollReveal>
        <FeatureCardGrid items={whyFeatures} />
        <ScrollReveal className={styles.whyCtasCenter}>
          <Link href="/download" className="om-btn om-btn--primary">
            {primaryCta}
          </Link>
          <Link href="/safety" className="om-btn om-btn--outline">
            Safety &amp; quality
          </Link>
        </ScrollReveal>
      </SectionBlock>

      <SectionBlock>
        <ScrollReveal>
          <SectionHead
            eyebrow="How it works"
            title="From book to evidence"
            lead="Four clear steps — transparent and trackable in the app."
            center
          />
        </ScrollReveal>
        <StepRail steps={homeSteps} />
        <ScrollReveal className={styles.stepsMore}>
          <Link href="/how-it-works">Full how it works →</Link>
        </ScrollReveal>
      </SectionBlock>

      <SectionBlock alt>
        <ScrollReveal>
          <SectionHead
            eyebrow="Services"
            title="Cleaning and AMC plans"
            lead="One-time visits or scheduled maintenance — catalogue prices with GST included."
            center
          />
        </ScrollReveal>
        <ServicePriceCards
          cards={[
            {
              href: "/services/panel-cleaning",
              eyebrow: "One-time visit",
              title: "Panel cleaning",
              priceFrom: `from ${formatInrWhole(cleaningFrom)}`,
              body: "Capacity-based packages for residential rooftops with transparent totals before you pay.",
              cta: "View packages",
            },
            {
              href: "/services/amc-maintenance",
              eyebrow: "Annual plans",
              title: "AMC maintenance",
              priceFrom: `from ${formatInrWhole(amcFrom)}`,
              body: "Scheduled visits through the year so yield stays steady through dust and seasons.",
              cta: "Explore AMC",
              outline: true,
            },
          ]}
        />
      </SectionBlock>

      <CommercialBand
        title="Multi-site solar cleaning for businesses & societies"
        lead="Facilities teams and RWAs get clearer scheduling, visit tracking, and evidence after every rooftop visit."
        points={commercialPoints}
        primaryHref="/for-businesses"
        primaryLabel="Businesses & societies"
        secondaryHref="/contact"
        secondaryLabel="Talk to our team"
        imageSrc="/marketing/service-amc.jpg"
      />

      <ClosingCtaBand
        title="Ready to get your panels cleaned?"
        primaryLabel={primaryCta}
      />
    </>
  );
}
