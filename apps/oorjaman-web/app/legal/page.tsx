import Link from "next/link";
import { MarketingPage } from "@/components/MarketingPage";
import { legalNav } from "@/lib/legal-docs";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "Legal policies",
  description: "Privacy, terms, account deletion, and other legal documents for OorjaMan.",
  path: "/legal",
});

export default function LegalIndexPage() {
  return (
    <MarketingPage
      title="Legal"
      lead="Policies for customers, partners, and app-store compliance. Last updated August 2026."
    >
      <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {legalNav.map((item) => (
          <li key={item.slug}>
            <Link
              href={item.href}
              className="om-card"
              style={{ display: "block", textDecoration: "none", color: "inherit" }}
            >
              {item.title}
            </Link>
          </li>
        ))}
      </ul>
    </MarketingPage>
  );
}
