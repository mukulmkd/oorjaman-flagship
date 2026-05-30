/** Demo-friendly support contact - replace with env-driven value for production. */
export const SUPPORT_EMAIL = "support@oorjaman.com";

export function bookingSupportMailto(params: { referenceCode?: string | null; topic?: string }): string {
  const ref = params.referenceCode?.trim();
  const base = params.topic?.trim() ?? "Help with my booking";
  const subject = ref ? `${base} (${ref})` : base;
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
}
