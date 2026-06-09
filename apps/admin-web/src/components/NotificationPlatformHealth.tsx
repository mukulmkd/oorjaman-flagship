import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminCountNotificationEvents,
  adminListNotificationEventsPaged,
  adminListRecentFailedNotificationEvents,
  adminProcessNotificationQueue,
  queryKeys,
} from "@oorjaman/api";
import { formatDisplayDateTime } from "@oorjaman/utils";
import { Button, Card } from "@oorjaman/web-ui";
import { formatNotificationEventTypeLabel } from "../lib/notification-labels";
import { useSupabase } from "../lib/supabase-context";

const FAILED_HOURS = 168;
const EVENT_PAGE_SIZE = 10;

export function NotificationPlatformHealth() {
  const supabase = useSupabase();
  const qc = useQueryClient();
  const [eventPage] = useState(1);

  const failedCountQuery = useQuery({
    queryKey: queryKeys.bookings.notificationFailedRecent(FAILED_HOURS),
    queryFn: async () => {
      const [failedRows, queued, failed24h] = await Promise.all([
        adminListRecentFailedNotificationEvents(supabase!, {
          limit: 40,
          sinceHours: FAILED_HOURS,
        }),
        adminCountNotificationEvents(supabase!, { status: "queued" }),
        adminCountNotificationEvents(supabase!, {
          status: "failed",
          sinceIso: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        }),
      ]);
      return { failedRows, queued, failed24h };
    },
    enabled: Boolean(supabase),
  });

  const eventsPagedQuery = useQuery({
    queryKey: queryKeys.bookings.notificationEventsPage(eventPage, EVENT_PAGE_SIZE),
    queryFn: () =>
      adminListNotificationEventsPaged(supabase!, { page: eventPage, pageSize: EVENT_PAGE_SIZE }),
    enabled: Boolean(supabase),
  });

  const processMut = useMutation({
    mutationFn: () => adminProcessNotificationQueue(supabase!, { limit: 80 }),
    onSuccess: async () => {
      await failedCountQuery.refetch();
      await eventsPagedQuery.refetch();
      await qc.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) && (q.queryKey as unknown[]).includes("notification-events-paged"),
      });
      await qc.invalidateQueries({ queryKey: queryKeys.bookings.opsDeskSummary() });
    },
  });

  if (!supabase) return null;

  const failed24h = failedCountQuery.data?.failed24h ?? 0;
  const queued = failedCountQuery.data?.queued ?? 0;
  const recentFailed = failedCountQuery.data?.failedRows ?? [];

  return (
    <Card padded={false} id="notification-health">
      <div style={{ padding: "1rem 1rem 0" }}>
        <h2 className="bm-title">Notification platform health</h2>
        <p className="bm-muted" style={{ margin: "0.25rem 0 0.75rem", fontSize: "0.875rem" }}>
          Delivery log for push, email, and SMS. Ops desk shows failed alerts from the last 24 hours only.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", marginBottom: "0.75rem" }}>
          <span>
            <strong>{queued}</strong> queued
          </span>
          <span>
            <strong>{failed24h}</strong> failed (24h)
          </span>
          <Button
            variant="outline"
            size="sm"
            type="button"
            loading={processMut.isPending}
            onClick={() => void processMut.mutateAsync()}
          >
            Process queue now
          </Button>
        </div>
      </div>

      {recentFailed.length > 0 ? (
        <div className="bm-table-wrap">
          <table className="bm-table">
            <thead>
              <tr>
                <th>Recent failures (7d)</th>
                <th>Created</th>
                <th>Attempts</th>
              </tr>
            </thead>
            <tbody>
              {recentFailed.slice(0, 12).map((row) => (
                <tr key={row.id}>
                  <td>
                    <div>{formatNotificationEventTypeLabel(row.event_type)}</div>
                    <div className="bm-muted bm-cell-mono" style={{ fontSize: "0.75rem" }}>
                      {row.event_type}
                    </div>
                  </td>
                  <td>{formatDisplayDateTime(row.created_at)}</td>
                  <td>{row.attempt_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="dash-table-empty">No failed notification events in the last 7 days.</p>
      )}

      <div style={{ padding: "1rem 1rem 0" }}>
        <h3 className="bm-title" style={{ fontSize: "1rem" }}>
          Latest events
        </h3>
      </div>
      {eventsPagedQuery.isLoading ? (
        <p className="dash-table-empty">Loading events…</p>
      ) : (eventsPagedQuery.data?.total ?? 0) === 0 ? (
        <p className="dash-table-empty">No notification events yet.</p>
      ) : (
        <div className="bm-table-wrap">
          <table className="bm-table">
            <thead>
              <tr>
                <th>Event</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {(eventsPagedQuery.data?.rows ?? []).map((row) => (
                <tr key={row.id}>
                  <td>{formatNotificationEventTypeLabel(row.event_type)}</td>
                  <td>{row.status}</td>
                  <td>{formatDisplayDateTime(row.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
