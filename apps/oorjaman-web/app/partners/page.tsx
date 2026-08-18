import Link from "next/link";
import { MarketingPage } from "@/components/MarketingPage";
import { ScrollReveal } from "@/components/ScrollReveal";
import { buildPageMetadata } from "@/lib/seo";
import { SUPPORT_EMAIL, vendorPortalPublicUrl } from "@/lib/site";
import styles from "./partners.module.css";

export const metadata = buildPageMetadata({
  title: "Become a partner",
  description: "Join OorjaMan as a solar O&M partner - bookings, technicians, and settlements on one platform.",
  path: "/partners",
});

const benefits = [
  {
    title: "Marketplace demand",
    body: "Receive assigned and marketplace bookings in your service area once approved.",
  },
  {
    title: "Partner + technician apps",
    body: "Accept jobs, assign Oorja Men, run safety checklists, and capture visit evidence.",
  },
  {
    title: "Clear settlements",
    body: "Finance views for visit payouts and platform adjustments in the partner portal.",
  },
] as const;

export default function PartnersPage() {
  const portal = vendorPortalPublicUrl();

  function applyCta(className: string) {
    return portal ? (
      <a href={`${portal}/signup`} className={className} rel="noopener noreferrer">
        Apply as a partner
      </a>
    ) : (
      <a
        href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Partner application - OorjaMan")}`}
        className={className}
      >
        Email to apply
      </a>
    );
  }

  return (
    <MarketingPage
      title="Partner with OorjaMan"
      lead="Grow demand for your solar cleaning and maintenance business. Manage technicians, accept bookings, and view settlements in the partner portal."
      mediaSrc="/marketing/team-rooftop.jpg"
      mediaPosition="center 42%"
      wide
      cta={
        <>
          {applyCta("om-btn om-btn--primary")}
          <Link href="/legal/vendor-partner-agreement" className="om-btn om-btn--ghost-light">
            Partner agreement
          </Link>
        </>
      }
    >
      <div className={styles.grid}>
        {benefits.map((b, i) => (
          <ScrollReveal key={b.title} className={styles.card} delayMs={i * 55}>
            <h2 className={styles.cardTitle}>{b.title}</h2>
            <p className={styles.cardBody}>{b.body}</p>
          </ScrollReveal>
        ))}
      </div>

      <ScrollReveal className={styles.note}>
        <p>
          OorjaMan is a technology marketplace. Partners remain independent businesses; only approved vendors are
          visible for customer booking.
        </p>
      </ScrollReveal>

      {!portal ? (
        <ScrollReveal>
          <p className={styles.portalNote}>
            Partner portal signup will open here once the production portal URL is configured. Until then, email{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> with your city, team size, and GSTIN.
          </p>
        </ScrollReveal>
      ) : null}

      <p className={styles.actions}>
        {applyCta("om-btn om-btn--primary")}
        <Link href="/legal/vendor-partner-agreement" className="om-btn om-btn--outline">
          Partner agreement
        </Link>
        <Link href="/safety" className="om-btn om-btn--outline">
          Safety standards
        </Link>
      </p>
    </MarketingPage>
  );
}
