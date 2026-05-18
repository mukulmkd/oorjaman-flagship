import type { SupportConversationWithCustomer, SupportDeskCustomerContext } from "@oorjaman/api";
import { adminPortalUrl } from "../lib/portal-urls";
import { SupportConversationDeskMeta } from "./SupportConversationDeskMeta";

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
  conversation: SupportConversationWithCustomer;
  context: SupportDeskCustomerContext | undefined;
  loading: boolean;
};

export function CustomerContextPanel({ conversation, context, loading }: Props) {
  const customer = conversation.customer;
  const name = customer?.display_name?.trim() || "Customer";

  return (
    <aside className="support-context-panel">
      <h2 className="support-context-title">Customer</h2>
      <dl className="support-context-dl">
        <dt>Name</dt>
        <dd>{name}</dd>
        {customer?.contact_email ? (
          <>
            <dt>Email</dt>
            <dd>
              <a href={`mailto:${customer.contact_email}`}>{customer.contact_email}</a>
            </dd>
          </>
        ) : null}
        {customer?.alternate_phone ? (
          <>
            <dt>Phone</dt>
            <dd>{customer.alternate_phone}</dd>
          </>
        ) : null}
      </dl>

      <h3 className="support-context-subtitle">Intake</h3>
      <p className="support-context-intake-meta">
        {conversation.category_slug}
        {conversation.subject ? ` · ${conversation.subject}` : ""}
      </p>
      <p className="support-context-intake-body">{conversation.details_text}</p>

      <SupportConversationDeskMeta conversation={conversation} />

      {loading ? <p className="support-inbox-muted">Loading context…</p> : null}

      {context?.service_address ? (
        <>
          <h3 className="support-context-subtitle">Service site</h3>
          <div className="support-context-card">
            <div className="support-context-card-main">{context.service_address.label}</div>
            <div className="support-context-card-meta">{context.service_address.formatted}</div>
            {context.service_address.photo_count > 0 ? (
              <div className="support-context-card-meta">
                {context.service_address.photo_count} site photo
                {context.service_address.photo_count === 1 ? "" : "s"} on file
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      {context && context.recent_bookings.length > 0 ? (
        <>
          <h3 className="support-context-subtitle">Recent bookings</h3>
          {context.recent_bookings.map((b) => (
            <div key={b.id} className="support-context-card">
              <div className="support-context-card-main">
                {b.reference_code ?? b.id.slice(0, 8)}
              </div>
              <div className="support-context-card-meta">
                {b.status} · {formatWhen(b.scheduled_start)}
              </div>
            </div>
          ))}
          <a
            className="support-context-link"
            href={adminPortalUrl("/dashboard/bookings")}
            target="_blank"
            rel="noreferrer"
          >
            All bookings in operations console ↗
          </a>
        </>
      ) : null}

      {context && context.active_subscriptions.length > 0 ? (
        <>
          <h3 className="support-context-subtitle">Active AMC</h3>
          {context.active_subscriptions.map((s) => (
            <div key={s.id} className="support-context-card">
              <div className="support-context-card-main">{s.plan_name}</div>
              <div className="support-context-card-meta">
                {s.status} · ends {formatWhen(s.ends_at)}
              </div>
            </div>
          ))}
        </>
      ) : null}

      {context?.booking && !context.recent_bookings.some((b) => b.id === context.booking?.id) ? (
        <>
          <h3 className="support-context-subtitle">Linked booking</h3>
          <div className="support-context-card">
            <div className="support-context-card-main">
              {context.booking.reference_code ?? context.booking.id.slice(0, 8)}
            </div>
            <div className="support-context-card-meta">
              {context.booking.status} · {formatWhen(context.booking.scheduled_start)}
            </div>
          </div>
        </>
      ) : null}

      {context && context.recent_resolved.length > 0 ? (
        <>
          <h3 className="support-context-subtitle">Past resolved chats</h3>
          {context.recent_resolved.map((r) => (
            <div key={r.id} className="support-context-card">
              <div className="support-context-card-main">{r.subject ?? r.category_slug}</div>
              <div className="support-context-card-meta">{formatWhen(r.updated_at)}</div>
            </div>
          ))}
        </>
      ) : null}
    </aside>
  );
}
