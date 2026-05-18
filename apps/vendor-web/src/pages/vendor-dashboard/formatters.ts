import { formatDisplayDateTimeRange } from "@oorjaman/utils";

export function formatScheduleRange(b: { scheduled_start: string; scheduled_end: string }): string {
  return formatDisplayDateTimeRange(b.scheduled_start, b.scheduled_end);
}

/** INR from minor units (paise / cents). */
export function formatInr(minorUnits: number): string {
  const n = minorUnits / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}
