import Image from "next/image";
import Link from "next/link";
import { BRAND_TAGLINE } from "@oorjaman/config";
import { HomeHero } from "@/components/HomeHero";
import { JsonLd } from "@/components/JsonLd";
import { ScrollReveal } from "@/components/ScrollReveal";
import { WhyUsStage } from "@/components/WhyUsStage";
import { publishedCityLandings } from "@/lib/cities";
import { faqPageJsonLd } from "@/lib/faq";
import {
  audienceCards,
  homeServices,
  homeSteps,
  proofItems,
  publishedHomeTestimonials,
  showHomeTestimonials,
  whyFeatures,
} from "@/lib/home-content";
import { showAppScreenshots, showCityCoverage, showVisitStories } from "@/lib/launch-flags";
import { getMarketingMedia } from "@/lib/marketing-media";
import { homeMetadata } from "@/lib/seo";
import { customerStoreListingsLive, SUPPORT_PHONE, SUPPORT_PHONE_TEL } from "@/lib/site";
import { visitStories } from "@/lib/visit-stories";
import styles from "@/components/home.module.css";

export const metadata = homeMetadata;

export default function HomePage() {
  const storesLive = customerStoreListingsLive();
  const primaryCta = storesLive ? "Download the app" : "Get notified";
  const media = getMarketingMedia();

  return (
    <>
      <JsonLd data={faqPageJsonLd()} />

      <HomeHero
        primaryCtaLabel={primaryCta}
        photoSrc={media.heroPhoto}
        videoSrc={media.heroVideo}
      />

      <section className={styles.proof} aria-label="OorjaMan at a glance">
        <div className={`om-container ${styles.proofGrid}`}>
          {proofItems.map((item, i) => (
            <ScrollReveal key={item.label} className={styles.proofItem} delayMs={i * 60}>
              <p className={styles.proofValue}>{item.value}</p>
              <p className={styles.proofLabel}>{item.label}</p>
            </ScrollReveal>
          ))}
        </div>
      </section>

      <section className={styles.mission}>
        <ScrollReveal className={`om-container ${styles.missionInner}`}>
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
            OorjaMan is a technology marketplace for homeowners and businesses who want reliable rooftop output
            without chasing vendors. Book once, track the visit, keep every kilowatt-hour counting - fulfilled by
            independent verified partners.
          </p>
          <Link href="/about" className="om-btn om-btn--outline">
            Get to know us
          </Link>
        </ScrollReveal>
      </section>

      <section id="why" className={`om-section ${styles.why}`}>
        <div className={`om-container ${styles.whyGrid}${showAppScreenshots ? "" : ` ${styles.whyGridCopyOnly}`}`}>
          <ScrollReveal className={showAppScreenshots ? styles.whyCopy : styles.whyCopyExpanded}>
            <p className="om-eyebrow">Why OorjaMan</p>
            <h2 className="om-h2">Clean panels. Clear pricing. Real visits.</h2>
            <p className={styles.sectionLead}>
              Maximum power starts with less dust - and a platform that keeps partners accountable from accept to
              evidence
              {showAppScreenshots
                ? ". The preview shows how a visit looks in the customer app while work is underway."
                : "."}
            </p>
            <ul className={showAppScreenshots ? styles.whyList : `${styles.whyList} ${styles.whyListExpanded}`}>
              {whyFeatures.map((f) => (
                <li key={f.title}>
                  <h3>{f.title}</h3>
                  <p>{f.body}</p>
                </li>
              ))}
            </ul>
            <p className={styles.whyCtas}>
              <Link href="/safety" className="om-btn om-btn--outline">
                Safety &amp; quality
              </Link>
              <Link href="/pricing" className="om-btn om-btn--primary">
                View pricing
              </Link>
            </p>
          </ScrollReveal>
          {showAppScreenshots ? (
            <ScrollReveal className={styles.whyVisual} delayMs={120}>
              <WhyUsStage photoSrc={media.whyUsPhoto} videoSrc={media.whyUsVideo} />
            </ScrollReveal>
          ) : null}
        </div>
      </section>

      <section className={`om-section om-section--alt ${styles.steps}`}>
        <div className="om-container">
          <ScrollReveal className={styles.sectionHead}>
            <p className="om-eyebrow">How it works</p>
            <h2 className="om-h2">From site to completed visit</h2>
            <p className={styles.sectionLead}>
              Four clear steps in the customer app - transparent, trackable, and partner-fulfilled.
            </p>
          </ScrollReveal>
          <ol className={styles.stepGrid}>
            {homeSteps.map((step, i) => (
              <ScrollReveal key={step.step} as="li" className={styles.stepCard} delayMs={i * 70}>
                <span className={styles.stepIndex}>{step.step}</span>
                <h3 className={styles.stepTitle}>{step.title}</h3>
                <p className={styles.stepBody}>{step.body}</p>
              </ScrollReveal>
            ))}
          </ol>
          <ScrollReveal className={styles.stepsMore}>
            <Link href="/how-it-works">Full how it works →</Link>
          </ScrollReveal>
        </div>
      </section>

      <section className={`om-section ${styles.services}`}>
        <div className="om-container">
          <ScrollReveal className={styles.sectionHead}>
            <p className="om-eyebrow">Services</p>
            <h2 className="om-h2">Cleaning, AMC, and partners</h2>
            <p className={styles.sectionLead}>
              Book one-time visits or annual plans - fulfilled by verified partners on the OorjaMan marketplace.
            </p>
          </ScrollReveal>
          <div className={styles.serviceList}>
            {homeServices.map((svc, i) => (
              <ScrollReveal key={svc.href} delayMs={i * 60}>
                <Link href={svc.href} className={styles.serviceRow}>
                  <span className={styles.serviceIndex}>{svc.index}</span>
                  <span className={styles.serviceCopy}>
                    <span className={styles.serviceTitle}>{svc.title}</span>
                    <span className={styles.serviceBody}>{svc.body}</span>
                  </span>
                  <span className={styles.serviceArrow} aria-hidden>
                    →
                  </span>
                </Link>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {showVisitStories ? (
      <section className={styles.stories} aria-label="Visit stories">
        <div className="om-container">
          <ScrollReveal className={styles.sectionHead}>
            <p className="om-eyebrow">Visit stories</p>
            <h2 className="om-h2">How a visit comes together</h2>
            <p className={styles.sectionLead}>
              Illustrative journeys through the marketplace - real published case studies will follow when we have
              permissioned photos and customer stories.
            </p>
          </ScrollReveal>
          <div className={styles.storyGrid}>
            {visitStories.map((story, i) => (
              <ScrollReveal key={story.slug} as="article" className={styles.storyCard} delayMs={i * 70}>
                {story.image ? (
                  <div className={styles.storyMedia}>
                    <Image
                      src={story.image}
                      alt=""
                      fill
                      sizes="(max-width: 700px) 100vw, 33vw"
                      className={styles.storyMediaImg}
                    />
                  </div>
                ) : null}
                <p className={styles.storySegment}>{story.segment}</p>
                <h3 className={styles.storyTitle}>{story.title}</h3>
                <p className={styles.storySummary}>{story.summary}</p>
                <Link href={`/stories/${story.slug}`} className={styles.storyLink}>
                  Read journey →
                </Link>
              </ScrollReveal>
            ))}
          </div>
          <ScrollReveal className={styles.storiesMore}>
            <Link href="/stories">View all visit stories</Link>
          </ScrollReveal>
        </div>
      </section>
      ) : null}

      {showHomeTestimonials ? (
        <section className={styles.testimonials} aria-label="Customer stories">
          <div className="om-container">
            <ScrollReveal className={styles.sectionHead}>
              <p className="om-eyebrow">From the field</p>
              <h2 className="om-h2">What customers say</h2>
            </ScrollReveal>
            <div className={styles.testimonialGrid}>
              {publishedHomeTestimonials.map((t, i) => (
                <ScrollReveal key={t.name} as="article" className={styles.testimonialCard} delayMs={i * 70}>
                  <blockquote className={styles.testimonialQuote}>{t.quote}</blockquote>
                  <p className={styles.testimonialName}>{t.name}</p>
                  <p className={styles.testimonialRole}>{t.role}</p>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className={styles.audiences} aria-label="Who OorjaMan is for">
        <div className="om-container">
          <ScrollReveal className={styles.sectionHead}>
            <p className="om-eyebrow">Who it is for</p>
            <h2 className="om-h2">One platform. Three journeys.</h2>
            <p className={styles.sectionLead}>
              Whether you own a rooftop, manage many sites, or run a cleaning crew - OorjaMan connects the right
              people with clear workflows.
            </p>
          </ScrollReveal>
          <div className={styles.audienceGrid}>
            {audienceCards.map((card, i) => (
              <ScrollReveal key={card.href} as="article" className={styles.audienceCard} delayMs={i * 70}>
                <h3 className={styles.audienceTitle}>{card.title}</h3>
                <p className={styles.audienceBody}>{card.body}</p>
                <Link href={card.href} className={styles.audienceLink}>
                  {card.cta} →
                </Link>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {showCityCoverage ? (
      <section className={styles.cities} aria-label="Coverage">
        <div className="om-container">
          <ScrollReveal className={styles.sectionHead}>
            <p className="om-eyebrow">Coverage</p>
            <h2 className="om-h2">Cities we are expanding into</h2>
            <p className={styles.sectionLead}>
              Local pages for major metros. Service availability depends on verified partner coverage at your address -
              confirm in the app when you book.
            </p>
          </ScrollReveal>
          <ul className={styles.cityList}>
            {publishedCityLandings().map((city, i) => (
              <ScrollReveal key={city.slug} as="li" delayMs={(i % 3) * 40}>
                <Link href={`/cities/${city.slug}`} className={styles.cityLink}>
                  <span className={styles.cityName}>{city.name}</span>
                  <span className={styles.cityState}>{city.state}</span>
                </Link>
              </ScrollReveal>
            ))}
          </ul>
          <ScrollReveal className={styles.citiesMore}>
            <Link href="/cities">View all cities</Link>
          </ScrollReveal>
        </div>
      </section>
      ) : null}

      <section className={styles.ctaBand}>
        <ScrollReveal className="om-container">
          <h2 className="om-h2">Ready to book?</h2>
          <p className={styles.ctaLead}>
            Install the OorjaMan customer app on iOS or Android and book your first visit with a verified partner. Or
            call support at{" "}
            <a className={styles.ctaPhone} href={`tel:${SUPPORT_PHONE_TEL}`}>
              {SUPPORT_PHONE}
            </a>
            .
          </p>
          <div className={styles.ctaRow}>
            <Link href="/download" className="om-btn om-btn--primary">
              {storesLive ? "Get the app" : "Get notified"}
            </Link>
            <a href={`tel:${SUPPORT_PHONE_TEL}`} className="om-btn om-btn--ghost-light">
              Call support
            </a>
            <Link href="/contact" className="om-btn om-btn--ghost-light">
              Contact
            </Link>
          </div>
        </ScrollReveal>
      </section>
    </>
  );
}
