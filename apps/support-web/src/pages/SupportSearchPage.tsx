import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys, supportApi } from "@oorjaman/api";
import { PageHeader } from "@oorjaman/web-ui";
import { CustomerContextPanel } from "../components/CustomerContextPanel";
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

type SearchMode = "customers" | "conversations";

const CUSTOMER_SEARCH_FIELDS = [
  "Name on the customer profile (full or partial, e.g. “Rahul” or “Rahul Sharma”)",
  "Login name on the app account (if different from profile name)",
  "Email on the profile or login",
  "Phone on the profile (alternate) or login number (digits, e.g. 98765…)",
] as const;

const CONVERSATION_SEARCH_FIELDS = [
  "Chat subject or what the customer wrote in the ticket",
  "Support category (e.g. billing, booking)",
  "Booking reference code (e.g. OOR-…)",
  "Same customer fields as above (name, email, phone)",
  "Conversation ID (UUID) if you have it from a link",
] as const;

function SupportSearchGuide({ mode }: { mode: SearchMode }) {
  const fields = mode === "customers" ? CUSTOMER_SEARCH_FIELDS : CONVERSATION_SEARCH_FIELDS;
  return (
    <aside className="support-search-guide" aria-label="How search works">
      <p className="support-search-guide-title">
        {mode === "customers" ? "Customers tab searches by" : "Conversations tab searches by"}
      </p>
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
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

  const customerSearchQ = useQuery({
    queryKey: queryKeys.support.customerSearch(query),
    queryFn: () => supportApi.searchSupportDeskCustomers(supabase!, query, { limit: 30 }),
    enabled: Boolean(supabase && mode === "customers" && query.length >= 2),
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

  const profile = profileQ.data;
  const primaryConv =
    profile?.conversations.find((c) => c.id === selectedConversationId) ??
    profile?.conversations.find((c) => isLiveChat(c.status)) ??
    profile?.conversations[0] ??
    null;

  const contextQ = useQuery({
    queryKey: primaryConv ? queryKeys.support.deskContext(primaryConv.id) : [],
    queryFn: () => supportApi.getSupportDeskCustomerContext(supabase!, primaryConv!),
    enabled: Boolean(supabase && primaryConv),
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
  const conversationSearchLoading =
    canSearch && mode === "conversations" && conversationSearchQ.isFetching;

  return (
    <div className="support-search-page">
      <PageHeader
        title="Search"
        subtitle="Look up by profile name, login phone/email, booking ref, or chat subject - then review bookings and AMC."
      />

      <SupportSearchGuide mode={mode} />

      <form
        className="support-search-form"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(input.trim());
          setSelectedCustomerId(null);
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
              : "Chat subject, booking ref (OOR-…), name, phone, email…"
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
                  email, or phone - not chat subject (use Conversations for that).
                </p>
              ) : null}
              {customerSearchLoading ? (
                <p className="support-inbox-muted">Searching customers…</p>
              ) : null}
              {canSearch && !customerSearchLoading && (customerSearchQ.data ?? []).length === 0 ? (
                <div className="support-search-no-results">
                  <p>No customer profile matches “{query}”.</p>
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
          ) : (
            <>
              {!canSearch ? (
                <p className="support-inbox-muted">
                  Enter at least 2 characters and press Search. Matches chat subject, ticket text,
                  category, booking ref, or customer contact fields.
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
                    <strong>Customers</strong> and search by phone or email.
                  </p>
                </div>
              ) : null}
              <ul className="support-search-results">
                {(conversationSearchQ.data ?? []).map((c) => {
                  const name = c.customer?.display_name?.trim() || "Customer";
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        className={`support-search-result support-search-result-btn${
                          selectedConversationId === c.id ? " support-search-result-active" : ""
                        }`}
                        onClick={() => {
                          setSelectedConversationId(c.id);
                          if (c.customer_id) setSelectedCustomerId(c.customer_id);
                        }}
                      >
                        <div className="support-search-result-top">
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
          {!selectedCustomerId && !selectedConversationId ? (
            <div className="support-chat-dock-hint">
              <p>Select a customer or conversation to view full details.</p>
              <p className="support-inbox-muted">
                Active chats open in the window at the bottom-right so you can keep searching.
              </p>
            </div>
          ) : null}

          {selectedCustomerId && profileQ.isPending ? (
            <p className="support-inbox-muted">Loading customer profile…</p>
          ) : null}

          {profile ? (
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

          {mode === "conversations" && selectedConversationId && !selectedCustomerId ? (
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
