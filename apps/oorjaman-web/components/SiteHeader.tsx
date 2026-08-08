"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BrandLogo } from "./BrandLogo";
import styles from "./site-header.module.css";

const NAV = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/services/panel-cleaning", label: "Services" },
  { href: "/pricing", label: "Pricing" },
  { href: "/cities", label: "Cities" },
  { href: "/safety", label: "Safety" },
  { href: "/faq", label: "FAQ" },
  { href: "/partners", label: "Partners" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className={styles.header}>
      <div className={`om-container ${styles.inner}`}>
        <BrandLogo priority />

        <button
          type="button"
          className={styles.menuButton}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="site-menu"
          onClick={() => setOpen((v) => !v)}
        >
          <span className={styles.menuIcon} data-open={open} aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </button>

        <nav id="site-menu" className={styles.nav} data-open={open} aria-label="Main">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className={styles.navLink} onClick={close}>
              {item.label}
            </Link>
          ))}
          <div className={styles.menuActions}>
            <Link href="/contact" className={styles.navLink} onClick={close}>
              Contact
            </Link>
            <Link href="/download" className="om-btn om-btn--primary" onClick={close}>
              Get the app
            </Link>
          </div>
        </nav>

        <div className={styles.actions}>
          <Link href="/contact" className={styles.navLink}>
            Contact
          </Link>
          <Link href="/download" className="om-btn om-btn--primary">
            Get the app
          </Link>
        </div>
      </div>
    </header>
  );
}
