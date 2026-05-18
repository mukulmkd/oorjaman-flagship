/**
 * Solar visit scheduling rules (India market - Asia/Kolkata wall clock).
 *
 * Rule: if the customer initiates booking at or after **19:00 IST**, the earliest day they can pick is **tomorrow**,
 * and on that first selectable day slots start **after 12:00 IST** only.
 *
 * Otherwise same-day booking is allowed with **≥ 2 hours lead time** from when slots are evaluated.
 */

export const BOOKING_TIMEZONE = "Asia/Kolkata";
export const EVENING_CUTOFF_HOUR_IST = 19;
export const AFTERNOON_FIRST_SLOT_HOUR_IST = 12;
export const FIRST_SLOT_HOUR_IST = 9;
export const LAST_SLOT_START_HOUR_IST = 16;
export const SLOT_DURATION_MS = 2 * 60 * 60 * 1000;
export const LEAD_TIME_MS = 2 * 60 * 60 * 1000;

export type BookingSlotOption = {
  id: string;
  label: string;
  scheduledStart: string;
  scheduledEnd: string;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** IST calendar components for `now` (wall clock in Asia/Kolkata). */
export function getISTWallParts(now: Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
} {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: BOOKING_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = dtf.formatToParts(now);
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
  };
}

/** Calendar day key `YYYY-MM-DD` in IST corresponding to instant `now`. */
export function istDayKeyFromDate(now: Date): string {
  const p = getISTWallParts(now);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

/** Next calendar day in IST after `dayKey`. */
export function addCalendarDaysIST(dayKey: string, deltaDays: number): string {
  const segs = dayKey.split("-");
  const y = Number(segs[0]);
  const m = Number(segs[1]);
  const d = Number(segs[2]);
  const anchor = new Date(`${y}-${pad2(m)}-${pad2(d)}T12:00:00+05:30`);
  const shifted = new Date(anchor.getTime() + deltaDays * 86400000);
  const p = getISTWallParts(shifted);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

/** True when IST wall time is **19:00 or later** ("after 7 PM" inclusive). */
export function isEveningBookingCutoff(now: Date): boolean {
  return getISTWallParts(now).hour >= EVENING_CUTOFF_HOUR_IST;
}

/** Earliest selectable IST calendar day under business rules. */
export function minSelectableDayKey(now: Date): string {
  const todayKey = istDayKeyFromDate(now);
  if (isEveningBookingCutoff(now)) {
    return addCalendarDaysIST(todayKey, 1);
  }
  return todayKey;
}

export function listSelectableDayKeys(now: Date, horizonDays = 14): string[] {
  const min = minSelectableDayKey(now);
  const keys: string[] = [];
  let cur = min;
  for (let i = 0; i < horizonDays; i++) {
    keys.push(cur);
    cur = addCalendarDaysIST(cur, 1);
  }
  return keys;
}

/** Instant for IST wall `dayKey` + hour/minute at offset `+05:30`. */
export function istInstantUtc(dayKey: string, hour: number, minute: number): Date {
  const segs = dayKey.split("-");
  const y = Number(segs[0]);
  const m = Number(segs[1]);
  const d = Number(segs[2]);
  return new Date(`${y}-${pad2(m)}-${pad2(d)}T${pad2(hour)}:${pad2(minute)}:00+05:30`);
}

function formatHmLocal(slotStartUtc: Date): string {
  const dtf = new Intl.DateTimeFormat("en-IN", {
    timeZone: BOOKING_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return dtf.format(slotStartUtc);
}

/** Visit start hours available on `dayKey` when evaluated at `now`. */
export function slotsForDay(dayKey: string, now: Date): BookingSlotOption[] {
  const minDay = minSelectableDayKey(now);
  const evening = isEveningBookingCutoff(now);

  if (dayKey < minDay) return [];

  let startHours: number[] = [];
  for (let h = FIRST_SLOT_HOUR_IST; h <= LAST_SLOT_START_HOUR_IST; h++) {
    startHours.push(h);
  }

  if (dayKey === minDay && evening) {
    startHours = startHours.filter((h) => h >= AFTERNOON_FIRST_SLOT_HOUR_IST);
  }

  const earliestStartMs = now.getTime() + LEAD_TIME_MS;
  const options: BookingSlotOption[] = [];

  for (const h of startHours) {
    const start = istInstantUtc(dayKey, h, 0);
    if (dayKey === minDay && !evening && start.getTime() < earliestStartMs) {
      continue;
    }
    const end = new Date(start.getTime() + SLOT_DURATION_MS);
    options.push({
      id: `${dayKey}-${pad2(h)}00`,
      label: `${formatHmLocal(start)} – ${formatHmLocal(end)} IST`,
      scheduledStart: start.toISOString(),
      scheduledEnd: end.toISOString(),
    });
  }

  return options;
}

/** Short chip label for a day key (weekday + date). */
export function formatDayChip(dayKey: string): string {
  const noon = istInstantUtc(dayKey, 12, 0);
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: BOOKING_TIMEZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(noon);
}

/** Whether `slot` is still allowed if the booking is confirmed at `bookedAt`. */
export function isSlotValidAt(dayKey: string, slot: BookingSlotOption, bookedAt: Date): boolean {
  const allowed = slotsForDay(dayKey, bookedAt);
  return allowed.some((s) => s.scheduledStart === slot.scheduledStart && s.scheduledEnd === slot.scheduledEnd);
}

export type CalendarCellIST = { dayKey: string | null; inMonth: boolean };

/**
 * 6×7 grid (Mon-first) for an IST calendar month. Leading/trailing cells use `dayKey: null`.
 */
export function buildMonthCalendarGridIST(year: number, month: number): CalendarCellIST[] {
  const firstKey = `${year}-${pad2(month)}-01`;
  const nextY = month === 12 ? year + 1 : year;
  const nextM = month === 12 ? 1 : month + 1;
  const nextFirst = `${nextY}-${pad2(nextM)}-01`;
  const firstNoon = istInstantUtc(firstKey, 12, 0);
  const nextNoon = istInstantUtc(nextFirst, 12, 0);
  const daysInMonth = Math.max(1, Math.round((nextNoon.getTime() - firstNoon.getTime()) / 86400000));
  const jsDow = firstNoon.getDay();
  const mon0Start = (jsDow + 6) % 7;
  const cells: CalendarCellIST[] = [];
  for (let i = 0; i < mon0Start; i++) {
    cells.push({ dayKey: null, inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ dayKey: `${year}-${pad2(month)}-${pad2(d)}`, inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ dayKey: null, inMonth: false });
  }
  while (cells.length < 42) {
    cells.push({ dayKey: null, inMonth: false });
  }
  return cells.slice(0, 42);
}
