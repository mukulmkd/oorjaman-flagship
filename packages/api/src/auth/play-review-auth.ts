/**
 * Google Play review accounts: email + password (no OTP) in the matching mobile app only.
 * Password lives in Supabase Auth; apps only switch UI when the allowlisted email is typed.
 */

export type PlayReviewApp = "customer" | "technician";

export const PLAY_REVIEW_CUSTOMER_EMAIL = "appreview.customer@oorjaman.com";
export const PLAY_REVIEW_TECHNICIAN_EMAIL = "appreview.technician@oorjaman.com";

/** Shared fixed password for both Play review Auth users (also used by seed script). */
export const PLAY_REVIEW_PASSWORD = "OorjaManPlayReview2026!";

const BY_APP: Record<PlayReviewApp, string> = {
  customer: PLAY_REVIEW_CUSTOMER_EMAIL,
  technician: PLAY_REVIEW_TECHNICIAN_EMAIL,
};

export function normalizeAuthEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** True when this email is the Play review account for the given app binary. */
export function isPlayReviewEmailForApp(email: string, app: PlayReviewApp): boolean {
  return normalizeAuthEmail(email) === BY_APP[app];
}

export function playReviewEmailForApp(app: PlayReviewApp): string {
  return BY_APP[app];
}
