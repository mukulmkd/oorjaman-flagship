import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { DEFAULT_TABLE_PAGE_SIZE, queryKeys, technicianApi } from "@oorjaman/api";
import { Button, Card, PageHeader } from "@oorjaman/web-ui";
import { TablePaginationBar } from "../components/TablePaginationBar";
import { useSupabase } from "../lib/supabase-context";
import "../layouts/dashboard-layout.css";

const REPORTS_SAMPLE = 500;

export function TrustSafetyPage() {
  const supabase = useSupabase();
  const [page, setPage] = useState(1);
  const [hideReasonByReportId, setHideReasonByReportId] = useState<Record<string, string>>({});

  const reportsQuery = useQuery({
    queryKey: queryKeys.jobReports.list({ limit: REPORTS_SAMPLE }),
    queryFn: () => technicianApi.listVisibleJobReports(supabase!, { limit: REPORTS_SAMPLE }),
    enabled: Boolean(supabase),
  });

  const moderateMut = useMutation({
    mutationFn: async (input: { reportId: string; hidden: boolean; reason?: string }) =>
      technicianApi.adminSetJobReportFeedbackModeration(supabase!, input.reportId, {
        hidden: input.hidden,
        reason: input.reason,
      }),
    onSuccess: async () => {
      await reportsQuery.refetch();
    },
  });

  const moderationAll = useMemo(
    () =>
      [...(reportsQuery.data ?? [])]
        .filter((r) => r.customer_feedback?.trim() || r.anomaly_notes?.trim())
        .sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()),
    [reportsQuery.data],
  );

  const total = moderationAll.length;
  const rows = useMemo(
    () => moderationAll.slice((page - 1) * DEFAULT_TABLE_PAGE_SIZE, page * DEFAULT_TABLE_PAGE_SIZE),
    [moderationAll, page],
  );

  return (
    <>
      <PageHeader
        title="Trust & safety"
        subtitle="Moderate customer feedback and anomaly notes on completed visits. Batch review - not part of the live ops desk."
      />

      {!supabase ? (
        <Card padded>
          <p className="bm-muted">Connect Supabase via Vite env variables.</p>
        </Card>
      ) : (
        <Card padded={false}>
          {reportsQuery.isLoading ? (
            <p className="dash-table-empty">Loading feedback items…</p>
          ) : total === 0 ? (
            <p className="dash-table-empty">No feedback items to moderate.</p>
          ) : (
            <>
              <div className="bm-table-wrap">
                <table className="bm-table">
                  <thead>
                    <tr>
                      <th>Booking</th>
                      <th>Rating</th>
                      <th>Completed</th>
                      <th>Visibility</th>
                      <th>Text</th>
                      <th>Moderation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={`mod-${r.id}`}>
                        <td className="bm-cell-mono">{r.booking_id.slice(0, 8)}…</td>
                        <td>{r.customer_rating ?? "-"}</td>
                        <td>{new Date(r.completed_at).toLocaleString()}</td>
                        <td>{r.feedback_hidden ? "Hidden" : "Visible"}</td>
                        <td style={{ maxWidth: 280, fontSize: "0.85rem" }}>
                          {r.feedback_hidden
                            ? (r.feedback_hidden_reason ?? "Hidden")
                            : [r.customer_feedback, r.anomaly_notes].filter(Boolean).join(" · ") || "-"}
                        </td>
                        <td>
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", minWidth: 200 }}>
                            <input
                              placeholder="Hide reason (optional)"
                              value={hideReasonByReportId[r.id] ?? ""}
                              onChange={(e) =>
                                setHideReasonByReportId((prev) => ({ ...prev, [r.id]: e.target.value }))
                              }
                            />
                            {!r.feedback_hidden ? (
                              <Button
                                variant="outline"
                                size="sm"
                                type="button"
                                loading={moderateMut.isPending}
                                onClick={() =>
                                  void moderateMut.mutateAsync({
                                    reportId: r.id,
                                    hidden: true,
                                    reason: hideReasonByReportId[r.id],
                                  })
                                }
                              >
                                Hide
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                type="button"
                                loading={moderateMut.isPending}
                                onClick={() => void moderateMut.mutateAsync({ reportId: r.id, hidden: false })}
                              >
                                Unhide
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: "0.75rem 1rem 1rem" }}>
                <TablePaginationBar page={page} total={total} onPageChange={setPage} />
              </div>
            </>
          )}
        </Card>
      )}
    </>
  );
}
