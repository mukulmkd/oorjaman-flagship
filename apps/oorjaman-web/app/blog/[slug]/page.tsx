import Link from "next/link";
import { notFound } from "next/navigation";
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
    <article className="om-section">
      <div className="om-container" style={{ maxWidth: "42rem" }}>
        <p style={{ fontSize: "0.875rem", color: "var(--om-muted)" }}>
          <Link href="/blog">Blog</Link> · <time dateTime={post.published}>{post.published}</time>
        </p>
        <h1 className="om-h1">{post.title}</h1>
        {post.paragraphs.map((p, i) => (
          <p key={i} style={{ marginBottom: "1rem" }}>
            {p}
          </p>
        ))}
        <p>
          <Link href="/download" className="om-btn om-btn--primary">
            Book with the OorjaMan app
          </Link>
        </p>
      </div>
    </article>
  );
}
