import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ScrollReveal } from "@/components/ScrollReveal";
import { customerStoreListingsLive } from "@/lib/site";
import styles from "./marketing-sections.module.css";

type SectionHeadProps = {
  eyebrow?: string;
  title: string;
  lead?: string;
  center?: boolean;
};

export function SectionHead({ eyebrow, title, lead, center = false }: SectionHeadProps) {
  return (
    <div className={`${styles.sectionHead}${center ? ` ${styles.sectionHeadCenter}` : ""}`}>
      {eyebrow ? <p className="om-eyebrow">{eyebrow}</p> : null}
      <h2 className="om-h2">{title}</h2>
      {lead ? <p className={styles.sectionLead}>{lead}</p> : null}
    </div>
  );
}

const ICONS = {
  shield: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
      <path d="M9.5 12l1.8 1.8L15 10" />
    </svg>
  ),
  tag: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M20 12l-8 8-9-9V4h7l10 8z" />
      <circle cx="8.5" cy="8.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  ),
  pin: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M12 21s7-5.2 7-11a7 7 0 10-14 0c0 5.8 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.2" />
    </svg>
  ),
  camera: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M4 8h3l1.5-2h7L17 8h3v11H4V8z" />
      <circle cx="12" cy="13.5" r="3.2" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="12" cy="12" r="8.25" />
      <path d="M8.5 12.2l2.3 2.3 4.7-4.8" />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="12" cy="12" r="8.25" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  ),
  building: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M4 20h16M6 20V6l6-2 6 2v14M10 10h.01M14 10h.01M10 14h.01M14 14h.01" />
    </svg>
  ),
} as const;

export type MarketingIconName = keyof typeof ICONS;

type TrustItem = {
  title: string;
  body: string;
  icon: MarketingIconName;
};

export function TrustIconRow({ items }: { items: readonly TrustItem[] }) {
  return (
    <div className={styles.trustRow} role="list">
      {items.map((item, i) => (
        <ScrollReveal key={item.title} className={styles.trustItem} delayMs={i * 50}>
          <span className={styles.trustIcon}>{ICONS[item.icon]}</span>
          <div className={styles.trustCopy}>
            <p className={styles.trustTitle}>{item.title}</p>
            <p className={styles.trustBody}>{item.body}</p>
          </div>
        </ScrollReveal>
      ))}
    </div>
  );
}

type FeatureItem = {
  title: string;
  body: string;
  icon?: MarketingIconName;
};

export function FeatureCardGrid({ items }: { items: readonly FeatureItem[] }) {
  return (
    <div className={styles.featureGrid}>
      {items.map((item, i) => (
        <ScrollReveal key={item.title} className={styles.featureCard} delayMs={i * 55}>
          {item.icon ? <span className={styles.featureIcon}>{ICONS[item.icon]}</span> : null}
          <div className={styles.featureCopy}>
            <h3 className={styles.featureTitle}>{item.title}</h3>
            <p className={styles.featureBody}>{item.body}</p>
          </div>
        </ScrollReveal>
      ))}
    </div>
  );
}

type StepItem = {
  step: string;
  title: string;
  body: string;
};

export function StepRail({ steps }: { steps: readonly StepItem[] }) {
  return (
    <ol className={styles.stepRail}>
      {steps.map((step, i) => (
        <ScrollReveal key={step.step} as="li" className={styles.stepCard} delayMs={i * 60}>
          <span className={styles.stepIndex}>{step.step}</span>
          <div className={styles.stepCopy}>
            <h3 className={styles.stepTitle}>{step.title}</h3>
            <p className={styles.stepBody}>{step.body}</p>
          </div>
        </ScrollReveal>
      ))}
    </ol>
  );
}

type ServicePriceCard = {
  href: string;
  eyebrow: string;
  title: string;
  priceFrom: string;
  body: string;
  cta: string;
  outline?: boolean;
};

export function ServicePriceCards({ cards }: { cards: readonly ServicePriceCard[] }) {
  return (
    <div className={styles.servicePriceGrid}>
      {cards.map((card, i) => (
        <ScrollReveal key={card.href} delayMs={i * 70}>
          <Link href={card.href} className={styles.servicePriceCard}>
            <p className={styles.servicePriceEyebrow}>{card.eyebrow}</p>
            <h3 className={styles.servicePriceTitle}>{card.title}</h3>
            <p className={styles.servicePriceFrom}>{card.priceFrom}</p>
            <p className={styles.servicePriceBody}>{card.body}</p>
            <span
              className={`om-btn ${card.outline ? "om-btn--outline" : "om-btn--primary"} ${styles.servicePriceCta}`}
            >
              {card.cta}
            </span>
          </Link>
        </ScrollReveal>
      ))}
    </div>
  );
}

type CommercialBandProps = {
  eyebrow?: string;
  title: string;
  lead: string;
  points: readonly string[];
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  imageSrc?: string | null;
};

export function CommercialBand({
  eyebrow = "Businesses & societies",
  title,
  lead,
  points,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
  imageSrc = "/marketing/service-amc.jpg",
}: CommercialBandProps) {
  return (
    <section className={styles.commercial} aria-label={eyebrow}>
      <div className={`om-container ${styles.commercialInner}`}>
        <ScrollReveal>
          <p className="om-eyebrow">{eyebrow}</p>
          <h2 className={`om-h2 ${styles.commercialTitle}`}>{title}</h2>
          <p className={styles.commercialLead}>{lead}</p>
          <ul className={styles.commercialPoints}>
            {points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
          <div className={styles.commercialActions}>
            <Link href={primaryHref} className="om-btn om-btn--primary">
              {primaryLabel}
            </Link>
            {secondaryHref && secondaryLabel ? (
              <Link href={secondaryHref} className="om-btn om-btn--outline">
                {secondaryLabel}
              </Link>
            ) : null}
          </div>
        </ScrollReveal>
        {imageSrc ? (
          <ScrollReveal className={styles.commercialVisual} delayMs={80}>
            <Image
              src={imageSrc}
              alt=""
              fill
              sizes="(max-width: 960px) 100vw, 40vw"
              className={styles.commercialVisualImg}
            />
          </ScrollReveal>
        ) : null}
      </div>
    </section>
  );
}

type ClosingCtaBandProps = {
  title?: string;
  lead?: string;
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
};

export function ClosingCtaBand({
  title = "Ready to get your panels cleaned?",
  lead = "Book a visit or explore AMC in the OorjaMan app — fulfilled by verified partners with transparent pricing.",
  primaryHref = "/download",
  primaryLabel,
  secondaryHref = "/services/amc-maintenance",
  secondaryLabel = "Explore AMC",
}: ClosingCtaBandProps) {
  const storesLive = customerStoreListingsLive();
  const resolvedPrimary = primaryLabel ?? (storesLive ? "Get the app" : "Get notified");

  return (
    <section className={styles.closing} aria-label="Get started">
      <div className={`om-container ${styles.closingInner}`}>
        <div className={styles.closingCopy}>
          <h2 className={styles.closingTitle}>{title}</h2>
          <p className={styles.closingLead}>{lead}</p>
        </div>
        <div className={styles.closingActions}>
          <Link href={primaryHref} className="om-btn om-btn--primary">
            {resolvedPrimary}
          </Link>
          {secondaryHref && secondaryLabel ? (
            <Link href={secondaryHref} className="om-btn om-btn--ghost-light">
              {secondaryLabel}
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function SectionBlock({
  children,
  alt = false,
  compact = false,
  id,
}: {
  children: ReactNode;
  alt?: boolean;
  compact?: boolean;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={`om-section${alt ? " om-section--alt" : ""}${compact ? ` ${styles.sectionCompact}` : ""}`}
    >
      <div className="om-container">{children}</div>
    </section>
  );
}
