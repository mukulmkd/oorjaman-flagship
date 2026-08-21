import Image from "next/image";
import Link from "next/link";
import { MarketingPage } from "@/components/MarketingPage";
import { ScrollReveal } from "@/components/ScrollReveal";
import { FeatureCardGrid } from "@/components/marketing-sections";
import { buildPageMetadata } from "@/lib/seo";
import styles from "../service-detail.module.css";

export const metadata = buildPageMetadata({
  title: "Solar panel cleaning",
  description: "Professional one-time solar panel cleaning visits by system size with verified OorjaMan partners.",
  path: "/services/panel-cleaning",
});

const highlights = [
  {
    title: "Priced before you pay",
    body: "kW-band packages and geo-tier notes are shown in the app - no opaque rooftop quotes.",
    icon: "tag" as const,
  },
  {
    title: "Verified partners only",
    body: "Approved vendors accept the job, assign a technician, and work to platform safety rules.",
    icon: "shield" as const,
  },
  {
    title: "Evidence on close",
    body: "Booking-code start, checklist, and before/after photos so you know the visit happened.",
    icon: "camera" as const,
  },
] as const;

export default function PanelCleaningPage() {
  return (
    <MarketingPage
      title="Solar panel cleaning"
      lead="One-time visits sized to your kW band - cleaning, inspection, and photo evidence so you know the job was done right."
      mediaSrc="/marketing/story-panels.jpg"
      mediaPosition="center 38%"
      wide
      cta={
        <>
          <Link href="/download" className="om-btn om-btn--primary">
            Book now
          </Link>
          <Link href="/pricing" className="om-btn om-btn--ghost-light">
            View pricing
          </Link>
        </>
      }
    >
      <ScrollReveal>
        <p>
          Dust, pollen, bird droppings, and urban grime cut rooftop yield. OorjaMan is a technology marketplace: you
          book in the customer app, a verified partner fulfils the visit, and you track status through completion.
        </p>
      </ScrollReveal>

      <FeatureCardGrid items={highlights} />

      <ScrollReveal className={styles.visualStrip}>
        <Image
          src="/marketing/equipment-cleaning.jpg"
          alt=""
          fill
          sizes="(max-width: 900px) 100vw, 72rem"
          className={styles.visualStripImg}
        />
      </ScrollReveal>

      <ScrollReveal>
        <h2 className="om-h3">What you get</h2>
        <ul>
          <li>Package pricing by typical system capacity (kW bands)</li>
          <li>City-tier surcharges where your service address maps to a geo tier</li>
          <li>Per-panel reference pricing for transparency</li>
          <li>Before/after photo evidence and visit status in the app</li>
          <li>Safety checklist and booking-code verification before work starts</li>
        </ul>
      </ScrollReveal>

      <ScrollReveal>
        <h2 className="om-h3">How booking works</h2>
        <ol className={styles.steps}>
          <li>Register your site (capacity, roof access, water availability).</li>
          <li>Pick a slot and confirm the price shown in the app.</li>
          <li>A partner accepts within the acceptance window and assigns a technician.</li>
          <li>Track the visit live and review completion evidence.</li>
        </ol>
      </ScrollReveal>

      <ScrollReveal className={styles.note}>
        <p>
          Methods aim to protect manufacturer warranties - always follow your module OEM guidance. See{" "}
          <Link href="/legal/service-disclaimers">service disclaimers</Link> and <Link href="/safety">safety</Link>.
        </p>
      </ScrollReveal>
    </MarketingPage>
  );
}
