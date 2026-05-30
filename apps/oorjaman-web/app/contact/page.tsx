import Link from "next/link";
import { buildPageMetadata } from "@/lib/seo";
import { LEGAL_EMAIL, PRIVACY_EMAIL, SUPPORT_EMAIL } from "@/lib/site";

export const metadata = buildPageMetadata({
  title: "Contact us",
  description: "Reach OorjaMan support, privacy, and legal teams.",
  path: "/contact",
});

export default function ContactPage() {
  return (
    <div className="om-section">
      <div className="om-container">
        <h1 className="om-h1">Contact</h1>
        <p className="om-lead">We typically respond within one business day.</p>
        <div className="om-grid-3">
          <div className="om-card">
            <h2 style={{ fontSize: "1.125rem", marginTop: 0 }}>Customer support</h2>
            <p style={{ margin: 0 }}>
              <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
            </p>
            <p style={{ margin: "0.75rem 0 0", fontSize: "0.875rem", color: "var(--om-muted)" }}>
              Bookings, visits, payments, and in-app chat escalations.
            </p>
          </div>
          <div className="om-card">
            <h2 style={{ fontSize: "1.125rem", marginTop: 0 }}>Privacy</h2>
            <p style={{ margin: 0 }}>
              <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>
            </p>
            <p style={{ margin: "0.75rem 0 0", fontSize: "0.875rem", color: "var(--om-muted)" }}>
              Data access, correction, and deletion requests.
            </p>
          </div>
          <div className="om-card">
            <h2 style={{ fontSize: "1.125rem", marginTop: 0 }}>Legal</h2>
            <p style={{ margin: 0 }}>
              <a href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a>
            </p>
            <p style={{ margin: "0.75rem 0 0", fontSize: "0.875rem", color: "var(--om-muted)" }}>
              Terms, partner agreements, and compliance notices.
            </p>
          </div>
        </div>
        <p style={{ marginTop: "2rem" }}>
          <Link href="/legal/account-deletion">Account deletion instructions</Link> ·{" "}
          <Link href="/download">Download the app</Link>
        </p>
      </div>
    </div>
  );
}
