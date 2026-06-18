import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DEFAULT_TABLE_PAGE_SIZE,
  RENEWAL_NUDGE_EVENT_TYPE,
  adminListNotificationEvents,
  adminProcessNotificationQueue,
  queryKeys,
  subscriptionApi,
  type SubscriptionRenewalNudgeCandidate,
} from "@oorjaman/api";
import { formatDisplayDate, formatDisplayDateTime } from "@oorjaman/utils";
import { Badge, Button, Card, Modal, PageHeader } from "@oorjaman/web-ui";
import { TablePaginationBar } from "@oorjaman/web-ui";
import { formatNotificationChannelLabel } from "../lib/notification-labels";
import { useSupabase } from "@oorjaman/web-ui";
import { invalidateAdminRenewalQueries } from "../lib/invalidate-admin-queries";
import "./subscription-renewals-page.css";

const RENEWAL_EVENTS_FETCH = 300;
const SCHEDULE_AND_SEND_MAX = 25;
const DELIVERY_CHANNELS = ["email", "sms", "whatsapp"] as const;

type AudienceTab = "expiring_soon" | "lapsed";

function deliveryStatusTone(status: string): "neutral" | "warning" | "success" | "danger" {
  if (status === "sent") return "success";
  if (status === "failed") return "danger";
  if (status === "queued") return "warning";
  return "neutral";
}

function deliveryStatusLabel(status: string): string {
  if (status === "sent") return "Delivered";
  if (status === "failed") return "Failed";
  if (status === "queued") return "Scheduled";
  return status;
}

function contactSummary(email: string | null, phone: string | null): string {
  const parts: string[] = [];
  if (email?.trim()) parts.push("Email");
  if (phone?.trim()) parts.push("SMS / WhatsApp");
  return parts.length ? parts.join(" · ") : "No contact on file";
}

function timingCell(c: SubscriptionRenewalNudgeCandidate): string {
  if (c.renewal_audience === "lapsed") {
    return c.days_since_expiry === 0 ? "Ended today" : `${c.days_since_expiry} days ago`;
  }
  if (c.days_to_expiry === 0) return "Today";
  return `In ${c.days_to_expiry} days`;
}

export function SubscriptionRenewalsPage() {
  const supabase = useSupabase();
  const qc = useQueryClient();

  const [audienceTab, setAudienceTab] = useState<AudienceTab>("expiring_soon");
  const [daysAhead, setDaysAhead] = useState(14);
  const [daysSinceEnded, setDaysSinceEnded] = useState(90);
  const [cooldownDays, setCooldownDays] = useState(3);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [candidatesPage, setCandidatesPage] = useState(1);
  const [renewalEventsPage, setRenewalEventsPage] = useState(1);
  const [actionFeedback, setActionFeedback] = useState<{ tone: "success" | "info" | "error"; message: string } | null>(
    null,
  );

  const expiringQuery = useQuery({
    queryKey: queryKeys.subscriptions.renewalCandidates(daysAhead),
    queryFn: () => subscriptionApi.adminListSubscriptionRenewalNudgeCandidates(supabase!, { daysAhead, limit: 300 }),
    enabled: Boolean(supabase && audienceTab === "expiring_soon"),
  });

  const lapsedQuery = useQuery({
    queryKey: queryKeys.subscriptions.renewalCandidatesLapsed(daysSinceEnded),
    queryFn: () =>
      subscriptionApi.adminListLapsedSubscriptionRenewalNudgeCandidates(supabase!, {
        daysSinceEnded,
        limit: 300,
      }),
    enabled: Boolean(supabase && audienceTab === "lapsed"),
  });

  const channelSummaryQuery = useQuery({
    queryKey: queryKeys.subscriptions.renewalChannelSummary(),
    queryFn: () => subscriptionApi.adminGetRenewalNudgeChannelSummary(supabase!),
    enabled: Boolean(supabase),
  });

  const queueStatsQuery = useQuery({
    queryKey: queryKeys.subscriptions.renewalQueueStats(),
    queryFn: () => subscriptionApi.adminGetRenewalNudgeQueueStats(supabase!),
    enabled: Boolean(supabase),
    refetchInterval: 30_000,
  });

  const eventsQuery = useQuery({
    queryKey: queryKeys.bookings.notificationEvents(RENEWAL_EVENTS_FETCH),
    queryFn: () => adminListNotificationEvents(supabase!, RENEWAL_EVENTS_FETCH),
    enabled: Boolean(supabase),
  });

  const candidatesQuery = audienceTab === "expiring_soon" ? expiringQuery : lapsedQuery;

  useEffect(() => {
    setCandidatesPage(1);
    setSelectedIds([]);
  }, [audienceTab, daysAhead, daysSinceEnded]);

  const candidatesAll = useMemo(() => candidatesQuery.data ?? [], [candidatesQuery.data]);
  const candidatesTotal = candidatesAll.length;
  const candidatesWindow = useMemo(
    () =>
      candidatesAll.slice(
        (candidatesPage - 1) * DEFAULT_TABLE_PAGE_SIZE,
        candidatesPage * DEFAULT_TABLE_PAGE_SIZE,
      ),
    [candidatesAll, candidatesPage],
  );

  const renewalEventsAll = useMemo(() => {
    return (eventsQuery.data ?? [])
      .filter((e) => e.event_type === RENEWAL_NUDGE_EVENT_TYPE)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [eventsQuery.data]);

  const renewalEventsWindow = useMemo(
    () =>
      renewalEventsAll.slice(
        (renewalEventsPage - 1) * DEFAULT_TABLE_PAGE_SIZE,
        renewalEventsPage * DEFAULT_TABLE_PAGE_SIZE,
      ),
    [renewalEventsAll, renewalEventsPage],
  );

  const allVisibleSelected =
    candidatesWindow.length > 0 && candidatesWindow.every((c) => selectedIds.includes(c.subscription_id));
  const someSelected = selectedIds.length > 0;
  const canScheduleAndSend = someSelected && selectedIds.length <= SCHEDULE_AND_SEND_MAX;

  const queueOptions = useMemo(
    () => ({
      subscriptionIds: selectedIds,
      channels: [...DELIVERY_CHANNELS],
      cooldownDays,
      daysAhead,
      daysSinceEnded,
    }),
    [selectedIds, cooldownDays, daysAhead, daysSinceEnded],
  );

  const invalidateRenewalData = async () => {
    await invalidateAdminRenewalQueries(qc);
  };

  const queueMut = useMutation({
    mutationFn: async () => subscriptionApi.adminQueueSubscriptionRenewalNudges(supabase!, queueOptions),
    onSuccess: async (queuedCount) => {
      await invalidateRenewalData();
      const skipped = selectedIds.length - queuedCount;
      if (queuedCount === 0) {
        setActionFeedback({
          tone: "info",
          message:
            skipped > 0
              ? `No reminders scheduled. Selected customer(s) were reminded within the last ${cooldownDays} day(s), or are no longer in this list.`
              : "No customers were selected.",
        });
      } else {
        setActionFeedback({
          tone: "success",
          message:
            skipped > 0
              ? `Scheduled ${queuedCount} reminder(s). ${skipped} skipped (recent reminder). Use “Send renewal queue” when ready.`
              : `Scheduled ${queuedCount} reminder(s). Use “Send renewal queue” when ready.`,
        });
      }
      setSelectedIds([]);
    },
    onError: (e: unknown) => {
      setActionFeedback({ tone: "error", message: e instanceof Error ? e.message : "Could not schedule reminders." });
    },
  });

  const scheduleAndSendMut = useMutation({
    mutationFn: async () =>
      subscriptionApi.adminScheduleAndSendSubscriptionRenewalNudges(supabase!, {
        ...queueOptions,
        processLimit: 80,
      }),
    onSuccess: async (result) => {
      await invalidateRenewalData();
      const { scheduled, skipped, delivery } = result;
      setActionFeedback({
        tone: delivery.failed > 0 ? "info" : "success",
        message: `Scheduled ${scheduled} (${skipped} skipped). Delivery: ${delivery.sent} sent, ${delivery.failed} failed, ${delivery.queued} still queued.`,
      });
      setSelectedIds([]);
    },
    onError: (e: unknown) => {
      setActionFeedback({
        tone: "error",
        message: e instanceof Error ? e.message : "Schedule & send failed.",
      });
    },
  });

  const processMut = useMutation({
    mutationFn: () =>
      adminProcessNotificationQueue(supabase!, {
        limit: 80,
        eventType: RENEWAL_NUDGE_EVENT_TYPE,
      }),
    onSuccess: async (result) => {
      await invalidateRenewalData();
      setActionFeedback({
        tone: result.failed > 0 ? "info" : "success",
        message: `Renewal queue: ${result.sent} sent, ${result.failed} failed, ${result.queued} still queued (${result.processed} processed). Other notification types were not touched.`,
      });
    },
    onError: (e: unknown) => {
      setActionFeedback({ tone: "error", message: e instanceof Error ? e.message : "Could not run delivery." });
    },
  });

  const previewMut = useMutation({
    mutationFn: async () => {
      const subscriptionId = selectedIds[0];
      if (!subscriptionId) throw new Error("Select one customer in the table to preview.");
      return subscriptionApi.adminPreviewSubscriptionRenewalNudge(supabase!, {
        subscriptionId,
        channels: [...DELIVERY_CHANNELS],
      });
    },
    onSuccess: () => setPreviewOpen(true),
    onError: (e: unknown) => {
      setActionFeedback({ tone: "error", message: e instanceof Error ? e.message : "Could not load preview." });
    },
  });

  const toggleSelectAllOnPage = () => {
    if (allVisibleSelected) {
      const pageIds = new Set(candidatesWindow.map((c) => c.subscription_id));
      setSelectedIds((prev) => prev.filter((id) => !pageIds.has(id)));
      return;
    }
    const merged = new Set(selectedIds);
    for (const c of candidatesWindow) merged.add(c.subscription_id);
    setSelectedIds([...merged]);
  };

  const previewCustomerName = useMemo(() => {
    if (!selectedIds[0]) return "Customer";
    const row = candidatesAll.find((c) => c.subscription_id === selectedIds[0]);
    return row?.customer_name ?? "Customer";
  }, [selectedIds, candidatesAll]);

  const queuedRenewalCount = queueStatsQuery.data?.queued_renewal_count ?? 0;

  return (
    <>
      <PageHeader
        title="AMC renewal reminders"
        subtitle="Remind customers before their plan ends, or after it has lapsed without a replacement."
        actions={
          <Button variant="outline" size="sm" type="button" onClick={() => void invalidateRenewalData()}>
            Refresh
          </Button>
        }
      />

      {!supabase ? (
        <Card padded>
          <p className="dash-muted-line">Connect Supabase via Vite env variables.</p>
        </Card>
      ) : (
        <div className="sr-root">
          <Card padded>
            <div className="sr-how-it-works">
              <p className="sr-how-title">How this works</p>
              <ol className="sr-steps">
                <li className="sr-step">
                  <span className="sr-step-num" aria-hidden>
                    1
                  </span>
                  <div className="sr-step-body">
                    <p className="sr-step-label">Choose a list</p>
                    <p className="sr-step-desc">
                      <strong>Expiring soon</strong> - active plans ending in your window.{" "}
                      <strong>Recently lapsed</strong> - ended with no active plan on the same site.
                    </p>
                  </div>
                </li>
                <li className="sr-step">
                  <span className="sr-step-num" aria-hidden>
                    2
                  </span>
                  <div className="sr-step-body">
                    <p className="sr-step-label">Schedule reminders</p>
                    <p className="sr-step-desc">Adds jobs to the renewal notification queue (respects cooldown).</p>
                  </div>
                </li>
                <li className="sr-step">
                  <span className="sr-step-num" aria-hidden>
                    3
                  </span>
                  <div className="sr-step-body">
                    <p className="sr-step-label">Send renewal queue</p>
                    <p className="sr-step-desc">
                      Delivers <strong>only</strong> renewal reminders - not booking or ops notifications.
                    </p>
                  </div>
                </li>
              </ol>
            </div>
          </Card>

          <Card padded className="sr-channel-card">
            <div className="sr-channel-card-head">
              <div>
                <p className="sr-section-title" style={{ margin: 0 }}>
                  Delivery channels
                </p>
                <p className="sr-section-sub" style={{ margin: "0.25rem 0 0" }}>
                  Renewal reminders use the <strong>demo</strong> pipeline today. Toggle demo/live per channel in{" "}
                  <Link to="/dashboard/feature-management">Feature management</Link>.
                </p>
              </div>
              <Badge tone="neutral">
                {queuedRenewalCount} in renewal queue
              </Badge>
            </div>
            {channelSummaryQuery.isLoading ? (
              <p className="dash-muted-line">Loading channel flags…</p>
            ) : (
              <div className="sr-channel-grid">
                {(channelSummaryQuery.data?.channels ?? []).map((ch) => (
                  <div key={ch.channel} className="sr-channel-pill">
                    <span className="sr-channel-name">{formatNotificationChannelLabel(ch.channel)}</span>
                    <span className="sr-channel-flags">
                      Demo {ch.enabled_demo ? "on" : "off"} · Live {ch.enabled_live ? "on" : "off"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <div className="sr-delivery-card">
            <div className="sr-delivery-copy">
              <p className="sr-delivery-title">Send renewal queue only</p>
              <p className="sr-delivery-desc">
                Processes up to 80 scheduled <strong>renewal</strong> jobs ({queuedRenewalCount} waiting). Does not
                process marketplace, booking, or other notification types.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              type="button"
              loading={processMut.isPending}
              disabled={queuedRenewalCount === 0 && !processMut.isPending}
              onClick={() => {
                setActionFeedback(null);
                void processMut.mutateAsync();
              }}
            >
              Send renewal queue ({queuedRenewalCount})
            </Button>
          </div>

          {actionFeedback ? (
            <p className={`sr-feedback sr-feedback--${actionFeedback.tone}`} role="status">
              {actionFeedback.message}
            </p>
          ) : null}

          <Card padded>
            <div className="sr-audience-tabs" role="tablist" aria-label="Customer list">
              <button
                type="button"
                role="tab"
                aria-selected={audienceTab === "expiring_soon"}
                className={
                  audienceTab === "expiring_soon" ? "sr-audience-tab sr-audience-tab--active" : "sr-audience-tab"
                }
                onClick={() => setAudienceTab("expiring_soon")}
              >
                Expiring soon
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={audienceTab === "lapsed"}
                className={audienceTab === "lapsed" ? "sr-audience-tab sr-audience-tab--active" : "sr-audience-tab"}
                onClick={() => setAudienceTab("lapsed")}
              >
                Recently lapsed
              </button>
            </div>

            <div className="sr-section-head" style={{ padding: 0, marginTop: "1rem" }}>
              <p className="sr-section-title">
                {audienceTab === "expiring_soon" ? "Plans ending soon" : "Plans that recently ended"}
                <span className="sr-count-pill">{candidatesTotal}</span>
              </p>
              <p className="sr-section-sub">
                {audienceTab === "expiring_soon"
                  ? `Active or trialing AMC ending in the next ${daysAhead} days.`
                  : `AMC ended in the last ${daysSinceEnded} days with no replacement on the same service address.`}
              </p>
            </div>

            <div className="sr-toolbar">
              {audienceTab === "expiring_soon" ? (
                <div className="sr-toolbar-group">
                  <span className="sr-toolbar-label">Ends within</span>
                  <div className="sr-chip-row">
                    {[3, 7, 14, 30].map((d) => (
                      <Button
                        key={d}
                        type="button"
                        size="sm"
                        variant={daysAhead === d ? "primary" : "outline"}
                        onClick={() => setDaysAhead(d)}
                      >
                        {d} days
                      </Button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="sr-toolbar-group">
                  <span className="sr-toolbar-label">Ended within</span>
                  <div className="sr-chip-row">
                    {[30, 60, 90, 180].map((d) => (
                      <Button
                        key={d}
                        type="button"
                        size="sm"
                        variant={daysSinceEnded === d ? "primary" : "outline"}
                        onClick={() => setDaysSinceEnded(d)}
                      >
                        {d} days
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              <div className="sr-toolbar-group">
                <label className="sr-toolbar-label" htmlFor="cooldownDays">
                  Skip if reminded within (days)
                </label>
                <input
                  id="cooldownDays"
                  type="number"
                  min={0}
                  max={30}
                  className="vd-select"
                  style={{ width: "4.5rem" }}
                  value={cooldownDays}
                  onChange={(e) => setCooldownDays(Math.max(0, Math.min(30, Number(e.target.value) || 0)))}
                />
              </div>
            </div>

            {candidatesQuery.isLoading ? (
              <p className="dash-table-empty">Loading customers…</p>
            ) : candidatesTotal === 0 ? (
              <p className="dash-table-empty">
                {audienceTab === "expiring_soon"
                  ? `No AMC plans ending in the next ${daysAhead} days.`
                  : `No eligible lapsed plans in the last ${daysSinceEnded} days.`}
              </p>
            ) : (
              <>
                <div className="bm-table-wrap">
                  <table className="bm-table">
                    <thead>
                      <tr>
                        <th>
                          <input
                            type="checkbox"
                            checked={allVisibleSelected}
                            aria-label="Select all on this page"
                            onChange={toggleSelectAllOnPage}
                          />
                        </th>
                        <th>Customer</th>
                        <th>{audienceTab === "expiring_soon" ? "Ends" : "Ended"}</th>
                        <th>Plan</th>
                        <th>Contract end</th>
                        <th>Can reach via</th>
                      </tr>
                    </thead>
                    <tbody>
                      {candidatesWindow.map((c) => {
                        const checked = selectedIds.includes(c.subscription_id);
                        return (
                          <tr key={c.subscription_id}>
                            <td>
                              <input
                                type="checkbox"
                                checked={checked}
                                aria-label={`Select ${c.customer_name ?? "customer"}`}
                                onChange={(e) =>
                                  setSelectedIds((prev) =>
                                    e.target.checked
                                      ? [...prev, c.subscription_id]
                                      : prev.filter((x) => x !== c.subscription_id),
                                  )
                                }
                              />
                            </td>
                            <td>{c.customer_name ?? "Customer"}</td>
                            <td>
                              {c.renewal_audience === "lapsed" && c.days_since_expiry <= 7 ? (
                                <Badge tone="warning">{timingCell(c)}</Badge>
                              ) : c.days_to_expiry === 0 && c.renewal_audience === "expiring_soon" ? (
                                <Badge tone="warning">Today</Badge>
                              ) : (
                                timingCell(c)
                              )}
                            </td>
                            <td>{c.plan_name}</td>
                            <td>{formatDisplayDate(c.ends_at)}</td>
                            <td>{contactSummary(c.customer_email, c.customer_phone)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div style={{ padding: "0.75rem 0 0" }}>
                  <TablePaginationBar page={candidatesPage} total={candidatesTotal} onPageChange={setCandidatesPage} />
                </div>
              </>
            )}

            <div className="sr-actions-bar">
              <Button
                type="button"
                size="sm"
                variant="outline"
                loading={queueMut.isPending}
                disabled={!someSelected}
                onClick={() => {
                  setActionFeedback(null);
                  void queueMut.mutateAsync();
                }}
              >
                Schedule only ({selectedIds.length})
              </Button>
              <Button
                type="button"
                size="sm"
                variant="primary"
                loading={scheduleAndSendMut.isPending}
                disabled={!canScheduleAndSend}
                onClick={() => {
                  setActionFeedback(null);
                  void scheduleAndSendMut.mutateAsync();
                }}
              >
                Schedule & send ({selectedIds.length})
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                loading={previewMut.isPending}
                disabled={selectedIds.length !== 1}
                onClick={() => {
                  setActionFeedback(null);
                  void previewMut.mutateAsync();
                }}
              >
                Preview message
              </Button>
            </div>
            {selectedIds.length > SCHEDULE_AND_SEND_MAX ? (
              <p className="dash-muted-line" style={{ fontSize: "0.8125rem", marginTop: "0.5rem" }}>
                Schedule & send supports up to {SCHEDULE_AND_SEND_MAX} customers at once. Use Schedule only for larger
                batches, then Send renewal queue.
              </p>
            ) : null}
          </Card>

          <Card padded={false}>
            <div className="sr-section-head">
              <p className="sr-section-title">Reminder history</p>
              <p className="sr-section-sub">Renewal reminder jobs only. “Scheduled” = waiting in the queue.</p>
            </div>
            {eventsQuery.isLoading ? (
              <p className="dash-table-empty">Loading history…</p>
            ) : renewalEventsAll.length === 0 ? (
              <p className="dash-table-empty">No renewal reminders have been scheduled yet.</p>
            ) : (
              <>
                <div className="bm-table-wrap">
                  <table className="bm-table">
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th>List</th>
                        <th>Status</th>
                        <th>Plan</th>
                        <th>AMC ends</th>
                        <th>Channels</th>
                        <th>Scheduled at</th>
                      </tr>
                    </thead>
                    <tbody>
                      {renewalEventsWindow.map((e) => {
                        const p =
                          e.payload && typeof e.payload === "object" && !Array.isArray(e.payload)
                            ? (e.payload as Record<string, unknown>)
                            : {};
                        const audience =
                          p.renewal_audience === "lapsed"
                            ? "Lapsed"
                            : p.renewal_audience === "expiring_soon"
                              ? "Expiring"
                              : "-";
                        const channels = Array.isArray(e.channels)
                          ? e.channels.map((ch) => formatNotificationChannelLabel(String(ch)))
                          : [];
                        return (
                          <tr key={e.id}>
                            <td>{String(p.customer_name ?? "Customer")}</td>
                            <td>{audience}</td>
                            <td>
                              <Badge tone={deliveryStatusTone(e.status)}>{deliveryStatusLabel(e.status)}</Badge>
                            </td>
                            <td>{String(p.plan_name ?? "-")}</td>
                            <td>
                              {typeof p.ends_at === "string" && p.ends_at.trim()
                                ? formatDisplayDate(p.ends_at)
                                : "-"}
                            </td>
                            <td>{channels.length ? channels.join(", ") : "-"}</td>
                            <td>{formatDisplayDateTime(e.created_at)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div style={{ padding: "0.75rem 1rem 1rem" }}>
                  <TablePaginationBar
                    page={renewalEventsPage}
                    total={renewalEventsAll.length}
                    onPageChange={setRenewalEventsPage}
                  />
                </div>
              </>
            )}
          </Card>
        </div>
      )}

      <Modal
        open={previewOpen}
        title={`Message preview - ${previewCustomerName}`}
        onClose={() => setPreviewOpen(false)}
      >
        {previewMut.data && previewMut.data.length > 0 ? (
          <div className="sr-preview-panel" style={{ margin: 0, border: "none", background: "transparent", padding: 0 }}>
            {previewMut.data.map((row) => (
              <div key={row.channel} className="sr-preview-channel">
                <p className="sr-preview-channel-title">{formatNotificationChannelLabel(row.channel)}</p>
                {row.subject ? <p className="sr-preview-subject">{row.subject}</p> : null}
                <p className="sr-preview-body">{row.body}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="dash-muted-line">No active templates found. Check notification templates and channel settings.</p>
        )}
        <div className="bm-modal-actions" style={{ marginTop: "1rem" }}>
          <Button type="button" variant="primary" onClick={() => setPreviewOpen(false)}>
            Close
          </Button>
        </div>
      </Modal>
    </>
  );
}
