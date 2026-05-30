import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { homeMetadata } from "@/lib/seo";

export const metadata = homeMetadata;

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What services does OorjaMan provide?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "One-time solar panel cleaning visits and annual maintenance (AMC) plans by system size, fulfilled by verified partners.",
      },
    },
    {
      "@type": "Question",
      name: "How do I book a visit?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Download the OorjaMan customer app, register your site, pick a slot, and confirm transparent pricing before checkout.",
      },
    },
  ],
};

export default function HomePage() {
  return (
    <>
      <JsonLd data={faqJsonLd} />
      <section className="om-section" style={{ paddingTop: "3rem" }}>
        <div className="om-container">
          <p style={{ color: "var(--om-primary)", fontWeight: 600, margin: "0 0 0.5rem" }}>Solar rooftop care</p>
          <h1 className="om-h1">Keep every kilowatt-hour counting</h1>
          <p className="om-lead">
            OorjaMan connects homeowners and businesses with verified partners for professional panel cleaning,
            inspections, and AMC plans - with clear pricing and real-time visit tracking.
          </p>
          <p style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
            <Link href="/download" className="om-btn om-btn--primary">
              Download the app
            </Link>
            <Link href="/how-it-works" className="om-btn om-btn--outline">
              How it works
            </Link>
          </p>
        </div>
      </section>

      <section className="om-section om-section--alt">
        <div className="om-container">
          <h2 className="om-h2">Why OorjaMan</h2>
          <div className="om-grid-3">
            <div className="om-card">
              <h3 style={{ marginTop: 0 }}>Verified partners</h3>
              <p style={{ margin: 0, color: "var(--om-muted)" }}>
                Vetted vendors and technicians trained for safe rooftop solar work.
              </p>
            </div>
            <div className="om-card">
              <h3 style={{ marginTop: 0 }}>Transparent pricing</h3>
              <p style={{ margin: 0, color: "var(--om-muted)" }}>
                Package prices by kW band plus city-tier surcharges - shown before you pay.
              </p>
            </div>
            <div className="om-card">
              <h3 style={{ marginTop: 0 }}>Track every visit</h3>
              <p style={{ margin: 0, color: "var(--om-muted)" }}>
                Booking status, technician progress, and visit evidence in one place.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="om-section">
        <div className="om-container">
          <h2 className="om-h2">Services</h2>
          <div className="om-grid-3">
            <Link href="/services/panel-cleaning" className="om-card" style={{ textDecoration: "none", color: "inherit" }}>
              <h3 style={{ marginTop: 0 }}>Panel cleaning</h3>
              <p style={{ margin: 0, color: "var(--om-muted)" }}>One-time visits sized to your rooftop capacity.</p>
            </Link>
            <Link href="/services/amc-maintenance" className="om-card" style={{ textDecoration: "none", color: "inherit" }}>
              <h3 style={{ marginTop: 0 }}>AMC maintenance</h3>
              <p style={{ margin: 0, color: "var(--om-muted)" }}>Annual plans with scheduled visits per contract.</p>
            </Link>
            <Link href="/partners" className="om-card" style={{ textDecoration: "none", color: "inherit" }}>
              <h3 style={{ marginTop: 0 }}>Become a partner</h3>
              <p style={{ margin: 0, color: "var(--om-muted)" }}>Grow your solar O&amp;M business on the platform.</p>
            </Link>
          </div>
        </div>
      </section>

      <section className="om-section om-section--alt">
        <div className="om-container" style={{ textAlign: "center" }}>
          <h2 className="om-h2">Ready to book?</h2>
          <p className="om-lead" style={{ marginInline: "auto" }}>
            Install the OorjaMan customer app on iOS or Android.
          </p>
          <Link href="/download" className="om-btn om-btn--primary">
            Get the app
          </Link>
        </div>
      </section>
    </>
  );
}
