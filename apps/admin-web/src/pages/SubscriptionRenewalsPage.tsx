import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  DEFAULT_TABLE_PAGE_SIZE,
  adminListNotificationEvents,
  adminProcessNotificationQueue,
  queryKeys,
  subscriptionApi,
} from "@oorjaman/api";
import { formatDisplayDate, formatDisplayDateTime } from "@oorjaman/utils";
import { Button, Card, PageHeader } from "@oorjaman/web-ui";
import { TablePaginationBar } from "../components/TablePaginationBar";
import { useSupabase } from "../lib/supabase-context";
import "../layouts/dashboard-layout.css";

const RENEWAL_EVENTS_FETCH = 300;

export function SubscriptionRenewalsPage() {
  const supabase = useSupabase();
  const navigate = useNavigate();
  const [daysAhead, setDaysAhead] = useState(14);
  const [cooldownDays, setCooldownDays] = useState(3);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [previewSubscriptionId, setPreviewSubscriptionId] = useState<string>("");
  const [candidatesPage, setCandidatesPage] = useState(1);
  const [renewalEventsPage, setRenewalEventsPage] = useState(1);
  const channels = useMemo<Array<"email" | "sms" | "whatsapp">>(() => ["email", "sms", "whatsapp"], []);

  const candidatesQuery = useQuery({
    queryKey: queryKeys.subscriptions.renewalCandidates(daysAhead),
    queryFn: () => subscriptionApi.adminListSubscriptionRenewalNudgeCandidates(supabase!, { daysAhead, limit: 300 }),
    enabled: Boolean(supabase),
  });
  const eventsQuery = useQuery({
    queryKey: queryKeys.bookings.notificationEvents(RENEWAL_EVENTS_FETCH),
    queryFn: () => adminListNotificationEvents(supabase!, RENEWAL_EVENTS_FETCH),
    enabled: Boolean(supabase),
  });

  useEffect(() => {
    setCandidatesPage(1);
  }, [daysAhead]);

  const candidatesAll = candidatesQuery.data ?? [];
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
      .filter((e) => e.event_type === "subscription_renewal_nudge")
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [eventsQuery.data]);

  const renewalEventsTotal = renewalEventsAll.length;
  const renewalEventsWindow = useMemo(
    () =>
      renewalEventsAll.slice(
        (renewalEventsPage - 1) * DEFAULT_TABLE_PAGE_SIZE,
        renewalEventsPage * DEFAULT_TABLE_PAGE_SIZE,
      ),
    [renewalEventsAll, renewalEventsPage],
  );

  const queueMut = useMutation({
    mutationFn: async () =>
      subscriptionApi.adminQueueSubscriptionRenewalNudges(supabase!, {
        subscriptionIds: selectedIds,
        channels,
        daysAhead,
        cooldownDays,
      }),
    onSuccess: async () => {
      await candidatesQuery.refetch();
      await eventsQuery.refetch();
      setSelectedIds([]);
    },
  });
  const processMut = useMutation({
    mutationFn: () => adminProcessNotificationQueue(supabase!, { limit: 80 }),
    onSuccess: async () => {
      await eventsQuery.refetch();
    },
  });
  const previewMut = useMutation({
    mutationFn: async () => {
      const subscriptionId = previewSubscriptionId || selectedIds[0];
      if (!subscriptionId) throw new Error("Select at least one candidate to preview.");
      return subscriptionApi.adminPreviewSubscriptionRenewalNudge(supabase!, {
        subscriptionId,
        channels,
      });
    },
  });

  return (
    <>
      <PageHeader
        title="Subscription renewals"
        subtitle="Queue renewal nudges for upcoming-expiry subscriptions. Manage demo/live channel toggles under Feature management."
        actions={
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <Button variant="outline" size="sm" type="button" onClick={() => navigate("/dashboard/feature-management")}>
              Feature management
            </Button>
            <Button variant="outline" size="sm" type="button" onClick={() => void candidatesQuery.refetch()}>
              Refresh
            </Button>
            <Button variant="outline" size="sm" type="button" loading={processMut.isPending} onClick={() => void processMut.mutateAsync()}>
              Process queue now
            </Button>
          </div>
        }
      />
      {!supabase ? (
        <Card padded>
          <p className="dash-muted-line">Connect Supabase via Vite env variables.</p>
        </Card>
      ) : (
        <div className="bm-stack">
          <Card padded>
            <p className="bm-title">Upcoming renewal candidates</p>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center", marginBottom: "0.75rem" }}>
              <label className="bm-label" htmlFor="daysAhead">
                Days ahead
              </label>
              <input
                id="daysAhead"
                type="number"
                min={1}
                max={60}
                value={daysAhead}
                className="vd-select"
                style={{ width: "4.5rem" }}
                onChange={(e) => setDaysAhead(Math.max(1, Math.min(60, Number(e.target.value) || 14)))}
              />
              <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", alignItems: "center" }}>
                <Button type="button" size="sm" variant={daysAhead === 3 ? "primary" : "outline"} onClick={() => setDaysAhead(3)}>
                  3 days
                </Button>
                <Button type="button" size="sm" variant={daysAhead === 7 ? "primary" : "outline"} onClick={() => setDaysAhead(7)}>
                  7 days
                </Button>
                <Button type="button" size="sm" variant={daysAhead === 14 ? "primary" : "outline"} onClick={() => setDaysAhead(14)}>
                  14 days
                </Button>
              </div>
              <label className="bm-label" htmlFor="cooldownDays">
                Dedupe cooldown (days)
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
            {candidatesQuery.isLoading ? (
              <p className="dash-table-empty">Loading…</p>
            ) : candidatesTotal === 0 ? (
              <p className="dash-table-empty">No upcoming renewals in this window.</p>
            ) : (
              <>
                <div className="bm-table-wrap">
                  <table className="bm-table">
                    <thead>
                      <tr>
                        <th>Select</th>
                        <th>Customer</th>
                        <th>Ends in</th>
                        <th>Plan</th>
                        <th>Ends at</th>
                        <th>Channels</th>
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
                            <td>{c.days_to_expiry} days</td>
                            <td>{c.plan_name}</td>
                            <td>{formatDisplayDate(c.ends_at)}</td>
                            <td>
                              {[c.customer_email ? "Email" : null, c.customer_phone ? "SMS/WhatsApp" : null].filter(Boolean).join(" · ") ||
                                "No contact"}
                            </td>
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
            <div className="bm-modal-actions" style={{ marginTop: "1rem", justifyContent: "flex-start" }}>
              <Button
                type="button"
                size="sm"
                loading={queueMut.isPending}
                disabled={selectedIds.length === 0}
                onClick={() => void queueMut.mutateAsync()}
              >
                Queue renewal nudges ({selectedIds.length})
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                loading={previewMut.isPending}
                disabled={selectedIds.length === 0 && !previewSubscriptionId}
                onClick={() => void previewMut.mutateAsync()}
              >
                Dry-run preview
              </Button>
            </div>
            <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
              <label className="bm-label" htmlFor="previewSub">
                Preview subscription
              </label>
              <select
                id="previewSub"
                className="vd-select"
                value={previewSubscriptionId}
                onChange={(e) => setPreviewSubscriptionId(e.target.value)}
              >
                <option value="">Use first selected</option>
                {(candidatesQuery.data ?? []).map((c) => (
                  <option key={`pv-${c.subscription_id}`} value={c.subscription_id}>
                    {(c.customer_name ?? "Customer")} · {c.plan_name} · {c.days_to_expiry}d
                  </option>
                ))}
              </select>
            </div>
            {queueMut.isSuccess ? <p className="dash-muted-line">Queued {queueMut.data} renewal nudges.</p> : null}
            {queueMut.isError ? <p className="dash-empty-error">{(queueMut.error as Error).message}</p> : null}
            {previewMut.isError ? <p className="dash-empty-error">{(previewMut.error as Error).message}</p> : null}
            {previewMut.isSuccess ? (
              <div className="bm-table-wrap" style={{ marginTop: "1rem" }}>
                <table className="bm-table">
                  <thead>
                    <tr>
                      <th>Channel</th>
                      <th>Subject</th>
                      <th>Body</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewMut.data.map((row) => (
                      <tr key={`preview-${row.channel}`}>
                        <td>{row.channel.toUpperCase()}</td>
                        <td>{row.subject ?? "—"}</td>
                        <td style={{ maxWidth: 420, whiteSpace: "pre-wrap", fontSize: "0.85rem" }}>{row.body}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </Card>

          <Card padded={false}>
            <div style={{ padding: "1rem 1rem 0" }}>
              <p className="bm-title">Recent renewal nudge sends</p>
              <p className="bm-muted" style={{ margin: "0.25rem 0 0.75rem", fontSize: "0.875rem" }}>
                Last {RENEWAL_EVENTS_FETCH} notification events (renewal type only), {DEFAULT_TABLE_PAGE_SIZE} per page.
              </p>
            </div>
            {eventsQuery.isLoading ? (
              <p className="dash-table-empty">Loading history…</p>
            ) : renewalEventsTotal === 0 ? (
              <p className="dash-table-empty">No renewal nudge events yet.</p>
            ) : (
              <>
                <div className="bm-table-wrap">
                  <table className="bm-table">
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th>Status</th>
                        <th>Plan</th>
                        <th>Expires</th>
                        <th>Channels</th>
                        <th>Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {renewalEventsWindow.map((e) => {
                        const p =
                          e.payload && typeof e.payload === "object" && !Array.isArray(e.payload)
                            ? (e.payload as Record<string, unknown>)
                            : {};
                        return (
                          <tr key={e.id}>
                            <td>{String(p.customer_name ?? "Customer")}</td>
                            <td>{e.status}</td>
                            <td>{String(p.plan_name ?? "—")}</td>
                            <td>
                              {typeof p.ends_at === "string" && p.ends_at.trim()
                                ? formatDisplayDate(p.ends_at)
                                : "—"}
                            </td>
                            <td>{Array.isArray(e.channels) ? e.channels.join(", ") : "—"}</td>
                            <td>{formatDisplayDateTime(e.created_at)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div style={{ padding: "0.75rem 1rem 1rem" }}>
                  <TablePaginationBar page={renewalEventsPage} total={renewalEventsTotal} onPageChange={setRenewalEventsPage} />
                </div>
              </>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
