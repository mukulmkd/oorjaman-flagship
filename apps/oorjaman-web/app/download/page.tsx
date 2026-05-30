import Link from "next/link";
import { buildPageMetadata } from "@/lib/seo";
import { APP_LINKS } from "@/lib/site";

export const metadata = buildPageMetadata({
  title: "Download the OorjaMan app",
  description: "Get the OorjaMan customer app on iOS and Android to book solar panel cleaning and AMC.",
  path: "/download",
});

export default function DownloadPage() {
  return (
    <div className="om-section">
      <div className="om-container" style={{ maxWidth: "40rem" }}>
        <h1 className="om-h1">Download OorjaMan</h1>
        <p className="om-lead">
          Book cleaning visits, manage AMC plans, track technicians, and chat with support - all from the customer
          app.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", marginBottom: "2rem" }}>
          <a href={APP_LINKS.customerIos} className="om-btn om-btn--primary" rel="noopener noreferrer">
            App Store (iOS)
          </a>
          <a href={APP_LINKS.customerAndroid} className="om-btn om-btn--outline" rel="noopener noreferrer">
            Google Play (Android)
          </a>
        </div>
        <p style={{ fontSize: "0.875rem", color: "var(--om-muted)" }}>
          Already installed? Open the app with scheme{" "}
          <code style={{ fontSize: "0.8125rem" }}>{APP_LINKS.customerScheme}</code>
        </p>
        <p style={{ marginTop: "1.5rem" }}>
          <Link href="/legal/privacy-policy">Privacy Policy</Link> · <Link href="/legal/terms-of-service">Terms</Link>
        </p>
      </div>
    </div>
  );
}
