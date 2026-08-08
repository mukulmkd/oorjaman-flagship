import Image from "next/image";
import Link from "next/link";
import { BRAND_TAGLINE } from "@oorjaman/config";
import { JsonLd } from "@/components/JsonLd";
import { BrandWordmark } from "@/components/BrandWordmark";
import { cityLandings } from "@/lib/cities";
import { faqPageJsonLd } from "@/lib/faq";
import { homeMetadata } from "@/lib/seo";
import { customerStoreListingsLive } from "@/lib/site";
import styles from "@/components/home.module.css";

export const metadata = homeMetadata;

const proof = [
  { value: "App", label: "Book cleaning & AMC from your phone" },
  { value: "AMC", label: "Recurring plans alongside one-time visits" },
  { value: "1 hr", label: "Partner acceptance window on new bookings" },
  { value: "Live", label: "Visit tracking while a job is active" },
];

const services = [
  {
    href: "/services/panel-cleaning",
    index: "01",
    title: "Panel cleaning",
    body: "One-time rooftop visits sized to your system capacity — clear pricing before you pay.",
  },
  {
    href: "/services/amc-maintenance",
    index: "02",
    title: "AMC maintenance",
    body: "Annual plans with scheduled visits so yield stays steady through dust and seasons.",
  },
  {
    href: "/partners",
    index: "03",
    title: "Partner network",
    body: "Verified vendors and technicians trained for safe solar O&M — grow with the platform.",
  },
];

export default function HomePage() {
  const storesLive = customerStoreListingsLive();
  const primaryCta = storesLive ? "Download the app" : "Get notified";

  return (
    <>
      <JsonLd data={faqPageJsonLd()} />

      <section className={styles.hero} aria-label="OorjaMan">
        <div className={styles.heroGlow} aria-hidden />
        <div className={`om-container ${styles.heroInner}`}>
          <p className={`${styles.brandLine} om-rise`}>
            <BrandWordmark size="hero" tone="onDark" />
          </p>
          <h1 className={`${styles.headline} om-rise om-rise-delay-1`}>
            Comprehensive solar care
            <span className={styles.headlineBreak}> for every rooftop</span>
          </h1>
          <p className={`${styles.support} om-rise om-rise-delay-2`}>
            Professional panel cleaning and AMC — booked in minutes, fulfilled by verified partners, tracked in real
            time.
          </p>
          <p className={`${styles.ctas} om-rise om-rise-delay-3`}>
            <Link href="/download" className="om-btn om-btn--primary">
              {primaryCta}
            </Link>
            <Link href="/how-it-works" className="om-btn om-btn--ghost-light">
              How it works
            </Link>
          </p>
        </div>
      </section>

      <section className={styles.proof} aria-label="OorjaMan at a glance">
        <div className={`om-container ${styles.proofGrid}`}>
          {proof.map((item) => (
            <div key={item.label} className={styles.proofItem}>
              <p className={styles.proofValue}>{item.value}</p>
              <p className={styles.proofLabel}>{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.mission}>
        <div className={`om-container ${styles.missionInner}`}>
          <Image
            src="/logo-icon.png"
            alt=""
            width={64}
            height={64}
            className={styles.missionIcon}
          />
          <p className={styles.missionTagline}>{BRAND_TAGLINE}</p>
          <h2 className={styles.missionTitle}>Solar care that stays out of your way</h2>
          <p className={styles.missionBody}>
            OorjaMan is built for homeowners and businesses who want reliable rooftop output without chasing vendors.
            Book once, track the visit, keep every kilowatt-hour counting.
          </p>
          <Link href="/about" className="om-btn om-btn--outline">
            Get to know us
          </Link>
        </div>
      </section>

      <section className="om-section">
        <div className="om-container">
          <div className={styles.sectionHead}>
            <p className="om-eyebrow">Why OorjaMan</p>
            <h2 className="om-h2">Clean panels. Clear pricing. Real visits.</h2>
          </div>
          <div className={styles.featureList}>
            <div className={styles.featureItem}>
              <h3>Verified partners</h3>
              <p>Vetted vendors and technicians trained for safe rooftop solar work.</p>
            </div>
            <div className={styles.featureItem}>
              <h3>Transparent pricing</h3>
              <p>Package prices by kW band plus city-tier surcharges — shown before you pay.</p>
            </div>
            <div className={styles.featureItem}>
              <h3>Track every visit</h3>
              <p>Booking status, technician progress, and completion evidence in one place.</p>
            </div>
          </div>
        </div>
      </section>

      <section className={`om-section om-section--alt ${styles.services}`}>
        <div className="om-container">
          <div className={styles.sectionHead}>
            <p className="om-eyebrow">Services</p>
            <h2 className="om-h2">Solutions tailored to each rooftop</h2>
            <p className={styles.sectionLead}>
              Innovation, efficiency, and reliability — without the clutter. Start with a visit or an annual plan.
            </p>
          </div>
          <div className={styles.serviceRows}>
            {services.map((service) => (
              <Link key={service.href} href={service.href} className={styles.serviceRow}>
                <span className={styles.serviceIndex}>{service.index}</span>
                <span className={styles.serviceCopy}>
                  <span className={styles.serviceTitle}>{service.title}</span>
                  <span className={styles.serviceBody}>{service.body}</span>
                </span>
                <span className={styles.serviceArrow} aria-hidden>
                  →
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.cities}>
        <div className="om-container">
          <div className={styles.sectionHead}>
            <p className="om-eyebrow">Coverage</p>
            <h2 className="om-h2">Cities we are expanding into</h2>
            <p className={styles.sectionLead}>
              Local pages for major metros. Service availability depends on verified partner coverage at your address —
              confirm in the app when you book.
            </p>
          </div>
          <ul className={styles.cityList}>
            {cityLandings.map((city) => (
              <li key={city.slug}>
                <Link href={`/cities/${city.slug}`} className={styles.cityLink}>
                  <span className={styles.cityName}>{city.name}</span>
                  <span className={styles.cityState}>{city.state}</span>
                </Link>
              </li>
            ))}
          </ul>
          <p className={styles.citiesMore}>
            <Link href="/cities">View all cities</Link>
          </p>
        </div>
      </section>

      <section className={styles.ctaBand}>
        <div className="om-container">
          <h2 className="om-h2">Ready to book?</h2>
          <p className={styles.ctaLead}>
            Install the OorjaMan customer app on iOS or Android and book your first visit.
          </p>
          <Link href="/download" className="om-btn om-btn--primary">
            {storesLive ? "Get the app" : "Get notified"}
          </Link>
        </div>
      </section>
    </>
  );
}
