/** First token of display name for greetings; falls back to neutral "there". */
export function customerFirstName(displayName: string | null | undefined): string {
  const trimmed = displayName?.trim();
  if (!trimmed) return "there";
  const first = trimmed.split(/\s+/)[0];
  return first && first.length > 0 ? first : "there";
}
