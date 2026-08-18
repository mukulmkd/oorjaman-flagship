import Link from "next/link";
import { MarketingPage } from "@/components/MarketingPage";
import { ScrollReveal } from "@/components/ScrollReveal";
import { buildPageMetadata } from "@/lib/seo";
import styles from "./safety.module.css";

export const metadata = buildPageMetadata({
  title: "Safety & quality",
  description: "How OorjaMan partners follow safety checklists and warranty-conscious cleaning methods.",
  path: "/safety",
});

const visitChecks = [
  "Booking-code verification with the customer before work begins",
  "Mandatory safety checklist acknowledgement",
  "Job timer and status updates visible to the customer",
  "Before and after photo evidence uploaded to secure storage",
  "Live location sharing during active visits for customer visibility",
] as const;

const pillars = [
  {
    title: "Built into the apps",
    body: "Partners and technicians cannot casually skip codes, checklists, or evidence when closing a visit.",
  },
  {
    title: "Site readiness first",
    body: "Access and water notes are captured at registration so crews arrive prepared for your rooftop.",
  },
  {
    title: "Warranty-conscious methods",
    body: "Cleaning approaches aim to respect module OEM guidance - see service disclaimers for limits.",
  },
] as const;

export default function SafetyPage() {
  return (
    <MarketingPage
      title="Safety & quality"
      lead="Technicians complete safety acknowledgements, on-site checklists, and evidence capture before closing a visit."
      mediaSrc="/marketing/safety-visit.jpg"
      mediaPosition="center 35%"
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
          Rooftop solar work needs discipline: access, weather, water, and module care. OorjaMan builds those checks
          into the partner and technician apps so jobs do not start casually and do not close without proof.
        </p>
      </ScrollReveal>

      <div className={styles.grid}>
        {pillars.map((p, i) => (
          <ScrollReveal key={p.title} className={styles.card} delayMs={i * 55}>
            <h2 className={styles.cardTitle}>{p.title}</h2>
            <p className={styles.cardBody}>{p.body}</p>
          </ScrollReveal>
        ))}
      </div>

      <ScrollReveal className={styles.section}>
        <h2 className="om-h3">On every visit</h2>
        <ul className={styles.checkList}>
          {visitChecks.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </ScrollReveal>

      <ScrollReveal className={styles.section}>
        <h2 className="om-h3">Site readiness</h2>
        <p>
          Rooftop access and water availability are captured when you register a site so technicians arrive prepared.
          Methods aim to protect manufacturer warranties - follow OEM guidance for your modules and mounting.
        </p>
      </ScrollReveal>

      <p className={styles.actions}>
        <Link href="/download" className="om-btn om-btn--primary">
          Get the app
        </Link>
        <Link href="/how-it-works" className="om-btn om-btn--outline">
          How it works
        </Link>
        <Link href="/partners" className="om-btn om-btn--outline">
          Partner standards
        </Link>
        <Link href="/legal/service-disclaimers" className="om-btn om-btn--outline">
          Service disclaimers
        </Link>
      </p>
    </MarketingPage>
  );
}
