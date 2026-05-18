/** Shared login / signup phone + email validation (country dial + 10-digit national). */

export const LOGIN_NATIONAL_MAX_DIGITS = 10;

export type LoginPhoneCountry = {
  dialCode: string;
  label: string;
};

/** Primary markets - extend as needed. */
export const LOGIN_PHONE_COUNTRIES: readonly LoginPhoneCountry[] = [
  { dialCode: "91", label: "India (+91)" },
  { dialCode: "1", label: "United States (+1)" },
  { dialCode: "44", label: "United Kingdom (+44)" },
  { dialCode: "971", label: "United Arab Emirates (+971)" },
];

export const DEFAULT_LOGIN_COUNTRY_DIAL = "91";

export function sanitizeLoginNationalDigits(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, LOGIN_NATIONAL_MAX_DIGITS);
}

/** E.164 for Supabase phone OTP (`+` + country + national, no spaces). */
export function buildLoginE164(countryDialCode: string, nationalDigits: string): string {
  const dial = countryDialCode.replace(/\D/g, "");
  const national = sanitizeLoginNationalDigits(nationalDigits);
  return `+${dial}${national}`;
}

/** Returns an error message or `null` when national is exactly `LOGIN_NATIONAL_MAX_DIGITS` digits. */
export function validateLoginNationalPhone(nationalDigits: string): string | null {
  const national = sanitizeLoginNationalDigits(nationalDigits);
  if (national.length !== LOGIN_NATIONAL_MAX_DIGITS) {
    return `Enter a ${LOGIN_NATIONAL_MAX_DIGITS}-digit mobile number.`;
  }
  return null;
}

/**
 * Practical email validation for login/signup (trimmed, single @, domain with dot, sensible lengths).
 * Returns an error message or `null` when valid.
 */
export function validateEmailFormat(raw: string): string | null {
  const t = raw.trim();
  if (!t) return "Enter your email address.";
  if (t.length > 254) return "Enter a valid email address.";
  const parts = t.split("@");
  if (parts.length !== 2) return "Enter a valid email address.";
  const local = parts[0] ?? "";
  const domain = parts[1] ?? "";
  if (!local.length || !domain.length) return "Enter a valid email address.";
  if (local.includes(" ") || domain.includes(" ")) return "Enter a valid email address.";
  if (!domain.includes(".")) return "Enter a valid email address.";
  const lastDot = domain.lastIndexOf(".");
  const tld = domain.slice(lastDot + 1);
  if (tld.length < 2 || !/^[a-zA-Z]+$/.test(tld)) return "Enter a valid email address.";
  if (/[<>'"&]/.test(t)) return "Enter a valid email address.";
  return null;
}
