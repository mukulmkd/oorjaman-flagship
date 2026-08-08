import Link from "next/link";
import { MarketingPage } from "@/components/MarketingPage";
import { cityLandings } from "@/lib/cities";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "Solar panel cleaning by city",
  description: "Book OorjaMan solar rooftop cleaning and AMC in major Indian cities.",
  path: "/cities",
});

export default function CitiesIndexPage() {
  return (
    <MarketingPage
      title="Cities we are expanding into"
      lead="Local landing pages for solar panel cleaning and annual maintenance. Availability depends on verified partner coverage at your address — confirm in the app when you book."
    >
      <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.75rem" }}>
        {cityLandings.map((city) => (
          <li key={city.slug}>
            <Link
              href={`/cities/${city.slug}`}
              className="om-card"
              style={{ display: "block", textDecoration: "none", color: "inherit" }}
            >
              <strong>{city.name}</strong>
              <span style={{ color: "var(--om-muted)", marginLeft: "0.5rem" }}>{city.state}</span>
            </Link>
          </li>
        ))}
      </ul>
    </MarketingPage>
  );
}
