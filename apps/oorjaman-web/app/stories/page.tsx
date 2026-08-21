import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketingPage } from "@/components/MarketingPage";
import { ScrollReveal } from "@/components/ScrollReveal";
import { showVisitStories } from "@/lib/launch-flags";
import { buildPageMetadata } from "@/lib/seo";
import { visitStories } from "@/lib/visit-stories";
import styles from "./stories.module.css";

export const metadata = buildPageMetadata({
  title: "Visit stories",
  description:
    "How OorjaMan visits work for homeowners, societies, and businesses - illustrative platform journeys.",
  path: "/stories",
  noIndex: !showVisitStories,
});

export default function StoriesPage() {
  if (!showVisitStories) notFound();
  return (
    <MarketingPage
      title="Visit stories"
      lead="Illustrative journeys through the OorjaMan marketplace - how booking, partner fulfilment, and evidence come together. Real customer case studies will replace these when we have permission to publish."
      mediaSrc="/marketing/story-panels.jpg"
      wide
      cta={
        <>
          <Link href="/download" className="om-btn om-btn--primary">
            Book now
          </Link>
          <Link href="/how-it-works" className="om-btn om-btn--ghost-light">
            How it works
          </Link>
        </>
      }
    >
      <div className={styles.list}>
        {visitStories.map((story, i) => (
          <ScrollReveal key={story.slug} as="article" className={styles.card} delayMs={i * 60}>
            {story.image ? (
              <div className={styles.media}>
                <Image
                  src={story.image}
                  alt=""
                  fill
                  sizes="(max-width: 800px) 100vw, 720px"
                  className={styles.mediaImg}
                />
              </div>
            ) : null}
            <p className={styles.segment}>{story.segment}</p>
            <h2 className={styles.title}>
              <Link href={`/stories/${story.slug}`}>{story.title}</Link>
            </h2>
            <p className={styles.summary}>{story.summary}</p>
            <p className={styles.outcome}>
              <strong>Outcome:</strong> {story.outcome}
            </p>
            <Link href={`/stories/${story.slug}`} className={styles.link}>
              Read journey →
            </Link>
          </ScrollReveal>
        ))}
      </div>
      <p className={styles.footerNote}>
        <Link href="/how-it-works">How it works</Link> · <Link href="/download">Book now</Link> ·{" "}
        <Link href="/partners">Become a partner</Link>
      </p>
    </MarketingPage>
  );
}
