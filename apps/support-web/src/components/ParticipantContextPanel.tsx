import type {
  SupportConversationWithParticipant,
  SupportDeskCustomerContext,
  SupportDeskTechnicianContext,
} from "@oorjaman/api";
import { isTechnicianSupportConversation } from "@oorjaman/api";
import { CustomerContextPanel } from "./CustomerContextPanel";
import { TechnicianContextPanel } from "./TechnicianContextPanel";

type Props = {
  conversation: SupportConversationWithParticipant;
  customerContext: SupportDeskCustomerContext | undefined;
  technicianContext: SupportDeskTechnicianContext | undefined;
  loading: boolean;
  contextError: Error | null;
};

export function ParticipantContextPanel({
  conversation,
  customerContext,
  technicianContext,
  loading,
  contextError,
}: Props) {
  if (isTechnicianSupportConversation(conversation)) {
    return (
      <TechnicianContextPanel
        conversation={conversation}
        context={technicianContext}
        loading={loading}
        contextError={contextError}
      />
    );
  }

  return (
    <CustomerContextPanel
      conversation={conversation}
      context={customerContext}
      loading={loading}
    />
  );
}
