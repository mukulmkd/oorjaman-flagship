import Link from "next/link";
import styles from "./site-header.module.css";

const NAV = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/services/panel-cleaning", label: "Services" },
  { href: "/cities", label: "Cities" },
  { href: "/blog", label: "Blog" },
  { href: "/faq", label: "FAQ" },
  { href: "/partners", label: "Partners" },
];

export function SiteHeader() {
  return (
    <header className={styles.header}>
      <div className={`om-container ${styles.inner}`}>
        <Link href="/" className={styles.brand}>
          <span className={styles.logoMark} aria-hidden />
          <span>OorjaMan</span>
        </Link>
        <nav className={styles.nav} aria-label="Main">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className={styles.navLink}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className={styles.actions}>
          <Link href="/download" className="om-btn om-btn--outline">
            Get the app
          </Link>
        </div>
      </div>
    </header>
  );
}
