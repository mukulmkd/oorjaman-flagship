/** Normalize Job Start / Happy Code input for comparison (digits-only for new codes; legacy VIS-/HAP- still accepted). */
export function normalizeServiceOtpCode(value: string): string {
  const compact = value.trim().replace(/\s+/g, "");
  if (!compact) return "";
  if (/^\d+$/.test(compact)) return compact;
  const digitsOnly = compact.replace(/\D/g, "");
  if (digitsOnly.length > 0 && !/[A-Za-z]/.test(compact)) return digitsOnly;
  return compact.toUpperCase();
}

/** 6-digit numeric Job Start Code (per booking, stored as `booking_code` + `service_otp.start_code`). */
export function allocateNumericVisitCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** 4-digit numeric Happy Code (per booking, `service_otp.happy_code`). */
export function allocateNumericHappyCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}
