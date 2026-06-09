import type { CustomerOorjamanCreditGrantRow } from "../database.types";

/** 1 OorjaMan Credit = ₹1 = 100 paise. */
export const OORJAMAN_CREDIT_PAISE = 100;

/** Apology credits issued when a partner cancels within the last hour before the visit. */
export const VENDOR_LAST_HOUR_CANCEL_CUSTOMER_CREDITS = 20;

export const OORJAMAN_CREDIT_VALIDITY_MS = 365 * 24 * 60 * 60 * 1000;

export const VENDOR_CANCEL_LAST_HOUR_BEFORE_SLOT_MS = 60 * 60 * 1000;

export type OorjamanCreditsRedemptionPlan = {
  discount_paise: number;
  discount_credits: number;
  allocations: { grant_id: string; credits: number }[];
};

export function isVendorCancelInLastHourBeforeSlot(
  scheduledStartIso: string,
  at: Date = new Date(),
): boolean {
  const startMs = new Date(scheduledStartIso).getTime();
  const nowMs = at.getTime();
  if (!Number.isFinite(startMs)) return false;
  const msToStart = startMs - nowMs;
  return msToStart > 0 && msToStart <= VENDOR_CANCEL_LAST_HOUR_BEFORE_SLOT_MS;
}

export function creditsToPaise(credits: number): number {
  return Math.max(0, Math.round(credits)) * OORJAMAN_CREDIT_PAISE;
}

export function paiseToCreditsFloor(paise: number): number {
  return Math.max(0, Math.floor(Math.max(0, Math.round(paise)) / OORJAMAN_CREDIT_PAISE));
}

export function planOorjamanCreditsRedemption(
  grants: CustomerOorjamanCreditGrantRow[],
  payablePaise: number,
  at: Date = new Date(),
): OorjamanCreditsRedemptionPlan {
  const targetCredits = paiseToCreditsFloor(payablePaise);
  if (targetCredits <= 0) {
    return { discount_paise: 0, discount_credits: 0, allocations: [] };
  }

  const nowMs = at.getTime();
  const active = grants
    .filter(
      (g) =>
        g.credits_remaining > 0 &&
        new Date(g.expires_at).getTime() > nowMs,
    )
    .sort(
      (a, b) =>
        new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime() ||
        new Date(a.issued_at).getTime() - new Date(b.issued_at).getTime(),
    );

  let remaining = targetCredits;
  const allocations: { grant_id: string; credits: number }[] = [];
  for (const grant of active) {
    if (remaining <= 0) break;
    const take = Math.min(grant.credits_remaining, remaining);
    if (take <= 0) continue;
    allocations.push({ grant_id: grant.id, credits: take });
    remaining -= take;
  }

  const discountCredits = targetCredits - remaining;
  return {
    discount_paise: creditsToPaise(discountCredits),
    discount_credits: discountCredits,
    allocations,
  };
}
