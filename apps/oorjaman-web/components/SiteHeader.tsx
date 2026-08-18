"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { showCityCoverage, showVisitStories } from "@/lib/launch-flags";
import { BrandLogo } from "./BrandLogo";
import styles from "./site-header.module.css";

const NAV = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/services/panel-cleaning", label: "Services", matchPrefix: "/services" },
  { href: "/pricing", label: "Pricing" },
  ...(showVisitStories ? [{ href: "/stories", label: "Stories", matchPrefix: "/stories" }] : []),
  ...(showCityCoverage ? [{ href: "/cities", label: "Cities", matchPrefix: "/cities" }] : []),
  { href: "/safety", label: "Safety" },
  { href: "/faq", label: "FAQ" },
  { href: "/partners", label: "Partners" },
];

function pathMatches(pathname: string, href: string, matchPrefix?: string): boolean {
  const path = pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  if (matchPrefix) {
    return path === matchPrefix || path.startsWith(`${matchPrefix}/`);
  }
  return path === href;
}

export function SiteHeader() {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

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
          {NAV.map((item) => {
            const active = pathMatches(pathname, item.href, item.matchPrefix);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navLink}${active ? ` ${styles.navLinkActive}` : ""}`}
                aria-current={active ? "page" : undefined}
                onClick={close}
              >
                {item.label}
              </Link>
            );
          })}
          <div className={styles.menuActions}>
            <Link
              href="/contact"
              className={`${styles.navLink}${pathMatches(pathname, "/contact") ? ` ${styles.navLinkActive}` : ""}`}
              aria-current={pathMatches(pathname, "/contact") ? "page" : undefined}
              onClick={close}
            >
              Contact
            </Link>
            <Link href="/download" className="om-btn om-btn--primary" onClick={close}>
              Get the app
            </Link>
          </div>
        </nav>

        <div className={styles.actions}>
          <Link
            href="/contact"
            className={`${styles.navLink}${pathMatches(pathname, "/contact") ? ` ${styles.navLinkActive}` : ""}`}
            aria-current={pathMatches(pathname, "/contact") ? "page" : undefined}
          >
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
