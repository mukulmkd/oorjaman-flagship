import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { cityLandings, getCityLanding } from "@/lib/cities";
import { buildPageMetadata } from "@/lib/seo";
import { siteUrl } from "@/lib/site";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return cityLandings.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const city = getCityLanding(slug);
  if (!city) return {};
  return buildPageMetadata({
    title: city.headline,
    description: `${city.intro.slice(0, 155)}…`,
    path: `/cities/${city.slug}`,
  });
}

export default async function CityPage({ params }: Props) {
  const { slug } = await params;
  const city = getCityLanding(slug);
  if (!city) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: `OorjaMan solar panel cleaning - ${city.name}`,
    areaServed: {
      "@type": "City",
      name: city.name,
    },
    provider: {
      "@type": "Organization",
      name: "OorjaMan",
      url: siteUrl(),
    },
    url: siteUrl(`/cities/${city.slug}`),
  };

  return (
    <div className="om-section">
      <JsonLd data={jsonLd} />
      <div className="om-container" style={{ maxWidth: "48rem" }}>
        <p style={{ color: "var(--om-muted)", fontSize: "0.875rem" }}>
          <Link href="/cities">All cities</Link> · {city.state}
        </p>
        <h1 className="om-h1">{city.headline}</h1>
        <p className="om-lead">{city.intro}</p>
        <ul>
          {city.localNotes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
        <p style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginTop: "1.5rem" }}>
          <Link href="/download" className="om-btn om-btn--primary">
            Get the app
          </Link>
          <Link href="/services/panel-cleaning" className="om-btn om-btn--outline">
            Panel cleaning
          </Link>
          <Link href="/services/amc-maintenance" className="om-btn om-btn--outline">
            AMC plans
          </Link>
        </p>
      </div>
    </div>
  );
}
