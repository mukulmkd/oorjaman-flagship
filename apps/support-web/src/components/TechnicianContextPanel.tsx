import type { SupportConversationWithParticipant, SupportDeskTechnicianContext } from "@oorjaman/api";
import { supportApi } from "@oorjaman/api";
import { adminPortalUrl } from "@oorjaman/web-ui";
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

function formatVerificationStatus(status: string): string {
  return status.replace(/_/g, " ");
}

type TechnicianContact = {
  display_name: string | null;
  contact_email: string | null;
  personal_phone: string | null;
  employee_code: string | null;
  vendor_name: string | null;
};

type Props = {
  conversation: SupportConversationWithParticipant;
  context: SupportDeskTechnicianContext | undefined;
  loading: boolean;
  contextError: Error | null;
};

function resolveTechnicianContact(
  conversation: SupportConversationWithParticipant,
  context: SupportDeskTechnicianContext | undefined,
): TechnicianContact | null {
  if (conversation.technician) {
    return {
      display_name: conversation.technician.display_name,
      contact_email: conversation.technician.contact_email,
      personal_phone: conversation.technician.personal_phone,
      employee_code: conversation.technician.employee_code,
      vendor_name:
        conversation.technician.vendor_name ?? context?.vendor?.name ?? context?.technician_contact?.vendor_name ?? null,
    };
  }
  const fromContext = context?.technician_contact;
  if (fromContext) {
    return {
      ...fromContext,
      vendor_name: fromContext.vendor_name ?? context?.vendor?.name ?? null,
    };
  }
  return context?.vendor?.name
    ? {
        display_name: null,
        contact_email: null,
        personal_phone: null,
        employee_code: null,
        vendor_name: context.vendor.name,
      }
    : null;
}

export function TechnicianContextPanel({ conversation, context, loading, contextError }: Props) {
  const contact = resolveTechnicianContact(conversation, context);
  const name = contact?.display_name?.trim() || supportApi.supportParticipantDisplayName(conversation);
  const technicianId = conversation.technician_id;
  const profile = context?.technician_profile;
  const contextReady = !loading && !contextError;

  return (
    <aside className="support-context-panel">
      <h2 className="support-context-title">Technician</h2>
      <dl className="support-context-dl">
        <dt>Name</dt>
        <dd>{name}</dd>
        {contact?.employee_code ? (
          <>
            <dt>Employee code</dt>
            <dd>{contact.employee_code}</dd>
          </>
        ) : null}
        {contact?.contact_email ? (
          <>
            <dt>Email</dt>
            <dd>
              <a href={`mailto:${contact.contact_email}`}>{contact.contact_email}</a>
            </dd>
          </>
        ) : null}
        {contact?.personal_phone ? (
          <>
            <dt>Phone</dt>
            <dd>{contact.personal_phone}</dd>
          </>
        ) : null}
        {contact?.vendor_name ? (
          <>
            <dt>Partner vendor</dt>
            <dd>{contact.vendor_name}</dd>
          </>
        ) : null}
        {profile ? (
          <>
            <dt>Verification</dt>
            <dd>{formatVerificationStatus(profile.verification_status)}</dd>
            <dt>Available for jobs</dt>
            <dd>{profile.is_available ? "Yes" : "No"}</dd>
            {profile.vendor_review_status ? (
              <>
                <dt>Partner review</dt>
                <dd>{formatVerificationStatus(profile.vendor_review_status)}</dd>
              </>
            ) : null}
            {profile.years_experience != null ? (
              <>
                <dt>Experience</dt>
                <dd>
                  {profile.years_experience} year{profile.years_experience === 1 ? "" : "s"}
                </dd>
              </>
            ) : null}
            {profile.skills.length > 0 ? (
              <>
                <dt>Skills</dt>
                <dd>{profile.skills.join(", ")}</dd>
              </>
            ) : null}
          </>
        ) : null}
      </dl>

      {technicianId ? (
        <a
          className="support-context-link"
          href={adminPortalUrl(`/dashboard/technicians/item/${technicianId}`)}
          target="_blank"
          rel="noreferrer"
        >
          Full technician profile in operations console ↗
        </a>
      ) : null}

      <h3 className="support-context-subtitle">Intake</h3>
      <p className="support-context-intake-meta">
        {conversation.category_slug}
        {conversation.subject ? ` · ${conversation.subject}` : ""}
      </p>
      <p className="support-context-intake-body">{conversation.details_text}</p>

      <SupportConversationDeskMeta conversation={conversation} />

      {loading ? <p className="support-inbox-muted">Loading context…</p> : null}
      {contextError ? (
        <p className="support-inbox-error">Could not load technician context: {contextError.message}</p>
      ) : null}

      {context?.vendor ? (
        <>
          <h3 className="support-context-subtitle">Partner vendor</h3>
          <div className="support-context-card">
            <div className="support-context-card-main">{context.vendor.name ?? "Vendor"}</div>
            <a
              className="support-context-link"
              href={adminPortalUrl(`/dashboard/vendors/item/${context.vendor.id}`)}
              target="_blank"
              rel="noreferrer"
            >
              Vendor in operations console ↗
            </a>
          </div>
        </>
      ) : null}

      {contextReady && context && context.recent_jobs.length > 0 ? (
        <>
          <h3 className="support-context-subtitle">Recent assigned jobs</h3>
          {context.recent_jobs.map((job) => (
            <div key={job.id} className="support-context-card">
              <div className="support-context-card-main">
                {job.reference_code ?? job.id.slice(0, 8)}
              </div>
              <div className="support-context-card-meta">
                {job.status} · {formatWhen(job.scheduled_start)}
              </div>
              {job.customer_display_name ? (
                <div className="support-context-card-meta">Customer: {job.customer_display_name}</div>
              ) : null}
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

      {contextReady && context?.booking && !context.recent_jobs.some((j) => j.id === context.booking?.id) ? (
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

      {contextReady && context && context.recent_resolved.length > 0 ? (
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

      {contextReady && !context && technicianId ? (
        <p className="support-inbox-muted">No operational context returned for this technician.</p>
      ) : null}
    </aside>
  );
}
