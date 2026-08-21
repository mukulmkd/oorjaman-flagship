import Link from "next/link";
import { MarketingPage } from "@/components/MarketingPage";
import { ScrollReveal } from "@/components/ScrollReveal";
import { FeatureCardGrid, SectionHead, StepRail } from "@/components/marketing-sections";
import { homeSteps } from "@/lib/home-content";
import { buildPageMetadata } from "@/lib/seo";
import styles from "./how-it-works.module.css";

export const metadata = buildPageMetadata({
  title: "How it works",
  description: "Book solar panel cleaning or AMC in clear steps with OorjaMan.",
  path: "/how-it-works",
});

const appFeatures = [
  {
    title: "Visit status",
    body: "See partner acceptance, en-route progress, and completion in one timeline.",
    icon: "pin" as const,
  },
  {
    title: "Booking codes",
    body: "Visits start with a code shared with your technician so work stays verified.",
    icon: "check" as const,
  },
  {
    title: "Photo evidence",
    body: "Before/after images and safety checklist confirmation when the visit closes.",
    icon: "camera" as const,
  },
] as const;

export default function HowItWorksPage() {
  return (
    <MarketingPage
      title="How it works"
      lead="From site registration to a completed visit — structured, transparent, and trackable."
      mediaSrc="/marketing/handshake.jpg"
      mediaPosition="center 42%"
      wide
      cta={
        <>
          <Link href="/download" className="om-btn om-btn--primary">
            Book now
          </Link>
          <Link href="/pricing" className="om-btn om-btn--ghost-light">
            Pricing
          </Link>
        </>
      }
    >
      <ScrollReveal>
        <SectionHead
          eyebrow="Four steps"
          title="From book to evidence"
          lead="The same journey you see on the homepage — with more detail on what happens in the app."
        />
      </ScrollReveal>
      <StepRail steps={homeSteps} />

      <ScrollReveal className={styles.appCallout}>
        <SectionHead
          eyebrow="In the app"
          title="What you see during a visit"
          lead="After a partner accepts, status, codes, and evidence stay in one place — without chasing vendors on chat."
        />
        <FeatureCardGrid items={appFeatures} />
      </ScrollReveal>

      <ScrollReveal className={styles.note}>
        <p>
          Partners must accept within the platform acceptance window. Visits start with a booking code, safety
          checklist, and before/after photo evidence. See <Link href="/safety">safety</Link> and{" "}
          <Link href="/legal/service-disclaimers">service disclaimers</Link>.
        </p>
      </ScrollReveal>
    </MarketingPage>
  );
}
