import { useEffect, useState } from "react";

export function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/**
 * Elapsed ms from `actual_start`: live while in progress, fixed when `actual_end` is set (Supabase-backed).
 */
export function useJobElapsedMs(
  actualStart: string | null | undefined,
  actualEnd: string | null | undefined,
): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!actualStart || actualEnd) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [actualStart, actualEnd]);

  if (!actualStart) return 0;
  const startMs = new Date(actualStart).getTime();
  const endMs = actualEnd ? new Date(actualEnd).getTime() : now;
  return Math.max(0, endMs - startMs);
}

export function formatJobTimestamp(iso: string | null | undefined): string {
  if (!iso) return "-";
  try {
    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Kolkata",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
