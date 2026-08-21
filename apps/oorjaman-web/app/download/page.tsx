import Link from "next/link";
import { MarketingPage } from "@/components/MarketingPage";
import { FeatureCardGrid, SectionHead } from "@/components/marketing-sections";
import { ScrollReveal } from "@/components/ScrollReveal";
import { getAppScreenshotSlots } from "@/lib/marketing-media";
import { buildPageMetadata } from "@/lib/seo";
import { APP_LINKS, SUPPORT_EMAIL, customerStoreListingsLive } from "@/lib/site";
import Image from "next/image";
import styles from "./download.module.css";

export const metadata = buildPageMetadata({
  title: "Download the OorjaMan app",
  description: "Get the OorjaMan customer app on iOS and Android to book solar panel cleaning and AMC.",
  path: "/download",
});

const featureLines = [
  {
    title: "Book",
    body: "One-time cleans or AMC plans with prices shown before you pay.",
    icon: "check" as const,
  },
  {
    title: "Track",
    body: "Partner acceptance, en-route status, and visit codes in one timeline.",
    icon: "pin" as const,
  },
  {
    title: "Evidence",
    body: "Safety checklist and before/after photos when the visit closes.",
    icon: "camera" as const,
  },
] as const;

export default function DownloadPage() {
  const storesLive = customerStoreListingsLive();
  const shots = getAppScreenshotSlots();
  const hasShots = Boolean(shots.booking || shots.tracking || shots.evidence);

  return (
    <MarketingPage
      title={storesLive ? "Download the OorjaMan app" : "Get the OorjaMan app"}
      lead="Book cleaning visits, manage AMC plans, track technicians, and reach support — all from the customer app."
      eyebrow="Customer app"
      mediaSrc="/marketing/hero-rooftop.jpg"
      mediaPosition="center 30%"
      wide
      closingCta={false}
      cta={
        storesLive ? (
          <>
            <a href={APP_LINKS.customerIos} className="om-btn om-btn--primary" rel="noopener noreferrer">
              App Store
            </a>
            <a href={APP_LINKS.customerAndroid} className="om-btn om-btn--ghost-light" rel="noopener noreferrer">
              Google Play
            </a>
          </>
        ) : (
          <>
            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Notify me when the OorjaMan app launches")}`}
              className="om-btn om-btn--primary"
            >
              Notify me
            </a>
            <Link href="/pricing" className="om-btn om-btn--ghost-light">
              View pricing
            </Link>
          </>
        )
      }
    >
      {!storesLive ? (
        <ScrollReveal className={styles.waitlistNote}>
          <p>
            Store listings are preparing for launch. Email{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> with your city and whether you need home or business
            care — we will notify you when downloads are live.
          </p>
        </ScrollReveal>
      ) : (
        <ScrollReveal className={styles.waitlistNote}>
          <p>
            Already installed? Open <code>{APP_LINKS.customerScheme}</code>
          </p>
        </ScrollReveal>
      )}

      <ScrollReveal>
        <SectionHead
          eyebrow="In the app"
          title="Book, track, and close with evidence"
          lead="The same visit journey you see on the website — designed for rooftop care on the go."
        />
      </ScrollReveal>

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
        <FeatureCardGrid items={featureLines} />
      )}

      <p className={styles.legal}>
        <Link href="/how-it-works">How it works</Link> · <Link href="/pricing">Pricing</Link> ·{" "}
        <Link href="/legal/privacy-policy">Privacy</Link> · <Link href="/legal/terms-of-service">Terms</Link>
      </p>
    </MarketingPage>
  );
}
