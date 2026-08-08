import Link from "next/link";
import { MarketingPage } from "@/components/MarketingPage";
import { blogPosts } from "@/lib/blog-posts";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "Blog - solar care tips",
  description: "Articles on solar panel cleaning, AMC, and rooftop maintenance in India.",
  path: "/blog",
});

export default function BlogIndexPage() {
  return (
    <MarketingPage title="Blog" lead="Practical notes on keeping Indian rooftops productive.">
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {blogPosts.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="om-card"
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <time dateTime={post.published} style={{ fontSize: "0.8125rem", color: "var(--om-muted)" }}>
              {post.published}
            </time>
            <h2 style={{ fontSize: "1.125rem", margin: "0.35rem 0 0.5rem" }}>{post.title}</h2>
            <p style={{ margin: 0, color: "var(--om-muted)" }}>{post.excerpt}</p>
          </Link>
        ))}
      </div>
    </MarketingPage>
  );
}
