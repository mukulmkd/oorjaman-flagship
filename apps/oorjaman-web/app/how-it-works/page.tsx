import Link from "next/link";
import { MarketingPage } from "@/components/MarketingPage";
import { ScrollReveal } from "@/components/ScrollReveal";
import { homeSteps } from "@/lib/home-content";
import { buildPageMetadata } from "@/lib/seo";
import styles from "./how-it-works.module.css";

export const metadata = buildPageMetadata({
  title: "How it works",
  description: "Book solar panel cleaning or AMC in clear steps with OorjaMan.",
  path: "/how-it-works",
});

export default function HowItWorksPage() {
  return (
    <MarketingPage
      title="How it works"
      lead="From site registration to a completed visit - structured, transparent, and trackable."
      mediaSrc="/marketing/handshake.jpg"
      mediaPosition="center 42%"
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
      <ol className={styles.steps}>
        {homeSteps.map((step, i) => (
          <ScrollReveal key={step.step} as="li" className={styles.step} delayMs={i * 60}>
            <span className={styles.index}>{step.step}</span>
            <div>
              <h2 className={styles.title}>{step.title}</h2>
              <p className={styles.body}>{step.body}</p>
            </div>
          </ScrollReveal>
        ))}
      </ol>

      <ScrollReveal className={styles.appCallout}>
        <h2 className={styles.appCalloutTitle}>What you see in the app</h2>
        <p className={styles.appCalloutBody}>
          After a partner accepts, you get visit status, booking codes for start, safety checklist confirmation, and
          before/after photo evidence - so the rooftop work stays accountable without chasing vendors on chat threads.
        </p>
        <Link href="/#why" className={styles.appCalloutLink}>
          See the home preview →
        </Link>
      </ScrollReveal>

      <ScrollReveal className={styles.note}>
        <p>
          Partners must accept within the platform acceptance window. Visits start with a booking code, safety
          checklist, and before/after photo evidence. See <Link href="/safety">safety</Link> and{" "}
          <Link href="/legal/service-disclaimers">service disclaimers</Link>.
        </p>
      </ScrollReveal>

      <p className={styles.actions}>
        <Link href="/download" className="om-btn om-btn--primary">
          Get the app
        </Link>
        <Link href="/pricing" className="om-btn om-btn--outline">
          Pricing
        </Link>
        <Link href="/safety" className="om-btn om-btn--outline">
          Safety
        </Link>
      </p>
    </MarketingPage>
  );
}
