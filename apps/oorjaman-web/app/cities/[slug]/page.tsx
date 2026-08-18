import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { MarketingPage } from "@/components/MarketingPage";
import { ScrollReveal } from "@/components/ScrollReveal";
import { cityLandings, getPublishedCityLanding } from "@/lib/cities";
import { buildPageMetadata } from "@/lib/seo";
import { siteUrl } from "@/lib/site";
import styles from "../cities.module.css";

type Props = { params: Promise<{ slug: string }> };

const cityFaqs = (cityName: string) =>
  [
    {
      q: `Is OorjaMan available everywhere in ${cityName}?`,
      a: "Not automatically. Service depends on verified partner coverage at your exact address. The customer app confirms whether a visit can be fulfilled when you book.",
    },
    {
      q: "Do you employ the technicians?",
      a: "OorjaMan is a technology marketplace. Independent verified partners accept jobs, assign technicians, and complete visits under platform safety and evidence rules.",
    },
    {
      q: "Can I schedule recurring cleans?",
      a: "Yes - AMC plans include scheduled visit entitlements sized to your system capacity band. One-time visits are also available for catch-up cleans.",
    },
  ] as const;

export const dynamicParams = false;

export function generateStaticParams() {
  // Static export (`output: export`) errors if this returns []. Always emit slugs;
  // unpublished cities still 404 in the page / stay off nav and sitemap.
  return cityLandings.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const city = getPublishedCityLanding(slug);
  if (!city) return {};
  return buildPageMetadata({
    title: city.headline,
    description: `${city.intro.slice(0, 155)}…`,
    path: `/cities/${city.slug}`,
  });
}

export default async function CityPage({ params }: Props) {
  const { slug } = await params;
  const city = getPublishedCityLanding(slug);
  if (!city) notFound();

  const faqs = cityFaqs(city.name);

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

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  };

  return (
    <>
      <JsonLd data={[jsonLd, faqJsonLd]} />
      <MarketingPage
        title={city.headline}
        lead={`Solar panel cleaning and AMC in ${city.name}, ${city.state} - book when partner coverage is available at your address.`}
        eyebrow={`${city.name} · ${city.state}`}
        mediaSrc="/marketing/why-us-visit.jpg"
        wide
        cta={
          <>
            <Link href="/download" className="om-btn om-btn--primary">
              Get the app
            </Link>
            <Link href="/pricing" className="om-btn om-btn--ghost-light">
              Pricing
            </Link>
          </>
        }
      >
        <p className={styles.back}>
          <Link href="/cities">← All cities</Link>
        </p>

        <ScrollReveal>
          <p className={styles.intro}>{city.intro}</p>
        </ScrollReveal>

        <ScrollReveal className={styles.section}>
          <h2 className="om-h3">Good to know</h2>
          <ul className={styles.notes}>
            {city.localNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </ScrollReveal>

        <ScrollReveal className={styles.section}>
          <h2 className="om-h3">Common questions · {city.name}</h2>
          <ul className={styles.faqList}>
            {faqs.map((item, i) => (
              <ScrollReveal key={item.q} as="li" className={styles.faqItem} delayMs={i * 50}>
                <p className={styles.faqQ}>{item.q}</p>
                <p className={styles.faqA}>{item.a}</p>
              </ScrollReveal>
            ))}
          </ul>
        </ScrollReveal>

        <ScrollReveal className={styles.section}>
          <h2 className="om-h3">Explore next</h2>
          <div className={styles.related}>
            <Link href="/services/panel-cleaning" className="om-btn om-btn--outline">
              Panel cleaning
            </Link>
            <Link href="/services/amc-maintenance" className="om-btn om-btn--outline">
              AMC plans
            </Link>
            <Link href="/how-it-works" className="om-btn om-btn--outline">
              How it works
            </Link>
            <Link href="/pricing" className="om-btn om-btn--outline">
              Pricing
            </Link>
          </div>
        </ScrollReveal>

        <p className={styles.actions}>
          <Link href="/download" className="om-btn om-btn--primary">
            Get the app
          </Link>
          <Link href="/for-businesses" className="om-btn om-btn--outline">
            Multi-site / business
          </Link>
          <Link href="/contact" className="om-btn om-btn--outline">
            Contact
          </Link>
        </p>
      </MarketingPage>
    </>
  );
}
