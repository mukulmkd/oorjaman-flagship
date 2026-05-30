import type { Metadata } from "next";
import { isPublicMarketingIndexable, parseDeployEnvironment } from "@oorjaman/config";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { JsonLd } from "@/components/JsonLd";
import { homeMetadata } from "@/lib/seo";
import { SITE_NAME, siteUrl, SUPPORT_EMAIL } from "@/lib/site";
import "./globals.css";

const uatDeploy = !isPublicMarketingIndexable(
  parseDeployEnvironment({ siteUrl: process.env.NEXT_PUBLIC_SITE_URL }),
);

export const metadata: Metadata = {
  ...homeMetadata,
  title: {
    default: uatDeploy
      ? `${SITE_NAME} (UAT)`
      : `${SITE_NAME} - Solar panel cleaning & AMC in India`,
    template: `%s | ${SITE_NAME}`,
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_NAME,
  url: siteUrl(),
  logo: siteUrl("/og-default.png"),
  description: "Solar rooftop cleaning and annual maintenance contracts (AMC) in India.",
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    email: SUPPORT_EMAIL,
    availableLanguage: ["English", "Hindi"],
  },
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: siteUrl(),
  potentialAction: {
    "@type": "SearchAction",
    target: `${siteUrl("/faq")}?q={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        {uatDeploy ? (
          <div
            role="status"
            style={{
              padding: "0.4rem 1rem",
              textAlign: "center",
              fontSize: "0.8125rem",
              fontWeight: 600,
              background: "#fef3c7",
              color: "#92400e",
              borderBottom: "1px solid #fcd34d",
            }}
          >
            UAT environment - not for production use or search indexing
          </div>
        ) : null}
        <a href="#main" className="om-skip-link">
          Skip to content
        </a>
        {uatDeploy ? null : <JsonLd data={[organizationJsonLd, websiteJsonLd]} />}
        <SiteHeader />
        <main id="main" style={{ flex: 1 }}>
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
