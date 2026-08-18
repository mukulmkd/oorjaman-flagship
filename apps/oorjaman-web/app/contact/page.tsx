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

export const metadata = buildPageMetadata({
  title: "Contact us",
  description: "Reach OorjaMan support, privacy, grievance, and legal teams.",
  path: "/contact",
});

export default function ContactPage() {
  return (
    <MarketingPage title="Contact" lead="We typically respond within one business day.">
      <div className="om-grid-3">
        <div className="om-card">
          <h2 className="om-h3">Customer support</h2>
          <p style={{ margin: 0 }}>
            <a href={`tel:${SUPPORT_PHONE_TEL}`}>{SUPPORT_PHONE}</a>
          </p>
          <p style={{ margin: "0.5rem 0 0" }}>
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
          </p>
          <p style={{ margin: "0.75rem 0 0", fontSize: "0.875rem", color: "var(--om-muted)" }}>
            Bookings, visits, payments, and in-app chat escalations. Hours: {SUPPORT_HOURS}.
          </p>
          <div style={{ marginTop: "0.85rem" }}>
            <SocialLinks tone="onLight" />
          </div>
        </div>
        <div className="om-card">
          <h2 className="om-h3">Privacy</h2>
          <p style={{ margin: 0 }}>
            <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>
          </p>
          <p style={{ margin: "0.75rem 0 0", fontSize: "0.875rem", color: "var(--om-muted)" }}>
            Data access, correction, and deletion requests.
          </p>
        </div>
        <div className="om-card">
          <h2 className="om-h3">Legal</h2>
          <p style={{ margin: 0 }}>
            <a href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a>
          </p>
          <p style={{ margin: "0.75rem 0 0", fontSize: "0.875rem", color: "var(--om-muted)" }}>
            Terms, partner agreements, and compliance notices.
          </p>
        </div>
      </div>

      <div className="om-card" style={{ marginTop: "1.25rem" }}>
        <h2 className="om-h3">Grievance Officer</h2>
        <p style={{ margin: 0 }}>
          <strong>{grievanceOfficerLabel()}</strong>
        </p>
        <p style={{ margin: "0.5rem 0 0" }}>
          <a href={`mailto:${GRIEVANCE_EMAIL}`}>{GRIEVANCE_EMAIL}</a>
        </p>
        <p style={{ margin: "0.75rem 0 0", fontSize: "0.875rem", color: "var(--om-muted)" }}>
          Formal complaints about marketplace services, Partners, or platform conduct. Full process:{" "}
          <Link href="/legal/grievance-redressal">Grievance Redressal</Link>.
        </p>
      </div>

      <div style={{ marginTop: "2rem" }}>
        <h2 className="om-h3">Business / multi-site callback</h2>
        <BusinessCallbackForm context="contact" />
      </div>

      <h2 className="om-h3" style={{ marginTop: "2rem" }}>
        Registered entity
      </h2>
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
      <p style={{ fontSize: "0.875rem", color: "var(--om-muted)" }}>
        OorjaMan is a technology marketplace operated by {COMPANY_LEGAL_NAME}. On-site cleaning is fulfilled by
        independent verified partners.
      </p>

      <p style={{ marginTop: "1.5rem" }}>
        <Link href="/legal/account-deletion">Account deletion</Link> ·{" "}
        <Link href="/legal/privacy-policy">Privacy &amp; Data Protection</Link> ·{" "}
        <Link href="/pricing">Pricing</Link> · <Link href="/download">Get the app</Link> ·{" "}
        <Link href="/partners">Partner enquiries</Link>
      </p>
    </MarketingPage>
  );
}
