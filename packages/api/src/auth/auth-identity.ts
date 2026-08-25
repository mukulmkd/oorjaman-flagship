/**
 * Pure auth identity helpers (no Supabase session / user-api imports).
 * Kept separate so session-display and auth-api do not form a require cycle.
 */

/** Normalize typed mobile input toward E.164 (defaults 10-digit local numbers to `+91…`). */
export function normalizePhoneE164(raw: string, defaultCc = "91"): string {
  const trimmed = raw.trim().replace(/[\s-]/g, "");
  const digitsOnly = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+")) {
    return `+${digitsOnly}`;
  }
  if (digitsOnly.startsWith(defaultCc) && digitsOnly.length >= defaultCc.length + 8) {
    return `+${digitsOnly}`;
  }
  if (digitsOnly.length === 10) {
    return `+${defaultCc}${digitsOnly}`;
  }
  return `+${digitsOnly}`;
}

/**
 * Synthetic email used only for dummy auth password sign-in (legacy seed format).
 * Prefer {@link dummyAuthEmailForPhone} — current seed uses display emails as Auth emails.
 * Supabase often rejects `signInWithPassword({ phone })` with 422; email + password is reliable.
 */
export function dummyEmailFromPhoneE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return `u${digits}@oorjaman-dummy.test`;
}

/**
 * Display emails for `npm run seed:dummy-users` — must stay in sync with
 * `scripts/seed-dummy-test-users.mjs` (`DEFS[].email`). Auth email = this value so
 * portal/mobile Email OTP dummy login can use the same address as the inbox label.
 */
const DUMMY_SEED_PHONE_AUTH_EMAIL: Record<string, string> = {
  "919000000101": "priya.sharma@oorjaman.in",
  "919000000102": "vikram.mehta@oorjaman.in",
  "919000000111": "ananya.reddy@oorjaman.in",
  "919000000112": "karthik.nair@oorjaman.in",
  "919000000201": "contact@gamusagreen.in",
  "919000000202": "contact@bharatsun.in",
  "919000000301": "amit.das@gamusagreen.in",
  "919000000302": "sanjay.pillai@bharatsun.in",
  "919000000303": "ravi.iyer@gamusagreen.in",
  "919000000304": "deepak.menon@gamusagreen.in",
  "919000000305": "suresh.babu@gamusagreen.in",
  "919000000306": "manoj.krishnan@bharatsun.in",
  "919000000401": "raju.mahalingam@gmail.com",
  "919000000402": "rajesh.kumar@gmail.com",
  "919000000403": "teammate.customer1@oorjaman.test",
  "919000000404": "teammate.customer2@oorjaman.test",
  "919000000405": "teammate.customer3@oorjaman.test",
  "919000000406": "teammate.customer4@oorjaman.test",
};

/** Auth email for dummy phone OTP password sign-in (display email, else synthetic legacy). */
export function dummyAuthEmailForPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const mapped =
    DUMMY_SEED_PHONE_AUTH_EMAIL[digits] ??
    (digits.length >= 10 ? DUMMY_SEED_PHONE_AUTH_EMAIL[digits.slice(-10)] : undefined);
  if (mapped) return mapped.toLowerCase();
  return dummyEmailFromPhoneE164(phone);
}

/** Candidate Auth emails for dummy phone login (display first, then legacy synthetic). */
export function dummyAuthEmailCandidatesForPhone(phone: string): string[] {
  const primary = dummyAuthEmailForPhone(phone);
  const legacy = dummyEmailFromPhoneE164(phone);
  return primary === legacy ? [primary] : [primary, legacy];
}

/** Dev-only synthetic emails; not shown as a verified contact in product UI. */
export function isDummyAuthEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase().endsWith("@oorjaman-dummy.test");
}
