import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys, supportApi } from "@oorjaman/api";
import { PageHeader } from "@oorjaman/web-ui";
import { CustomerContextPanel } from "../components/CustomerContextPanel";
import { ParticipantContextPanel } from "../components/ParticipantContextPanel";
import { SupportSlaBadges } from "../components/SupportSlaBadges";
import { useActiveChat } from "../lib/active-chat-context";
import { useSupabase } from "../lib/supabase-context";
import "./support-inbox.css";
import "../components/support-chat-dock.css";

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

type SearchMode = "customers" | "technicians" | "conversations";

const CUSTOMER_SEARCH_FIELDS = [
  "Name on the customer profile (full or partial, e.g. “Rahul” or “Rahul Sharma”)",
  "Login name on the app account (if different from profile name)",
  "Email on the profile or login",
  "Phone on the profile (alternate) or login number (digits, e.g. 98765…)",
] as const;

const TECHNICIAN_SEARCH_FIELDS = [
  "Name on the technician profile (as per Aadhaar / onboarding)",
  "Employee code",
  "Email or personal phone on the profile",
  "Login phone or email on the app account",
  "Partner vendor business or trade name",
] as const;

const CONVERSATION_SEARCH_FIELDS = [
  "Chat subject or what they wrote in the ticket",
  "Support category (e.g. billing, job, earnings)",
  "Booking reference code (e.g. OM-…)",
  "Customer or technician profile fields (name, email, phone)",
  "Partner vendor name",
  "Conversation ID (UUID) if you have it from a link",
] as const;

function SupportSearchGuide({ mode }: { mode: SearchMode }) {
  const fields =
    mode === "customers"
      ? CUSTOMER_SEARCH_FIELDS
      : mode === "technicians"
        ? TECHNICIAN_SEARCH_FIELDS
        : CONVERSATION_SEARCH_FIELDS;
  const title =
    mode === "customers"
      ? "Customers tab searches by"
      : mode === "technicians"
        ? "Technicians tab searches by"
        : "Conversations tab searches by";
  return (
    <aside className="support-search-guide" aria-label="How search works">
      <p className="support-search-guide-title">{title}</p>
      <ul className="support-search-guide-list">
        {fields.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {mode === "customers" ? (
        <p className="support-search-guide-tip">
          Historical chats appear after you select a customer. If a first name alone returns nothing,
          try their <strong>phone or email</strong>, or switch to <strong>Conversations</strong> and
          search the chat subject.
        </p>
      ) : mode === "technicians" ? (
        <p className="support-search-guide-tip">
          Historical chats appear after you select a technician. Try <strong>employee code</strong>,{" "}
          <strong>phone</strong>, or the <strong>partner vendor name</strong> if the profile name alone
          does not match.
        </p>
      ) : (
        <p className="support-search-guide-tip">
          Use this tab when you remember the issue or booking ref but not the exact profile name.
        </p>
      )}
    </aside>
  );
}

export function SupportSearchPage() {
  const supabase = useSupabase();
  const { openChat, isLiveChat } = useActiveChat();
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<SearchMode>("customers");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedTechnicianId, setSelectedTechnicianId] = useState<string | null>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

  const customerSearchQ = useQuery({
    queryKey: queryKeys.support.customerSearch(query),
    queryFn: () => supportApi.searchSupportDeskCustomers(supabase!, query, { limit: 30 }),
    enabled: Boolean(supabase && mode === "customers" && query.length >= 2),
  });

  const technicianSearchQ = useQuery({
    queryKey: queryKeys.support.technicianSearch(query),
    queryFn: () => supportApi.searchSupportDeskTechnicians(supabase!, query, { limit: 30 }),
    enabled: Boolean(supabase && mode === "technicians" && query.length >= 2),
  });

  const conversationSearchQ = useQuery({
    queryKey: queryKeys.support.search(query),
    queryFn: () => supportApi.searchSupportDesk(supabase!, query, { limit: 50 }),
    enabled: Boolean(supabase && mode === "conversations" && query.length >= 2),
  });

  const profileQ = useQuery({
    queryKey: selectedCustomerId ? queryKeys.support.customerProfile(selectedCustomerId) : [],
    queryFn: () => supportApi.getSupportDeskCustomerProfile(supabase!, selectedCustomerId!),
    enabled: Boolean(supabase && selectedCustomerId),
  });

  const technicianProfileQ = useQuery({
    queryKey: selectedTechnicianId ? queryKeys.support.technicianProfile(selectedTechnicianId) : [],
    queryFn: () => supportApi.getSupportDeskTechnicianProfile(supabase!, selectedTechnicianId!),
    enabled: Boolean(supabase && selectedTechnicianId),
  });

  const profile = profileQ.data;
  const technicianProfile = technicianProfileQ.data;
  const primaryConv =
    profile?.conversations.find((c) => c.id === selectedConversationId) ??
    profile?.conversations.find((c) => isLiveChat(c.status)) ??
    profile?.conversations[0] ??
    null;
  const technicianPrimaryConv =
    technicianProfile?.conversations.find((c) => c.id === selectedConversationId) ??
    technicianProfile?.conversations.find((c) => isLiveChat(c.status)) ??
    technicianProfile?.conversations[0] ??
    null;

  const contextQ = useQuery({
    queryKey: primaryConv ? [...queryKeys.support.deskContext(primaryConv.id), "customer"] : [],
    queryFn: () => supportApi.getSupportDeskCustomerContext(supabase!, primaryConv!),
    enabled: Boolean(supabase && primaryConv && !selectedTechnicianId),
  });

  const technicianContextQ = useQuery({
    queryKey: technicianPrimaryConv
      ? [...queryKeys.support.deskContext(technicianPrimaryConv.id), "technician"]
      : [],
    queryFn: () => supportApi.getSupportDeskTechnicianContext(supabase!, technicianPrimaryConv!),
    enabled: Boolean(supabase && technicianPrimaryConv && selectedTechnicianId),
  });

  const openConversationInDock = (conversationId: string, status: string) => {
    if (isLiveChat(status)) {
      openChat(conversationId, { expand: true });
    } else {
      openChat(conversationId, { expand: false });
    }
  };

  const canSearch = query.length >= 2;
  const customerSearchLoading = canSearch && mode === "customers" && customerSearchQ.isFetching;
  const technicianSearchLoading = canSearch && mode === "technicians" && technicianSearchQ.isFetching;
  const conversationSearchLoading =
    canSearch && mode === "conversations" && conversationSearchQ.isFetching;

  return (
    <div className="support-search-page">
      <PageHeader
        title="Search"
        subtitle="Look up customers, technicians, or chats — then review bookings, partner vendor, and support history."
      />

      <SupportSearchGuide mode={mode} />

      <form
        className="support-search-form"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(input.trim());
          setSelectedCustomerId(null);
          setSelectedTechnicianId(null);
          setSelectedConversationId(null);
        }}
      >
        <input
          className="support-search-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            mode === "customers"
              ? "Profile name, login name, email, or phone…"
              : mode === "technicians"
                ? "Technician name, employee code, phone, email, vendor…"
                : "Chat subject, booking ref (OM-…), name, phone, vendor…"
          }
          aria-label="Search"
        />
        <button type="submit" className="support-inbox-btn-primary">
          Search
        </button>
      </form>

      <div className="support-inbox-tabs" role="tablist" aria-label="Search mode">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "customers"}
          className={`support-inbox-tab${mode === "customers" ? " support-inbox-tab-active" : ""}`}
          onClick={() => setMode("customers")}
        >
          Customers
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "technicians"}
          className={`support-inbox-tab${mode === "technicians" ? " support-inbox-tab-active" : ""}`}
          onClick={() => setMode("technicians")}
        >
          Technicians
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "conversations"}
          className={`support-inbox-tab${mode === "conversations" ? " support-inbox-tab-active" : ""}`}
          onClick={() => setMode("conversations")}
        >
          Conversations
        </button>
      </div>

      <div className="support-search-layout">
        <div className="support-search-list-col">
          {mode === "customers" ? (
            <>
              {!canSearch ? (
                <p className="support-inbox-muted">
                  Enter at least 2 characters and press Search. Matches profile name, login name,
                  email, or phone — not chat subject (use Conversations for that).
                </p>
              ) : null}
              {customerSearchLoading ? (
                <p className="support-inbox-muted">Searching customers…</p>
              ) : null}
              {canSearch && !customerSearchLoading && (customerSearchQ.data ?? []).length === 0 ? (
                <div className="support-search-no-results">
                  <p>No customer profile matches "{query}".</p>
                  <p className="support-inbox-muted">
                    Try the phone or email they use in the app, the full name as on their profile,
                    or open the <strong>Conversations</strong> tab to search by chat subject or
                    booking reference.
                  </p>
                </div>
              ) : null}
              <ul className="support-search-results">
                {(customerSearchQ.data ?? []).map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className={`support-search-result support-search-result-btn${
                        selectedCustomerId === c.id ? " support-search-result-active" : ""
                      }`}
                      onClick={() => {
                        setSelectedCustomerId(c.id);
                        setSelectedTechnicianId(null);
                        setSelectedConversationId(null);
                      }}
                    >
                      <div className="support-search-result-top">
                        <strong>{c.display_name?.trim() || "Customer"}</strong>
                        {c.open_conversation_count > 0 ? (
                          <span className="support-search-open-badge">
                            {c.open_conversation_count} open
                          </span>
                        ) : null}
                      </div>
                      <div className="support-inbox-row-meta">
                        {c.contact_email ?? c.alternate_phone ?? "No contact on file"}
                      </div>
                      {c.last_conversation_at ? (
                        <div className="support-inbox-row-meta">
                          Last chat {formatWhen(c.last_conversation_at)}
                        </div>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : mode === "technicians" ? (
            <>
              {!canSearch ? (
                <p className="support-inbox-muted">
                  Enter at least 2 characters and press Search. Matches technician name, employee
                  code, phone, email, or partner vendor — not chat subject (use Conversations for
                  that).
                </p>
              ) : null}
              {technicianSearchLoading ? (
                <p className="support-inbox-muted">Searching technicians…</p>
              ) : null}
              {canSearch && !technicianSearchLoading && (technicianSearchQ.data ?? []).length === 0 ? (
                <div className="support-search-no-results">
                  <p>No technician profile matches “{query}”.</p>
                  <p className="support-inbox-muted">
                    Try employee code, phone, email, or the <strong>partner vendor name</strong>, or
                    open <strong>Conversations</strong> to search by chat subject.
                  </p>
                </div>
              ) : null}
              <ul className="support-search-results">
                {(technicianSearchQ.data ?? []).map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      className={`support-search-result support-search-result-btn${
                        selectedTechnicianId === t.id ? " support-search-result-active" : ""
                      }`}
                      onClick={() => {
                        setSelectedTechnicianId(t.id);
                        setSelectedCustomerId(null);
                        setSelectedConversationId(null);
                      }}
                    >
                      <div className="support-search-result-top">
                        <strong>{t.display_name?.trim() || "Technician"}</strong>
                        {t.open_conversation_count > 0 ? (
                          <span className="support-search-open-badge">
                            {t.open_conversation_count} open
                          </span>
                        ) : null}
                      </div>
                      <div className="support-inbox-row-meta">
                        {t.vendor_name ? `${t.vendor_name} · ` : ""}
                        {t.contact_email ?? t.personal_phone ?? "No contact on file"}
                      </div>
                      {t.employee_code ? (
                        <div className="support-inbox-row-meta">Code {t.employee_code}</div>
                      ) : null}
                      {t.last_conversation_at ? (
                        <div className="support-inbox-row-meta">
                          Last chat {formatWhen(t.last_conversation_at)}
                        </div>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              {!canSearch ? (
                <p className="support-inbox-muted">
                  Enter at least 2 characters and press Search. Matches chat subject, ticket text,
                  category, booking ref, or customer/technician contact fields.
                </p>
              ) : null}
              {conversationSearchLoading ? (
                <p className="support-inbox-muted">Searching conversations…</p>
              ) : null}
              {canSearch && !conversationSearchLoading && (conversationSearchQ.data ?? []).length === 0 ? (
                <div className="support-search-no-results">
                  <p>No support conversations match “{query}”.</p>
                  <p className="support-inbox-muted">
                    Try a word from the chat subject, the booking reference, or switch to{" "}
                    <strong>Customers</strong> or <strong>Technicians</strong>.
                  </p>
                </div>
              ) : null}
              <ul className="support-search-results">
                {(conversationSearchQ.data ?? []).map((c) => {
                  const name = supportApi.supportParticipantDisplayName(c);
                  const audienceLabel = supportApi.supportParticipantAudienceLabel(c.participant_audience);
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        className={`support-search-result support-search-result-btn${
                          selectedConversationId === c.id ? " support-search-result-active" : ""
                        }`}
                        onClick={() => {
                          setSelectedConversationId(c.id);
                          setSelectedCustomerId(c.customer_id);
                          setSelectedTechnicianId(c.technician_id);
                        }}
                      >
                        <div className="support-search-result-top">
                          <span
                            className={`support-inbox-audience-badge support-inbox-audience-badge-${c.participant_audience}`}
                          >
                            {audienceLabel}
                          </span>
                          <strong>{name}</strong>
                          <span className={`support-inbox-status support-inbox-status-${c.status}`}>
                            {c.status}
                          </span>
                        </div>
                        <SupportSlaBadges conversation={c} />
                        <div className="support-inbox-row-subject">{c.subject ?? c.category_slug}</div>
                        <div className="support-inbox-row-meta">{formatWhen(c.last_message_at)}</div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>

        <div className="support-search-detail-col">
          {!selectedCustomerId && !selectedTechnicianId && !selectedConversationId ? (
            <div className="support-chat-dock-hint">
              <p>Select a customer, technician, or conversation to view full details.</p>
              <p className="support-inbox-muted">
                Active chats open in the window at the bottom-right so you can keep searching.
              </p>
            </div>
          ) : null}

          {selectedCustomerId && profileQ.isPending ? (
            <p className="support-inbox-muted">Loading customer profile…</p>
          ) : null}

          {selectedTechnicianId && technicianProfileQ.isPending ? (
            <p className="support-inbox-muted">Loading technician profile…</p>
          ) : null}

          {technicianProfile ? (
            <>
              <div className="support-search-profile-header">
                <div>
                  <h2 className="support-search-profile-name">
                    {technicianProfile.technician.display_name?.trim() || "Technician"}
                  </h2>
                  <p className="support-inbox-muted">
                    {technicianProfile.technician.vendor_name
                      ? `${technicianProfile.technician.vendor_name} · `
                      : ""}
                    {technicianProfile.technician.contact_email ?? "—"}
                    {technicianProfile.technician.personal_phone
                      ? ` · ${technicianProfile.technician.personal_phone}`
                      : ""}
                  </p>
                </div>
                {technicianProfile.primary_conversation_id ? (
                  <button
                    type="button"
                    className="support-inbox-btn-primary"
                    onClick={() => {
                      const conv = technicianProfile.conversations.find(
                        (c) => c.id === technicianProfile.primary_conversation_id,
                      );
                      if (conv) openConversationInDock(conv.id, conv.status);
                    }}
                  >
                    {technicianProfile.conversations.some((c) => isLiveChat(c.status))
                      ? "Open live chat"
                      : "Open chat"}
                  </button>
                ) : null}
              </div>

              <h3 className="support-context-subtitle">Support conversations</h3>
              <ul className="support-search-conv-pick-list">
                {technicianProfile.conversations.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className={`support-search-conv-pick${
                        (selectedConversationId ?? technicianPrimaryConv?.id) === c.id
                          ? " support-search-conv-pick-active"
                          : ""
                      }`}
                      onClick={() => setSelectedConversationId(c.id)}
                    >
                      <span>{c.subject ?? c.category_slug}</span>
                      <span className={`support-inbox-status support-inbox-status-${c.status}`}>
                        {c.status}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>

              {technicianPrimaryConv ? (
                <ParticipantContextPanel
                  conversation={technicianPrimaryConv}
                  customerContext={undefined}
                  technicianContext={technicianContextQ.data}
                  loading={technicianContextQ.isPending}
                  contextError={(technicianContextQ.error as Error | null) ?? null}
                />
              ) : (
                <p className="support-inbox-muted">No support conversations for this technician yet.</p>
              )}

              {technicianPrimaryConv ? (
                <button
                  type="button"
                  className="support-inbox-btn-outline support-search-open-chat"
                  onClick={() =>
                    openConversationInDock(technicianPrimaryConv.id, technicianPrimaryConv.status)
                  }
                >
                  {isLiveChat(technicianPrimaryConv.status)
                    ? "Open in chat window"
                    : "View in chat window"}
                </button>
              ) : null}
            </>
          ) : null}

          {profile && !selectedTechnicianId ? (
            <>
              <div className="support-search-profile-header">
                <div>
                  <h2 className="support-search-profile-name">
                    {profile.customer.display_name?.trim() || "Customer"}
                  </h2>
                  <p className="support-inbox-muted">
                    {profile.customer.contact_email ?? "—"}
                    {profile.customer.alternate_phone
                      ? ` · ${profile.customer.alternate_phone}`
                      : ""}
                  </p>
                </div>
                {profile.primary_conversation_id ? (
                  <button
                    type="button"
                    className="support-inbox-btn-primary"
                    onClick={() => {
                      const conv = profile.conversations.find(
                        (c) => c.id === profile.primary_conversation_id,
                      );
                      if (conv) openConversationInDock(conv.id, conv.status);
                    }}
                  >
                    {profile.conversations.some((c) => isLiveChat(c.status))
                      ? "Open live chat"
                      : "Open chat"}
                  </button>
                ) : null}
              </div>

              <h3 className="support-context-subtitle">Support conversations</h3>
              <ul className="support-search-conv-pick-list">
                {profile.conversations.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className={`support-search-conv-pick${
                        (selectedConversationId ?? primaryConv?.id) === c.id
                          ? " support-search-conv-pick-active"
                          : ""
                      }`}
                      onClick={() => setSelectedConversationId(c.id)}
                    >
                      <span>{c.subject ?? c.category_slug}</span>
                      <span className={`support-inbox-status support-inbox-status-${c.status}`}>
                        {c.status}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>

              {primaryConv ? (
                <CustomerContextPanel
                  conversation={primaryConv}
                  context={contextQ.data}
                  loading={contextQ.isPending}
                />
              ) : (
                <p className="support-inbox-muted">No support conversations for this customer yet.</p>
              )}

              {primaryConv ? (
                <button
                  type="button"
                  className="support-inbox-btn-outline support-search-open-chat"
                  onClick={() => openConversationInDock(primaryConv.id, primaryConv.status)}
                >
                  {isLiveChat(primaryConv.status)
                    ? "Open in chat window"
                    : "View in chat window"}
                </button>
              ) : null}
            </>
          ) : null}

          {mode === "conversations" &&
          selectedConversationId &&
          !selectedCustomerId &&
          !selectedTechnicianId ? (
            <div className="support-chat-dock-hint">
              <p>Conversation selected.</p>
              <button
                type="button"
                className="support-inbox-btn-primary"
                onClick={() => {
                  const c = conversationSearchQ.data?.find((x) => x.id === selectedConversationId);
                  if (c) openConversationInDock(c.id, c.status);
                }}
              >
                Open in chat window
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
