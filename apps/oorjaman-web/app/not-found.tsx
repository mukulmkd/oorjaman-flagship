import Link from "next/link";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "Page not found",
  description: "The page you requested could not be found on OorjaMan.",
  path: "/404",
  noIndex: true,
});

export default function NotFound() {
  return (
    <div className="om-section">
      <div className="om-container">
        <h1 className="om-h1">Page not found</h1>
        <p className="om-lead">Try the homepage or download the OorjaMan app to book solar care.</p>
        <p>
          <Link href="/" className="om-btn om-btn--primary">
            Go home
          </Link>{" "}
          <Link href="/download" className="om-btn om-btn--outline">
            Get the app
          </Link>
        </p>
      </div>
    </div>
  );
}
