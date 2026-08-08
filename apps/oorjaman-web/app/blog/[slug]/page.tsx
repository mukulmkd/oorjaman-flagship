import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketingPage } from "@/components/MarketingPage";
import { blogPosts, getBlogPost } from "@/lib/blog-posts";
import { buildPageMetadata } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return blogPosts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) return {};
  return buildPageMetadata({
    title: post.title,
    description: post.excerpt,
    path: `/blog/${post.slug}`,
  });
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) notFound();

  return (
    <MarketingPage title={post.title} lead={post.excerpt} eyebrow={`Blog · ${post.published}`}>
      <p style={{ marginTop: 0 }}>
        <Link href="/blog">← All posts</Link>
      </p>
      {post.paragraphs.map((p, i) => (
        <p key={i} style={{ marginBottom: "1rem" }}>
          {p}
        </p>
      ))}
      <p style={{ marginTop: "1.5rem" }}>
        <Link href="/download" className="om-btn om-btn--primary">
          Book with the OorjaMan app
        </Link>
      </p>
    </MarketingPage>
  );
}
