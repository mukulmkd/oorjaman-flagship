import { useMutation, useQuery } from "@tanstack/react-query";
import {
  queryKeys,
  supportApi,
  type SupportConversationPriority,
  type SupportConversationWithCustomer,
} from "@oorjaman/api";
import { useSupabase } from "../lib/supabase-context";

type Props = {
  conversation: SupportConversationWithCustomer;
  agentUserId: string | null;
  onUpdated: () => void;
};

const PRIORITIES: SupportConversationPriority[] = ["normal", "high", "urgent"];

export function SupportThreadToolbar({ conversation, agentUserId, onUpdated }: Props) {
  const supabase = useSupabase();

  const agentsQ = useQuery({
    queryKey: queryKeys.support.agents(),
    queryFn: () => supportApi.listSupportDeskAgents(supabase!),
    enabled: Boolean(supabase),
  });

  const claimMut = useMutation({
    mutationFn: () => supportApi.adminClaimSupportConversation(supabase!, conversation.id),
    onSuccess: onUpdated,
  });

  const assignMut = useMutation({
    mutationFn: (adminUserId: string | null) =>
      supportApi.adminAssignSupportConversation(supabase!, conversation.id, adminUserId),
    onSuccess: onUpdated,
  });

  const priorityMut = useMutation({
    mutationFn: (priority: SupportConversationPriority) =>
      supportApi.adminUpdateSupportPriority(supabase!, conversation.id, priority),
    onSuccess: onUpdated,
  });

  const isMine = agentUserId && conversation.assigned_admin_user_id === agentUserId;
  const unassigned = !conversation.assigned_admin_user_id;

  return (
    <div className="support-thread-toolbar">
      {unassigned ? (
        <button
          type="button"
          className="support-inbox-btn-outline"
          disabled={claimMut.isPending}
          onClick={() => claimMut.mutate()}
        >
          Claim
        </button>
      ) : null}
      {!unassigned && !isMine ? (
        <button
          type="button"
          className="support-inbox-btn-outline"
          disabled={claimMut.isPending}
          onClick={() => claimMut.mutate()}
        >
          Take over
        </button>
      ) : null}
      <label className="support-thread-toolbar-field">
        <span className="support-thread-toolbar-label">Assign</span>
        <select
          className="support-thread-toolbar-select"
          value={conversation.assigned_admin_user_id ?? ""}
          disabled={assignMut.isPending}
          onChange={(e) => {
            const v = e.target.value;
            assignMut.mutate(v ? v : null);
          }}
        >
          <option value="">Unassigned</option>
          {(agentsQ.data ?? []).map((a) => (
            <option key={a.id} value={a.id}>
              {a.full_name?.trim() || a.email || a.phone || a.id.slice(0, 8)}
            </option>
          ))}
        </select>
      </label>
      <label className="support-thread-toolbar-field">
        <span className="support-thread-toolbar-label">Priority</span>
        <select
          className="support-thread-toolbar-select"
          value={(conversation as { priority?: string }).priority ?? "normal"}
          disabled={priorityMut.isPending}
          onChange={(e) => priorityMut.mutate(e.target.value as SupportConversationPriority)}
        >
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
