import { computeSupportSlaHints, type SupportConversationRow } from "@oorjaman/api";

type Props = {
  conversation: SupportConversationRow;
};

export function SupportSlaBadges({ conversation }: Props) {
  const hints = computeSupportSlaHints(conversation);
  const badges: string[] = [];

  if (conversation.priority === "urgent") badges.push("Urgent");
  else if (conversation.priority === "high") badges.push("High");

  if (hints.wait_minutes != null && hints.wait_minutes >= 5) {
    badges.push(`Waiting ${hints.wait_minutes}m`);
  }
  if (hints.needs_first_reply) badges.push("No agent reply");
  if (hints.customer_waiting_reply) badges.push("Customer replied");

  if (badges.length === 0) return null;

  return (
    <div className="support-sla-badges">
      {badges.map((b) => (
        <span key={b} className="support-sla-badge">
          {b}
        </span>
      ))}
    </div>
  );
}
