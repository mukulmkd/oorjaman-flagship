import { useQuery } from "@tanstack/react-query";
import {
  buildSupportConversationClosureSummary,
  formatSupportCsatStars,
  listSupportConversationEvents,
  queryKeys,
  type SupportConversationRow,
  type SupportConversationWithCustomer,
} from "@oorjaman/api";
import { useSupabase } from "../lib/supabase-context";

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

type Props = {
  conversation: SupportConversationWithCustomer | SupportConversationRow;
};

export function SupportConversationDeskMeta({ conversation }: Props) {
  const supabase = useSupabase();

  const closureQ = useQuery({
    queryKey: [
      ...queryKeys.support.closure(conversation.id),
      conversation.status,
      conversation.csat_submitted_at,
      conversation.resolved_at,
      conversation.resolved_by_user_id,
    ],
    queryFn: () => buildSupportConversationClosureSummary(supabase!, conversation),
    enabled: Boolean(supabase),
  });

  const eventsQ = useQuery({
    queryKey: queryKeys.support.events(conversation.id),
    queryFn: () => listSupportConversationEvents(supabase!, conversation.id),
    enabled: Boolean(supabase),
  });

  const closure = closureQ.data;
  const showOutcome =
    conversation.status === "resolved" || Boolean(conversation.csat_submitted_at);

  return (
    <>
      {showOutcome ? (
        <>
          <h3 className="support-context-subtitle">Conversation outcome</h3>
          {closureQ.isPending ? (
            <p className="support-inbox-muted">Loading outcome…</p>
          ) : closure ? (
            <div className="support-outcome-card">
              {conversation.status === "resolved" ? (
                <>
                  <div className="support-outcome-row">
                    <span className="support-outcome-label">Closed</span>
                    <span className="support-outcome-value">
                      {closure.closed_at ? formatWhen(closure.closed_at) : "-"}
                    </span>
                  </div>
                  <div className="support-outcome-row">
                    <span className="support-outcome-label">Closed by</span>
                    <span className="support-outcome-value">
                      {closure.closed_by_display_name ?? "-"}
                    </span>
                  </div>
                  {closure.close_reason_label ? (
                    <div className="support-outcome-row">
                      <span className="support-outcome-label">Reason</span>
                      <span className="support-outcome-value">{closure.close_reason_label}</span>
                    </div>
                  ) : null}
                  {closure.resolution_tag_label && closure.resolution_tag_label !== "-" ? (
                    <div className="support-outcome-row">
                      <span className="support-outcome-label">Resolution</span>
                      <span className="support-outcome-value">{closure.resolution_tag_label}</span>
                    </div>
                  ) : null}
                </>
              ) : null}

              <div className="support-outcome-row support-outcome-row-csat">
                <span className="support-outcome-label">Customer rating</span>
                {closure.csat ? (
                  <span className="support-outcome-csat">
                    <span className="support-outcome-stars" aria-hidden>
                      {formatSupportCsatStars(closure.csat.rating)}
                    </span>
                    <span className="support-outcome-rating-num">{closure.csat.rating}/5</span>
                  </span>
                ) : closure.pending_csat ? (
                  <span className="support-inbox-muted">Awaiting customer rating</span>
                ) : (
                  <span className="support-inbox-muted">No rating submitted</span>
                )}
              </div>
              {closure.csat?.comment ? (
                <p className="support-outcome-csat-comment">&ldquo;{closure.csat.comment}&rdquo;</p>
              ) : null}
              {closure.csat?.submitted_at ? (
                <p className="support-outcome-csat-meta">
                  Rated {formatWhen(closure.csat.submitted_at)}
                </p>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}

      <h3 className="support-context-subtitle">Activity log</h3>
      {eventsQ.isPending ? (
        <p className="support-inbox-muted">Loading activity…</p>
      ) : (eventsQ.data ?? []).length === 0 ? (
        <p className="support-inbox-muted">No activity recorded yet.</p>
      ) : (
        <ol className="support-audit-list">
          {(eventsQ.data ?? []).map((ev) => (
            <li key={ev.id} className="support-audit-item">
              <div className="support-audit-summary">{ev.summary}</div>
              <div className="support-audit-meta">
                {formatWhen(ev.created_at)}
                {ev.actor_display_name ? ` · ${ev.actor_display_name}` : ""}
              </div>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
