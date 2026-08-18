import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketingPage } from "@/components/MarketingPage";
import { ScrollReveal } from "@/components/ScrollReveal";
import { publishedCityLandings } from "@/lib/cities";
import { showCityCoverage } from "@/lib/launch-flags";
import { buildPageMetadata } from "@/lib/seo";
import styles from "./cities.module.css";

export const metadata = buildPageMetadata({
  title: "Solar panel cleaning by city",
  description: "Book OorjaMan solar rooftop cleaning and AMC in major Indian cities.",
  path: "/cities",
  noIndex: !showCityCoverage,
});

export default function CitiesIndexPage() {
  if (!showCityCoverage) notFound();

  return (
    <MarketingPage
      title="Cities we are expanding into"
      lead="Local landing pages for solar panel cleaning and annual maintenance. Availability depends on verified partner coverage at your address - confirm in the app when you book."
      mediaSrc="/marketing/hero-rooftop.jpg"
      wide
      cta={
        <>
          <Link href="/download" className="om-btn om-btn--primary">
            Get the app
          </Link>
          <Link href="/contact" className="om-btn om-btn--ghost-light">
            Contact support
          </Link>
        </>
      }
    >
      <ul className={styles.grid}>
        {publishedCityLandings().map((city, i) => (
          <ScrollReveal key={city.slug} as="li" delayMs={(i % 4) * 40}>
            <Link href={`/cities/${city.slug}`} className={styles.card}>
              <span className={styles.cardMedia} aria-hidden />
              <span className={styles.cardBody}>
                <span className={styles.name}>{city.name}</span>
                <span className={styles.state}>{city.state}</span>
              </span>
            </Link>
          </ScrollReveal>
        ))}
      </ul>
      <p className={styles.note}>
        Looking for another metro? Coverage grows with verified partners.{" "}
        <Link href="/contact">Contact support</Link> or{" "}
        <Link href="/download">check availability in the app</Link>.
      </p>
    </MarketingPage>
  );
}
