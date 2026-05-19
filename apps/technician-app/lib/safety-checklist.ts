/** Keys persisted under `job_reports.checklist.pre_start` when the technician starts on-site work. */

export const SAFETY_ITEMS = [
  {
    key: "aware_of_safety_measures",
    label: "I am aware of the safety measures required for this visit (rooftop / solar cleaning).",
  },
  {
    key: "reviewed_guidelines",
    label: "I have reviewed OorjaMan and my employer field-safety expectations for this job.",
  },
  {
    key: "ack_job_start_code",
    label: "I will verify the customer's Job Start Code before beginning on-site work.",
  },
  {
    key: "ack_ppe_on_site",
    label: "I will use appropriate PPE and follow on-site safety protocols during this visit.",
  },
] as const;

export type SafetyKey = (typeof SAFETY_ITEMS)[number]["key"];

export type SafetyAckRecord = Record<SafetyKey, boolean>;

export function emptySafetyRecord(): SafetyAckRecord {
  return SAFETY_ITEMS.reduce(
    (acc, item) => {
      acc[item.key] = false;
      return acc;
    },
    {} as SafetyAckRecord,
  );
}

export function allSafetyChecked(map: SafetyAckRecord): boolean {
  return SAFETY_ITEMS.every((item) => map[item.key]);
}

export function toPreStartSafetyAck(map: SafetyAckRecord): {
  aware_of_safety_measures: boolean;
  reviewed_guidelines: boolean;
  ack_job_start_code: boolean;
  ack_ppe_on_site: boolean;
} {
  return {
    aware_of_safety_measures: map.aware_of_safety_measures,
    reviewed_guidelines: map.reviewed_guidelines,
    ack_job_start_code: map.ack_job_start_code,
    ack_ppe_on_site: map.ack_ppe_on_site,
  };
}
