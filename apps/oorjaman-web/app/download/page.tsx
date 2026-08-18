import Image from "next/image";
import Link from "next/link";
import { BRAND_TAGLINE } from "@oorjaman/config";
import { BrandWordmark } from "@/components/BrandWordmark";
import { ScrollReveal } from "@/components/ScrollReveal";
import { getAppScreenshotSlots } from "@/lib/marketing-media";
import { buildPageMetadata } from "@/lib/seo";
import { APP_LINKS, SUPPORT_EMAIL, customerStoreListingsLive } from "@/lib/site";
import styles from "./download.module.css";

export const metadata = buildPageMetadata({
  title: "Download the OorjaMan app",
  description: "Get the OorjaMan customer app on iOS and Android to book solar panel cleaning and AMC.",
  path: "/download",
});

const featureLines = [
  { title: "Book", body: "One-time cleans or AMC plans with prices shown before you pay." },
  { title: "Track", body: "Partner acceptance, en-route status, and visit codes in one timeline." },
  { title: "Evidence", body: "Safety checklist and before/after photos when the visit closes." },
] as const;

export default function DownloadPage() {
  const storesLive = customerStoreListingsLive();
  const shots = getAppScreenshotSlots();
  const hasShots = Boolean(shots.booking || shots.tracking || shots.evidence);

  return (
    <div className={styles.page}>
      <div className={styles.atmosphere} aria-hidden>
        <Image
          src="/marketing/hero-rooftop.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className={styles.atmosphereImg}
        />
        <div className={styles.atmosphereScrim} />
      </div>

      <div className={`om-container ${styles.inner}`}>
        <div className={styles.brand}>
          <Image
            src="/logo-icon.png"
            alt=""
            width={96}
            height={96}
            className={styles.icon}
            priority
          />
          <BrandWordmark size="splash" tone="onDark" />
          <p className={styles.tagline}>{BRAND_TAGLINE}</p>
        </div>
        <h1 className={`om-h1 ${styles.titleOnMedia}`}>
          {storesLive ? "Download OorjaMan" : "Get OorjaMan"}
        </h1>
        <p className={`om-lead ${styles.leadOnMedia}`}>
          Book cleaning visits, manage AMC plans, track technicians, and chat with support - all from the customer
          app.
        </p>

        {storesLive ? (
          <>
            <div className={styles.actions}>
              <a href={APP_LINKS.customerIos} className="om-btn om-btn--primary" rel="noopener noreferrer">
                App Store (iOS)
              </a>
              <a href={APP_LINKS.customerAndroid} className="om-btn om-btn--ghost-light" rel="noopener noreferrer">
                Google Play (Android)
              </a>
            </div>
            <p className={styles.noteOnMedia}>
              Already installed? Open <code>{APP_LINKS.customerScheme}</code>
            </p>
          </>
        ) : (
          <>
            <div className={styles.waitlist}>
              <p className={styles.waitlistLead}>
                The customer app is preparing for App Store and Google Play. Leave your details with support and we
                will notify you when downloads are available.
              </p>
              <a
                href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Notify me when the OorjaMan app launches")}`}
                className="om-btn om-btn--primary"
              >
                Notify me at {SUPPORT_EMAIL}
              </a>
            </div>
            <p className={styles.noteOnMedia}>
              Prefer email? Write to <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> with your city and whether
              you need home or business care.
            </p>
          </>
        )}
      </div>

      <div className={styles.featuresWrap}>
        <div className={`om-container ${styles.featuresInner}`}>
          {hasShots ? (
            <div className={styles.shotGrid}>
              {(
                [
                  ["booking", shots.booking, "Book"],
                  ["tracking", shots.tracking, "Track"],
                  ["evidence", shots.evidence, "Evidence"],
                ] as const
              ).map(([key, src, label], i) =>
                src ? (
                  <ScrollReveal key={key} className={styles.shotCard} delayMs={i * 60}>
                    <div className={styles.shotFrame}>
                      <Image src={src} alt="" fill sizes="(max-width: 700px) 40vw, 12rem" className={styles.shotImg} />
                    </div>
                    <p className={styles.shotLabel}>{label}</p>
                  </ScrollReveal>
                ) : null,
              )}
            </div>
          ) : (
            <ul className={styles.featureList}>
              {featureLines.map((f, i) => (
                <ScrollReveal key={f.title} as="li" className={styles.featureCard} delayMs={i * 60}>
                  <h2 className={styles.featureTitle}>{f.title}</h2>
                  <p className={styles.featureBody}>{f.body}</p>
                </ScrollReveal>
              ))}
            </ul>
          )}

          <p className={styles.legal}>
            <Link href="/how-it-works">How it works</Link> · <Link href="/pricing">Pricing</Link> ·{" "}
            <Link href="/legal/privacy-policy">Privacy</Link> · <Link href="/legal/terms-of-service">Terms</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
