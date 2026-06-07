const DISPLAY_LOCALE = "en-IN";
const DISPLAY_TZ = "Asia/Kolkata";

/** Parse ISO / DB timestamps; returns null when invalid. */
export function parseIsoLike(value: string | null | undefined): Date | null {
  const raw = value?.trim();
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Human-readable fallback when parsing fails (never show raw `T…Z` in UI). */
export function formatIsoFallback(raw: string): string {
  const t = raw.trim();
  if (!t) return "-";
  return t
    .replace(/\.\d{3}Z?$/i, "")
    .replace(/Z$/i, "")
    .replace(/T/, ", ")
    .trim();
}

/**
 * Hermes / React Native Intl rejects mixing `dateStyle`/`timeStyle` with explicit
 * fields (e.g. `weekday`). Use component-based options only.
 */

const DATE_PARTS: Intl.DateTimeFormatOptions = {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: DISPLAY_TZ,
};

const TIME_PARTS: Intl.DateTimeFormatOptions = {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: DISPLAY_TZ,
};

/** e.g. Sat, 16 May 2026, 9:30 am */
export function formatDisplayDateTime(iso: string): string {
  const d = parseIsoLike(iso);
  if (!d) return formatIsoFallback(iso);
  return new Intl.DateTimeFormat(DISPLAY_LOCALE, {
    ...DATE_PARTS,
    ...TIME_PARTS,
  }).format(d);
}

/** e.g. Sat, 16 May 2026 */
export function formatDisplayDate(iso: string): string {
  const d = parseIsoLike(iso);
  if (!d) return formatIsoFallback(iso);
  return new Intl.DateTimeFormat(DISPLAY_LOCALE, DATE_PARTS).format(d);
}

/** Visit window: date+time start, time-only end (same day assumed). */
export function formatDisplayDateTimeRange(
  startIso: string,
  endIso: string,
): string {
  const start = parseIsoLike(startIso);
  const end = parseIsoLike(endIso);
  if (!start || !end) {
    return `${formatIsoFallback(startIso)} - ${formatIsoFallback(endIso)}`;
  }
  const startFmt = new Intl.DateTimeFormat(DISPLAY_LOCALE, {
    ...DATE_PARTS,
    ...TIME_PARTS,
  }).format(start);
  const endFmt = new Intl.DateTimeFormat(DISPLAY_LOCALE, TIME_PARTS).format(
    end,
  );
  return `${startFmt} - ${endFmt} IST`;
}
