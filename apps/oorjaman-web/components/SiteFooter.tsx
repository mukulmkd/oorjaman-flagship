import Link from "next/link";
import { legalNav } from "@/lib/legal-docs";
import { SUPPORT_EMAIL } from "@/lib/site";
import styles from "./site-footer.module.css";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={`om-container ${styles.grid}`}>
        <div>
          <p className={styles.brand}>OorjaMan</p>
          <p className={styles.tagline}>Solar rooftop care - cleaning, maintenance &amp; AMC across India.</p>
        </div>
        <div>
          <p className={styles.colTitle}>Product</p>
          <ul className={styles.links}>
            <li>
              <Link href="/how-it-works">How it works</Link>
            </li>
            <li>
              <Link href="/services/panel-cleaning">Panel cleaning</Link>
            </li>
            <li>
              <Link href="/services/amc-maintenance">AMC plans</Link>
            </li>
            <li>
              <Link href="/download">Download app</Link>
            </li>
            <li>
              <Link href="/cities">Cities</Link>
            </li>
            <li>
              <Link href="/blog">Blog</Link>
            </li>
          </ul>
        </div>
        <div>
          <p className={styles.colTitle}>Legal</p>
          <ul className={styles.links}>
            <li>
              <Link href="/legal">All policies</Link>
            </li>
            {legalNav.slice(0, 5).map((item) => (
              <li key={item.slug}>
                <Link href={item.href}>{item.title}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className={styles.colTitle}>Contact</p>
          <ul className={styles.links}>
            <li>
              <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
            </li>
            <li>
              <Link href="/contact">Contact page</Link>
            </li>
            <li>
              <Link href="/legal/account-deletion">Delete account</Link>
            </li>
          </ul>
        </div>
      </div>
      <div className={`om-container ${styles.bottom}`}>
        <p>© {year} OorjaMan. All rights reserved.</p>
      </div>
    </footer>
  );
}
