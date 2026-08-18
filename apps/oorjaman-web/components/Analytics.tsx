"use client";

import { useEffect, useState } from "react";
import { isPublicMarketingIndexable, parseDeployEnvironment } from "@oorjaman/config";
import { CONSENT_EVENT, getStoredConsent, type ConsentValue } from "@/lib/consent";

/**
 * Google Analytics 4 loader - fully consent-gated.
 *
 * Nothing loads unless ALL are true:
 *   1. NEXT_PUBLIC_GA_ID is set (no ID = no tracking, so this is inert today)
 *   2. deploy tier is production (never track on UAT/local)
 *   3. the visitor has accepted analytics cookies
 *
 * To enable later: set NEXT_PUBLIC_GA_ID=G-XXXXXXX in the production build.
 */
const GA_ID = process.env.NEXT_PUBLIC_GA_ID?.trim();

const IS_PRODUCTION = isPublicMarketingIndexable(
  parseDeployEnvironment({ siteUrl: process.env.NEXT_PUBLIC_SITE_URL }),
);

export function Analytics() {
  const [consent, setConsent] = useState<ConsentValue | null>(null);

  useEffect(() => {
    setConsent(getStoredConsent());
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<ConsentValue>).detail;
      setConsent(detail ?? getStoredConsent());
    };
    window.addEventListener(CONSENT_EVENT, onChange);
    return () => window.removeEventListener(CONSENT_EVENT, onChange);
  }, []);

  useEffect(() => {
    if (!GA_ID || !IS_PRODUCTION) return;
    if (consent !== "accepted") return;
    if (document.getElementById("om-ga-src")) return;

    const src = document.createElement("script");
    src.id = "om-ga-src";
    src.async = true;
    src.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
    document.head.appendChild(src);

    const init = document.createElement("script");
    init.id = "om-ga-init";
    init.innerHTML = [
      "window.dataLayer = window.dataLayer || [];",
      "function gtag(){dataLayer.push(arguments);}",
      "gtag('js', new Date());",
      `gtag('config', '${GA_ID}', { anonymize_ip: true });`,
    ].join("\n");
    document.head.appendChild(init);
  }, [consent]);

  return null;
}
