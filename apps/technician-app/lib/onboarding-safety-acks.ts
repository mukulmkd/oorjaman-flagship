/** Mandatory safety-awareness confirmations on technician onboarding (Safety step). */

export const ONBOARDING_SAFETY_ACKS = [
  {
    key: "safety_ack_pre_start_checklist",
    label:
      "I will complete the on-site safety checklist before starting each job (same checks used when you tap Start on a visit).",
  },
  {
    key: "safety_ack_job_start_code",
    label:
      "I understand I must verify the customer's Job Start Code in the OorjaMan app before beginning on-site work.",
  },
  {
    key: "safety_ack_safety_measures",
    label: "I am aware of the safety measures required for rooftop and solar panel cleaning work.",
  },
  {
    key: "safety_ack_reviewed_guidelines",
    label: "I have reviewed my employer and OorjaMan field-safety expectations for assigned visits.",
  },
] as const;

export type OnboardingSafetyAckKey = (typeof ONBOARDING_SAFETY_ACKS)[number]["key"];

export type OnboardingSafetyAckForm = Record<OnboardingSafetyAckKey, boolean>;

export function emptyOnboardingSafetyAcks(): OnboardingSafetyAckForm {
  return ONBOARDING_SAFETY_ACKS.reduce(
    (acc, item) => {
      acc[item.key] = false;
      return acc;
    },
    {} as OnboardingSafetyAckForm,
  );
}

export function allOnboardingSafetyAcksChecked(form: OnboardingSafetyAckForm): boolean {
  return ONBOARDING_SAFETY_ACKS.every((item) => form[item.key]);
}
