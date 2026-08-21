import Image from "next/image";
import Link from "next/link";
import { BRAND_TAGLINE } from "@oorjaman/config";
import { footerLegalNav } from "@/lib/legal-docs";
import { showCityCoverage, showVisitStories } from "@/lib/launch-flags";
import { COMPANY_LEGAL_NAME, SUPPORT_EMAIL, SUPPORT_HOURS, SUPPORT_PHONE, SUPPORT_PHONE_TEL } from "@/lib/site";
import { BrandWordmark } from "./BrandWordmark";
import { SocialLinks } from "./SocialLinks";
import styles from "./site-footer.module.css";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={`om-container ${styles.grid}`}>
        <div className={styles.brandBlock}>
          <Link href="/" className={styles.brandLink} aria-label="OorjaMan home">
            <Image src="/logo-icon.png" alt="" width={40} height={40} className={styles.brandIcon} />
            <span className={styles.brandWordmark}>
              <BrandWordmark size="compact" tone="onDark" />
            </span>
          </Link>
          <p className={styles.tagline}>{BRAND_TAGLINE}</p>
          <p className={styles.blurb}>
            Technology marketplace for solar rooftop cleaning, inspections, and AMC - fulfilled by verified
            independent partners where coverage is available.
          </p>
          <p className={styles.supportMeta}>
            <a href={`tel:${SUPPORT_PHONE_TEL}`}>{SUPPORT_PHONE}</a>
            <span aria-hidden> · </span>
            {SUPPORT_HOURS}
          </p>
          <SocialLinks tone="onDark" className={styles.socialRow} />
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
              <Link href="/pricing">Pricing</Link>
            </li>
            <li>
              <Link href="/safety">Safety</Link>
            </li>
            {showVisitStories ? (
              <li>
                <Link href="/stories">Visit stories</Link>
              </li>
            ) : null}
            <li>
              <Link href="/download">Get the app</Link>
            </li>
            {showCityCoverage ? (
              <li>
                <Link href="/cities">Cities</Link>
              </li>
            ) : null}
            <li>
              <Link href="/blog">Blog</Link>
            </li>
          </ul>
        </div>
        <div>
          <p className={styles.colTitle}>Company</p>
          <ul className={styles.links}>
            <li>
              <Link href="/about">About</Link>
            </li>
            <li>
              <Link href="/for-homeowners">For homeowners</Link>
            </li>
            <li>
              <Link href="/for-businesses">Businesses &amp; societies</Link>
            </li>
            <li>
              <Link href="/partners">Become a partner</Link>
            </li>
            <li>
              <Link href="/contact">Contact</Link>
            </li>
            <li>
              <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
            </li>
            <li>
              <Link href="/legal/account-deletion">Delete account</Link>
            </li>
          </ul>
        </div>
        <div>
          <p className={styles.colTitle}>Legal</p>
          <ul className={styles.links}>
            <li>
              <Link href="/legal">All policies</Link>
            </li>
            {footerLegalNav.map((item) => (
              <li key={item.slug}>
                <Link href={item.href}>{item.title}</Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className={`om-container ${styles.bottom}`}>
        <p>
          © {year} {COMPANY_LEGAL_NAME}. All rights reserved. OorjaMan is a technology marketplace operated by{" "}
          {COMPANY_LEGAL_NAME}.
        </p>
      </div>
    </footer>
  );
}
