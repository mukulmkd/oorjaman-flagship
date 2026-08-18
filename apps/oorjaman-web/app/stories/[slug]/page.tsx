import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketingPage } from "@/components/MarketingPage";
import { ScrollReveal } from "@/components/ScrollReveal";
import { buildPageMetadata } from "@/lib/seo";
import { showVisitStories } from "@/lib/launch-flags";
import { getVisitStory, visitStories } from "@/lib/visit-stories";
import styles from "../stories.module.css";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  // Static export requires a non-empty list. Hidden stories still 404 below.
  return visitStories.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const story = getVisitStory(slug);
  if (!story) return {};
  return buildPageMetadata({
    title: story.title,
    description: story.summary,
    path: `/stories/${story.slug}`,
    noIndex: !showVisitStories,
  });
}

export default async function VisitStoryPage({ params }: Props) {
  const { slug } = await params;
  const story = getVisitStory(slug);
  if (!showVisitStories || !story) notFound();

  return (
    <MarketingPage
      title={story.title}
      lead={story.segment}
      mediaSrc={story.image ?? "/marketing/story-panels.jpg"}
      wide
      cta={
        <>
          <Link href="/download" className="om-btn om-btn--primary">
            Get the app
          </Link>
          <Link href="/stories" className="om-btn om-btn--ghost-light">
            All stories
          </Link>
        </>
      }
    >
      <ScrollReveal>
        <p className={styles.detailLead}>{story.summary}</p>
      </ScrollReveal>
      <ScrollReveal>
        <h2 className="om-h3">How the platform handles it</h2>
        <ol className={styles.detailSteps}>
          {story.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </ScrollReveal>
      <ScrollReveal>
        <h2 className="om-h3">Outcome</h2>
        <p>{story.outcome}</p>
      </ScrollReveal>
      <p className={styles.detailActions}>
        <Link href="/download" className="om-btn om-btn--primary">
          Get the app
        </Link>
        <Link href="/stories" className="om-btn om-btn--outline">
          All stories
        </Link>
        <Link href="/how-it-works" className="om-btn om-btn--outline">
          How it works
        </Link>
      </p>
    </MarketingPage>
  );
}
