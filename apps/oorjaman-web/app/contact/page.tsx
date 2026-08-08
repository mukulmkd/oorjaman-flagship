import Link from "next/link";
import { MarketingPage } from "@/components/MarketingPage";
import { buildPageMetadata } from "@/lib/seo";
import {
  COMPANY_ADDRESS,
  COMPANY_GSTIN,
  COMPANY_LEGAL_NAME,
  LEGAL_EMAIL,
  PRIVACY_EMAIL,
  SUPPORT_EMAIL,
} from "@/lib/site";

export const metadata = buildPageMetadata({
  title: "Contact us",
  description: "Reach OorjaMan support, privacy, and legal teams.",
  path: "/contact",
});

export default function ContactPage() {
  return (
    <MarketingPage title="Contact" lead="We typically respond within one business day.">
      <div className="om-grid-3">
        <div className="om-card">
          <h2 className="om-h3">Customer support</h2>
          <p style={{ margin: 0 }}>
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
          </p>
          <p style={{ margin: "0.75rem 0 0", fontSize: "0.875rem", color: "var(--om-muted)" }}>
            Bookings, visits, payments, and in-app chat escalations.
          </p>
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

      <p style={{ marginTop: "1.5rem" }}>
        <Link href="/legal/account-deletion">Account deletion instructions</Link> ·{" "}
        <Link href="/download">Get the app</Link> · <Link href="/partners">Partner enquiries</Link>
      </p>
    </MarketingPage>
  );
}
