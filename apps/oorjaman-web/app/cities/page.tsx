import Link from "next/link";
import { cityLandings } from "@/lib/cities";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "Solar panel cleaning by city",
  description: "Book OorjaMan solar rooftop cleaning and AMC in major Indian cities.",
  path: "/cities",
});

export default function CitiesIndexPage() {
  return (
    <div className="om-section">
      <div className="om-container">
        <h1 className="om-h1">Cities we serve</h1>
        <p className="om-lead">
          Local landing pages for solar panel cleaning and annual maintenance. Availability depends on partner coverage
          in your area-confirm in the app when you book.
        </p>
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
      </div>
    </div>
  );
}
