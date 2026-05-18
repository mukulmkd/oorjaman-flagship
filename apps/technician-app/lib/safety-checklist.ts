/** Keys persisted under `job_reports.checklist.pre_start` (with technician ack at job start). */

export const SAFETY_ITEMS = [
  {
    key: "aware_of_safety_measures",
    label: "Are you aware of safety measures?",
  },
  {
    key: "reviewed_guidelines",
    label: "Have you reviewed guidelines?",
  },
] as const;

export type SafetyKey = (typeof SAFETY_ITEMS)[number]["key"];

export function emptySafetyRecord(): Record<SafetyKey, boolean> {
  return SAFETY_ITEMS.reduce(
    (acc, item) => {
      acc[item.key] = false;
      return acc;
    },
    {} as Record<SafetyKey, boolean>,
  );
}

export function allSafetyChecked(map: Record<SafetyKey, boolean>): boolean {
  return SAFETY_ITEMS.every((item) => map[item.key]);
}
