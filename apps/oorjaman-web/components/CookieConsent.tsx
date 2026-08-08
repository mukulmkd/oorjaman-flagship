"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getStoredConsent, setStoredConsent, type ConsentValue } from "@/lib/consent";
import styles from "./cookie-consent.module.css";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Only prompt when the visitor has not chosen yet.
    if (getStoredConsent() === null) setVisible(true);
  }, []);

  const choose = (value: ConsentValue) => {
    setStoredConsent(value);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className={styles.wrap}
      role="dialog"
      aria-modal="false"
      aria-label="Cookie consent"
    >
      <div className={styles.inner}>
        <p className={styles.text}>
          We use essential cookies to run OorjaMan. With your consent we’d also use analytics to
          understand traffic and improve the site. Read our{" "}
          <Link href="/legal/cookie-policy" className={styles.link}>
            Cookie Policy
          </Link>
          .
        </p>
        <div className={styles.actions}>
          <button type="button" className={styles.decline} onClick={() => choose("declined")}>
            Decline
          </button>
          <button type="button" className={styles.accept} onClick={() => choose("accepted")}>
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
