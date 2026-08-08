/**
 * Cookie/analytics consent for the marketing site.
 *
 * We store a single choice in localStorage and broadcast changes so the
 * analytics loader can react without a page reload. Nothing tracking-related
 * runs until the visitor explicitly accepts.
 */
export const CONSENT_KEY = "om-cookie-consent";
export const CONSENT_EVENT = "om-consent-change";

export type ConsentValue = "accepted" | "declined";

export function getStoredConsent(): ConsentValue | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(CONSENT_KEY);
    return value === "accepted" || value === "declined" ? value : null;
  } catch {
    return null;
  }
}

export function setStoredConsent(value: ConsentValue): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CONSENT_KEY, value);
  } catch {
    /* storage blocked — treat as session-only choice */
  }
  window.dispatchEvent(new CustomEvent<ConsentValue>(CONSENT_EVENT, { detail: value }));
}

export function hasAnalyticsConsent(): boolean {
  return getStoredConsent() === "accepted";
}
