"use client";

import { SUPPORT_PHONE, SUPPORT_PHONE_TEL } from "@/lib/site";
import styles from "./sticky-support.module.css";

/** Floating call affordance (Cleensol-style), brand-safe. */
export function StickySupportCall() {
  return (
    <a
      href={`tel:${SUPPORT_PHONE_TEL}`}
      className={styles.chip}
      aria-label={`Call OorjaMan support at ${SUPPORT_PHONE}`}
    >
      <span className={styles.icon} aria-hidden>
        ☎
      </span>
      <span className={styles.copy}>
        <span className={styles.label}>Need help?</span>
        <span className={styles.phone}>{SUPPORT_PHONE}</span>
      </span>
    </a>
  );
}
