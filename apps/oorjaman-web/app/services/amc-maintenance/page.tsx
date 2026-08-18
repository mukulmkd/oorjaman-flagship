import Image from "next/image";
import Link from "next/link";
import { MarketingPage } from "@/components/MarketingPage";
import { ScrollReveal } from "@/components/ScrollReveal";
import { buildPageMetadata } from "@/lib/seo";
import styles from "../service-detail.module.css";

export const metadata = buildPageMetadata({
  title: "Solar AMC maintenance plans",
  description: "Annual maintenance contracts for solar rooftops with scheduled visits per kW band.",
  path: "/services/amc-maintenance",
});

const highlights = [
  {
    title: "Calendar, not crisis",
    body: "Scheduled visits reduce waiting until output drops visibly after a long dry spell.",
  },
  {
    title: "Entitlements in-app",
    body: "See visit allowances, upcoming slots, and plan status without chasing vendors.",
  },
  {
    title: "Same safety bar",
    body: "AMC visits use the same checklist, codes, and photo evidence as one-time cleans.",
  },
] as const;

export default function AmcMaintenancePage() {
  return (
    <MarketingPage
      title="AMC maintenance"
      lead="Stay ahead of dust and debris with annual contracts - scheduled visits, visit allowances, and renewal nudges in the app."
      mediaSrc="/marketing/service-amc.jpg"
      mediaPosition="center 42%"
      wide
      cta={
        <>
          <Link href="/download" className="om-btn om-btn--primary">
            Get the app
          </Link>
          <Link href="/pricing" className="om-btn om-btn--ghost-light">
            View pricing
          </Link>
        </>
      }
    >
      <ScrollReveal>
        <p>
          An AMC (annual maintenance contract) keeps cleaning on a calendar. You choose a plan sized to rooftop
          capacity; OorjaMan generates upcoming visits and connects verified partners to fulfil them.
        </p>
      </ScrollReveal>

      <div className={styles.highlightGrid}>
        {highlights.map((h, i) => (
          <ScrollReveal key={h.title} className={styles.highlightCard} delayMs={i * 60}>
            <h2 className={styles.highlightTitle}>{h.title}</h2>
            <p className={styles.highlightBody}>{h.body}</p>
          </ScrollReveal>
        ))}
      </div>

      <ScrollReveal className={styles.visualStrip}>
        <Image
          src="/marketing/crew-cleaning.jpg"
          alt=""
          fill
          sizes="(max-width: 900px) 100vw, 72rem"
          className={styles.visualStripImg}
        />
      </ScrollReveal>

      <ScrollReveal>
        <h2 className="om-h3">Plan highlights</h2>
        <ul>
          <li>12- and 24-month contracts by system band (see /pricing)</li>
          <li>Visit entitlements per plan code (shown at purchase)</li>
          <li>Stacked with geo-tier AMC surcharges where applicable</li>
          <li>Pause, resume, or cancel according to the terms shown in-app</li>
          <li>Same safety checklist and evidence capture as one-time visits</li>
        </ul>
      </ScrollReveal>

      <ScrollReveal className={styles.note}>
        <p>
          Refund and pause rules are in our{" "}
          <Link href="/legal/refund-cancellation">Refund &amp; Cancellation Policy</Link>.
        </p>
      </ScrollReveal>

      <ScrollReveal className={styles.ctaBand}>
        <h2 className={styles.ctaBandTitle}>Prefer a scheduled rhythm?</h2>
        <p className={styles.ctaBandLead}>
          Compare plans in the app or read how a society AMC journey comes together.
        </p>
        <p className={styles.actions}>
          <Link href="/download" className="om-btn om-btn--primary">
            Get the app
          </Link>
          <Link href="/pricing" className="om-btn om-btn--outline">
            View pricing
          </Link>
          <Link href="/services/panel-cleaning" className="om-btn om-btn--outline">
            One-time visits
          </Link>
        </p>
      </ScrollReveal>
    </MarketingPage>
  );
}
