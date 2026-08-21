import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { isPublicMarketingIndexable, parseDeployEnvironment } from "@oorjaman/config";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { JsonLd } from "@/components/JsonLd";
import { CookieConsent } from "@/components/CookieConsent";
import { Analytics } from "@/components/Analytics";
import { StickySupportCall } from "@/components/StickySupportCall";
import { homeMetadata, brandEntityJsonLd } from "@/lib/seo";
import { SITE_NAME } from "@/lib/site";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-plus-jakarta",
  weight: ["400", "500", "600", "700"],
});

const uatDeploy = !isPublicMarketingIndexable(
  parseDeployEnvironment({ siteUrl: process.env.NEXT_PUBLIC_SITE_URL }),
);

export const metadata: Metadata = {
  ...homeMetadata,
  title: {
    default: uatDeploy
      ? `${SITE_NAME} (UAT)`
      : `${SITE_NAME} — Solar panel cleaning & AMC in India`,
    template: `%s | ${SITE_NAME}`,
  },
  icons: {
    icon: [{ url: "/favicon.png", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", type: "image/png" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={plusJakarta.variable}>
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
        {uatDeploy ? null : <JsonLd data={brandEntityJsonLd()} />}
        <SiteHeader />
        <main id="main" style={{ flex: 1 }}>
          {children}
        </main>
        <SiteFooter />
        <StickySupportCall />
        <CookieConsent />
        <Analytics />
      </body>
    </html>
  );
}
