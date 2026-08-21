"use client";

import { SUPPORT_PHONE, SUPPORT_PHONE_TEL } from "@/lib/site";
import styles from "./sticky-support.module.css";

/** Floating call affordance — brochure-aligned, brand tokens only. */
export function StickySupportCall() {
  return (
    <a
      href={`tel:${SUPPORT_PHONE_TEL}`}
      className={styles.chip}
      aria-label={`Call OorjaMan support at ${SUPPORT_PHONE}`}
    >
      <span className={styles.icon} aria-hidden>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85">
          <path d="M7.5 4.5h3l1.2 3.2-1.6 1.1a12.5 12.5 0 005.6 5.6l1.1-1.6 3.2 1.2v3a1.5 1.5 0 01-1.5 1.5A14.5 14.5 0 016 6a1.5 1.5 0 011.5-1.5z" />
        </svg>
      </span>
      <span className={styles.copy}>
        <span className={styles.label}>Support</span>
        <span className={styles.phone}>{SUPPORT_PHONE}</span>
      </span>
    </a>
  );
}
