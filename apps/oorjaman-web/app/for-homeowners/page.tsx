import Link from "next/link";
import { MarketingPage } from "@/components/MarketingPage";
import { ScrollReveal } from "@/components/ScrollReveal";
import { buildPageMetadata } from "@/lib/seo";
import { SUPPORT_EMAIL } from "@/lib/site";
import styles from "@/components/audience-page.module.css";

export const metadata = buildPageMetadata({
  title: "For homeowners",
  description: "Residential solar panel cleaning and AMC for Indian homeowners.",
  path: "/for-homeowners",
});

const points = [
  {
    title: "Register once",
    body: "Add capacity, photos, access notes, and water availability so partners arrive prepared.",
  },
  {
    title: "Price before pay",
    body: "kW-band packages and any city-tier add-ons are shown in the app before checkout.",
  },
  {
    title: "Track the visit",
    body: "Follow acceptance, en-route status, codes, and before/after evidence without chasing crews.",
  },
  {
    title: "Support when needed",
    body: `In-app chat plus ${SUPPORT_EMAIL} for bookings, payments, and escalations.`,
  },
] as const;

export default function ForHomeownersPage() {
  return (
    <MarketingPage
      title="For homeowners"
      lead="Protect your residential yield with professional cleaning and preventive care - without climbing the roof yourself."
      mediaSrc="/marketing/residential-visit.jpg"
      mediaPosition="center 40%"
      wide
      cta={
        <>
          <Link href="/download" className="om-btn om-btn--primary">
            Get the app
          </Link>
          <Link href="/how-it-works" className="om-btn om-btn--ghost-light">
            How it works
          </Link>
        </>
      }
    >
      <ScrollReveal>
        <p className={styles.leadExtra}>
          OorjaMan is a technology marketplace: you book in the customer app, a verified partner fulfils the visit, and
          you keep a clear record of what happened on your rooftop.
        </p>
      </ScrollReveal>

      <div className={styles.grid}>
        {points.map((p, i) => (
          <ScrollReveal key={p.title} className={styles.card} delayMs={i * 50}>
            <h2 className={styles.cardTitle}>{p.title}</h2>
            <p className={styles.cardBody}>{p.body}</p>
          </ScrollReveal>
        ))}
      </div>

      <p className={styles.actions}>
        <Link href="/download" className="om-btn om-btn--primary">
          Get the app
        </Link>
        <Link href="/pricing" className="om-btn om-btn--outline">
          See pricing
        </Link>
        <Link href="/how-it-works" className="om-btn om-btn--outline">
          How it works
        </Link>
      </p>
    </MarketingPage>
  );
}
