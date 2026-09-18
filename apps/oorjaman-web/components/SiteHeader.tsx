"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { showCityCoverage, showVisitStories } from "@/lib/launch-flags";
import { customerWebLoginUrl } from "@/lib/site";
import { BrandLogo } from "./BrandLogo";
import styles from "./site-header.module.css";

const NAV = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/services/panel-cleaning", label: "Panel cleaning", matchPrefix: "/services/panel-cleaning" },
  { href: "/services/amc-maintenance", label: "AMC", matchPrefix: "/services/amc" },
  { href: "/pricing", label: "Pricing" },
  { href: "/safety", label: "Safety & quality", matchPrefix: "/safety" },
  { href: "/download", label: "App" },
  { href: "/for-businesses", label: "Businesses & societies", matchPrefix: "/for-business" },
  ...(showVisitStories ? [{ href: "/stories", label: "Stories", matchPrefix: "/stories" }] : []),
  ...(showCityCoverage ? [{ href: "/cities", label: "Cities", matchPrefix: "/cities" }] : []),
  { href: "/partners", label: "Partners" },
  { href: "/contact", label: "Contact" },
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
  const webLogin = customerWebLoginUrl();
  const bookHref = webLogin ?? "/download";
  const bookIsExternal = Boolean(webLogin);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function renderNavLinks(keyPrefix: string) {
    return NAV.map((item) => {
      const active = pathMatches(pathname, item.href, item.matchPrefix);
      return (
        <Link
          key={`${keyPrefix}-${item.href}`}
          href={item.href}
          className={`${styles.navLink}${active ? ` ${styles.navLinkActive}` : ""}`}
          aria-current={active ? "page" : undefined}
          onClick={close}
          tabIndex={keyPrefix === "drawer" && !open ? -1 : undefined}
        >
          {item.label}
        </Link>
      );
    });
  }

  return (
    <>
      <header className={styles.header}>
        <div className={`om-container ${styles.inner}`}>
          <BrandLogo priority />

          <button
            type="button"
            className={styles.menuButton}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="site-menu-drawer"
            onClick={() => setOpen((v) => !v)}
          >
            <span className={styles.menuIcon} data-open={open} aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </button>

          <nav className={styles.navDesktop} aria-label="Main">
            {renderNavLinks("desktop")}
          </nav>

          <div className={styles.actions}>
            {bookIsExternal ? (
              <a href={bookHref} className="om-btn om-btn--primary" rel="noopener noreferrer">
                Book now
              </a>
            ) : (
              <Link href={bookHref} className="om-btn om-btn--primary">
                Book now
              </Link>
            )}
          </div>
        </div>
      </header>

      <button
        type="button"
        className={styles.backdrop}
        data-open={open}
        aria-label="Close menu"
        tabIndex={open ? 0 : -1}
        onClick={close}
      />
      <nav
        id="site-menu-drawer"
        className={styles.navDrawer}
        data-open={open}
        aria-label="Main"
        aria-hidden={!open}
        inert={!open ? true : undefined}
      >
        {renderNavLinks("drawer")}
        <div className={styles.menuActions}>
          {bookIsExternal ? (
            <a
              href={bookHref}
              className="om-btn om-btn--primary"
              onClick={close}
              tabIndex={!open ? -1 : undefined}
              rel="noopener noreferrer"
            >
              Book now
            </a>
          ) : (
            <Link
              href={bookHref}
              className="om-btn om-btn--primary"
              onClick={close}
              tabIndex={!open ? -1 : undefined}
            >
              Book now
            </Link>
          )}
        </div>
      </nav>
    </>
  );
}
