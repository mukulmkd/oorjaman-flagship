import Link from "next/link";
import { BusinessCallbackForm } from "@/components/BusinessCallbackForm";
import { MarketingPage } from "@/components/MarketingPage";
import { SocialLinks } from "@/components/SocialLinks";
import { buildPageMetadata } from "@/lib/seo";
import {
  COMPANY_ADDRESS,
  COMPANY_GSTIN,
  COMPANY_LEGAL_NAME,
  GRIEVANCE_EMAIL,
  grievanceOfficerLabel,
  LEGAL_EMAIL,
  PRIVACY_EMAIL,
  SUPPORT_EMAIL,
  SUPPORT_HOURS,
  SUPPORT_PHONE,
  SUPPORT_PHONE_TEL,
} from "@/lib/site";
import styles from "./contact.module.css";

export const metadata = buildPageMetadata({
  title: "Contact us",
  description: "Reach OorjaMan support, privacy, grievance, and legal teams.",
  path: "/contact",
});

export default function ContactPage() {
  return (
    <MarketingPage title="Contact" lead="We typically respond within one business day.">
      <div className={styles.grid}>
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Customer support</h2>
          <p className={styles.line}>
            <a href={`tel:${SUPPORT_PHONE_TEL}`}>{SUPPORT_PHONE}</a>
          </p>
          <p className={styles.line}>
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
          </p>
          <p className={styles.meta}>
            Bookings, visits, payments, and in-app chat escalations. Hours: {SUPPORT_HOURS}.
          </p>
          <div className={styles.social}>
            <SocialLinks tone="onLight" />
          </div>
        </div>
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Privacy</h2>
          <p className={styles.line}>
            <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>
          </p>
          <p className={styles.meta}>Data access, correction, and deletion requests.</p>
        </div>
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Legal</h2>
          <p className={styles.line}>
            <a href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a>
          </p>
          <p className={styles.meta}>Terms, partner agreements, and compliance notices.</p>
        </div>
      </div>

      <div className={styles.wideCard}>
        <h2 className={styles.cardTitle}>Grievance Officer</h2>
        <p className={styles.line}>
          <strong>{grievanceOfficerLabel()}</strong>
        </p>
        <p className={styles.line}>
          <a href={`mailto:${GRIEVANCE_EMAIL}`}>{GRIEVANCE_EMAIL}</a>
        </p>
        <p className={styles.meta}>
          Formal complaints about marketplace services, Partners, or platform conduct. Full process:{" "}
          <Link href="/legal/grievance-redressal">Grievance Redressal</Link>.
        </p>
      </div>

      <div className={styles.section}>
        <h2 className="om-h3">Business / multi-site callback</h2>
        <BusinessCallbackForm context="contact" />
      </div>

      <div className={styles.section}>
        <h2 className="om-h3">Registered entity</h2>
        <p className={styles.entityName}>{COMPANY_LEGAL_NAME}</p>
        <p className={styles.line}>{COMPANY_ADDRESS}</p>
        {COMPANY_GSTIN ? <p className={styles.line}>GSTIN: {COMPANY_GSTIN}</p> : null}
        <p className={styles.entityMeta}>
          OorjaMan is a technology marketplace operated by {COMPANY_LEGAL_NAME}. On-site cleaning is fulfilled by
          independent verified partners.
        </p>
      </div>

      <p className={styles.footerLinks}>
        <Link href="/legal/account-deletion">Account deletion</Link> ·{" "}
        <Link href="/legal/privacy-policy">Privacy &amp; Data Protection</Link> ·{" "}
        <Link href="/pricing">Pricing</Link> · <Link href="/download">Book now</Link> ·{" "}
        <Link href="/partners">Partner enquiries</Link>
      </p>
    </MarketingPage>
  );
}
