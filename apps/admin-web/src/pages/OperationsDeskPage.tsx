import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import {
  adminAssignAmcSubscriptionVendor,
  adminFetchOpsDeskSummaryLight,
  adminGetBookingMonitoringRows,
  adminListAmcAwaitingPartnerAssignments,
  adminListOpsBookingExceptions,
  adminListOpsBookingExceptionsPaged,
  adminNotifyOverdueVendorResponses,
  adminResetBookingOtpLock,
  buildOpsDeskSummary,
  DEFAULT_TABLE_PAGE_SIZE,
  queryKeys,
  vendorApi,
  type OpsExceptionsQueueFilter,
} from "@oorjaman/api";
import { Badge, Button, Card, Modal, PageHeader } from "@oorjaman/web-ui";
import { OpsInterventionModal, type OpsInterventionTarget } from "../components/OpsInterventionModal";
import { TablePaginationBar } from "@oorjaman/web-ui";
import {
  buildOpsDeskInboxRows,
  OPS_DESK_CATEGORY_FILTERS,
  OPS_DESK_TIME_TABS,
  opsDeskCategoryLabel,
  opsDeskPrimaryActionLabel,
  type OpsDeskCategoryFilter,
  type OpsDeskInboxRow,
  type OpsDeskTimeFilter,
} from "../lib/ops-desk-display";
import { formatOpsIssueLevel } from "../lib/ops-exceptions-display";
import { supportPortalUrl } from "@oorjaman/web-ui";
import { useSupabase } from "@oorjaman/web-ui";
import { invalidateAdminBookingOpsQueries } from "../lib/invalidate-admin-queries";
import "./operations-desk-page.css";

const EXCEPTION_SAMPLE = 500;
const MONITOR_SAMPLE = 500;

function mapTimeFilterToOpsQueue(timeFilter: OpsDeskTimeFilter): OpsExceptionsQueueFilter {
  if (timeFilter === "overdue_cleanup") return "past_window";
  if (timeFilter === "history") return "all";
  return "actionable";
}

export function OperationsDeskPage() {
  const supabase = useSupabase();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [timeFilter, setTimeFilter] = useState<OpsDeskTimeFilter>("needs_action");
  const [categoryFilter, setCategoryFilter] = useState<OpsDeskCategoryFilter>("all");
  const [inboxPage, setInboxPage] = useState(1);
  const [legacyPage, setLegacyPage] = useState(1);

  const [intervention, setIntervention] = useState<OpsInterventionTarget | null>(null);
  const [amcAssignTarget, setAmcAssignTarget] = useState<{
    subscriptionId: string;
    planName: string;
  } | null>(null);
  const [amcAssignVendorId, setAmcAssignVendorId] = useState("");

  useEffect(() => {
    setInboxPage(1);
    setLegacyPage(1);
  }, [timeFilter, categoryFilter]);

  const summaryLightQuery = useQuery({
    queryKey: [...queryKeys.bookings.opsDeskSummary(), "light"] as const,
    queryFn: () => adminFetchOpsDeskSummaryLight(supabase!),
    enabled: Boolean(supabase),
    refetchInterval: 60_000,
  });

  const exceptionsSampleQuery = useQuery({
    queryKey: queryKeys.bookings.opsExceptions(EXCEPTION_SAMPLE),
    queryFn: () => adminListOpsBookingExceptions(supabase!, EXCEPTION_SAMPLE),
    enabled: Boolean(supabase && timeFilter === "needs_action"),
  });

  const exceptionsPagedQuery = useQuery({
    queryKey: queryKeys.bookings.opsExceptionsPage(
      legacyPage,
      DEFAULT_TABLE_PAGE_SIZE,
      mapTimeFilterToOpsQueue(timeFilter),
    ),
    queryFn: () =>
      adminListOpsBookingExceptionsPaged(supabase!, {
        page: legacyPage,
        pageSize: DEFAULT_TABLE_PAGE_SIZE,
        filter: mapTimeFilterToOpsQueue(timeFilter),
      }),
    enabled: Boolean(supabase && timeFilter !== "needs_action"),
  });

  const monitorQuery = useQuery({
    queryKey: queryKeys.bookings.adminMonitoring("all", MONITOR_SAMPLE),
    queryFn: () => adminGetBookingMonitoringRows(supabase!, "all", { limit: MONITOR_SAMPLE }),
    enabled: Boolean(supabase),
    staleTime: 60_000,
  });

  const amcQuery = useQuery({
    queryKey: queryKeys.bookings.opsDeskAmcAwaitingPartner(),
    queryFn: () => adminListAmcAwaitingPartnerAssignments(supabase!),
    enabled: Boolean(supabase),
    staleTime: 60_000,
  });

  const vendorsQuery = useQuery({
    queryKey: queryKeys.vendors.adminList("approved"),
    queryFn: () => vendorApi.adminListVendors(supabase!, { approvalStatus: "approved" }),
    enabled: Boolean(supabase),
  });

  const vendorNameById = useMemo(
    () => new Map((vendorsQuery.data ?? []).map((v) => [v.id, v.business_name] as const)),
    [vendorsQuery.data],
  );

  const inboxRowsAll = useMemo(
    () =>
      buildOpsDeskInboxRows({
        exceptions: exceptionsSampleQuery.data ?? [],
        monitorRows: monitorQuery.data ?? [],
        amcRows: amcQuery.data ?? [],
        vendorNameById,
        timeFilter,
        categoryFilter,
      }),
    [
      exceptionsSampleQuery.data,
      monitorQuery.data,
      amcQuery.data,
      vendorNameById,
      timeFilter,
      categoryFilter,
    ],
  );

  const inboxTotal = inboxRowsAll.length;
  const inboxWindow = useMemo(
    () =>
      inboxRowsAll.slice(
        (inboxPage - 1) * DEFAULT_TABLE_PAGE_SIZE,
        inboxPage * DEFAULT_TABLE_PAGE_SIZE,
      ),
    [inboxRowsAll, inboxPage],
  );

  const summary = useMemo(() => {
    if (!summaryLightQuery.data) return undefined;
    return buildOpsDeskSummary({
      light: summaryLightQuery.data,
      monitorRows: monitorQuery.data ?? [],
      amcRows: amcQuery.data ?? [],
    });
  }, [summaryLightQuery.data, monitorQuery.data, amcQuery.data]);

  const summaryPending =
    summaryLightQuery.isPending || monitorQuery.isPending || amcQuery.isPending;

  const resetOtpMut = useMutation({
    mutationFn: async (bookingId: string) => adminResetBookingOtpLock(supabase!, bookingId),
    onSuccess: () => {
      void invalidateAdminBookingOpsQueries(qc);
    },
  });

  const overdueScanMut = useMutation({
    mutationFn: () => adminNotifyOverdueVendorResponses(supabase!, { limit: 200 }),
    onSuccess: () => {
      void invalidateAdminBookingOpsQueries(qc);
    },
  });

  const amcAssignMut = useMutation({
    mutationFn: async ({
      subscriptionId,
      vendorId,
    }: {
      subscriptionId: string;
      vendorId: string;
    }) =>
      adminAssignAmcSubscriptionVendor(supabase!, subscriptionId, vendorId, {
        reassignOpenBookings: true,
      }),
    onSuccess: () => {
      setAmcAssignTarget(null);
      setAmcAssignVendorId("");
      void invalidateAdminBookingOpsQueries(qc);
    },
  });

  async function refreshDesk() {
    if (supabase) {
      await overdueScanMut.mutateAsync().catch(() => undefined);
      return;
    }
    await invalidateAdminBookingOpsQueries(qc);
  }

  const activeTab = OPS_DESK_TIME_TABS.find((t) => t.id === timeFilter);

  function handlePrimaryAction(row: OpsDeskInboxRow) {
    if (row.kind === "amc_setup" && row.subscriptionId) {
      setAmcAssignTarget({
        subscriptionId: row.subscriptionId,
        planName: row.title,
      });
      setAmcAssignVendorId("");
      return;
    }
    if (row.kind === "otp_risk" && row.bookingId) {
      const ok = window.confirm(
        `Reset OTP lock for ${row.title}? This clears mismatch counters and active lock timers.`,
      );
      if (!ok) return;
      void resetOtpMut.mutateAsync(row.bookingId);
      return;
    }
    if (row.bookingId) {
      setIntervention({
        bookingId: row.bookingId,
        referenceCode: row.referenceCode ?? row.title,
        issueType: row.issueType,
        presetVendorId: row.vendorId,
      });
    }
  }

  return (
    <>
      <PageHeader
        title="Operations desk"
        subtitle="Visits at risk today - one inbox, one action per row. Quality and moderation live under Partners and Trust & safety."
        actions={
          <Button variant="outline" size="sm" type="button" onClick={() => void refreshDesk()}>
            Refresh
          </Button>
        }
      />

      {!supabase ? (
        <Card padded>
          <p className="bm-muted">Connect Supabase via Vite env variables.</p>
        </Card>
      ) : (
        <div className="bm-stack">
          <div className="ops-desk-kpi-row">
            <Card padded className="ops-desk-kpi-card">
              <div className="ops-desk-kpi-value">
                {summaryPending ? "…" : (summary?.bookingExceptionsActionable ?? 0)}
              </div>
              <div className="ops-desk-kpi-label">Visits need action</div>
            </Card>
            <Card padded className="ops-desk-kpi-card">
              <div className="ops-desk-kpi-value">
                {summaryPending ? "…" : (summary?.onsiteBlocked ?? 0)}
              </div>
              <div className="ops-desk-kpi-label">On-site OTP blocked</div>
            </Card>
            <Card padded className="ops-desk-kpi-card">
              <div className="ops-desk-kpi-value">
                {summaryPending ? "…" : (summary?.amcAwaitingPartner ?? 0)}
              </div>
              <div className="ops-desk-kpi-label">AMC awaiting partner</div>
            </Card>
            {(summary?.notificationsFailed24h ?? 0) > 0 ? (
              <Card padded className="ops-desk-kpi-card ops-desk-kpi-card--alert">
                <div className="ops-desk-kpi-value">{summary?.notificationsFailed24h}</div>
                <div className="ops-desk-kpi-label">
                  Failed alerts (24h) ·{" "}
                  <Link to="/dashboard/analytics#notification-health">View in Analytics</Link>
                </div>
              </Card>
            ) : null}
          </div>

          <Card padded={false}>
            <div style={{ padding: "1rem 1rem 0" }}>
              <h2 className="bm-title">Action inbox</h2>
              <p className="bm-muted" style={{ margin: "0.25rem 0 0.75rem", fontSize: "0.875rem" }}>
                {activeTab?.hint}
              </p>
              <div className="bm-tabs" role="tablist" aria-label="Ops desk time filter" style={{ marginBottom: "0.75rem" }}>
                {OPS_DESK_TIME_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={timeFilter === tab.id}
                    className={`bm-tab-btn ${timeFilter === tab.id ? "is-active" : ""}`}
                    onClick={() => setTimeFilter(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              {timeFilter === "needs_action" ? (
                <div className="ops-desk-category-row" role="tablist" aria-label="Ops desk category filter">
                  {OPS_DESK_CATEGORY_FILTERS.map((chip) => (
                    <button
                      key={chip.id}
                      type="button"
                      className={`ops-desk-chip ${categoryFilter === chip.id ? "is-active" : ""}`}
                      onClick={() => setCategoryFilter(chip.id)}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            {timeFilter === "needs_action" ? (
              exceptionsSampleQuery.isLoading || monitorQuery.isLoading ? (
                <p className="dash-table-empty">Loading action inbox…</p>
              ) : inboxTotal === 0 ? (
                <div className="dash-table-empty ops-desk-empty">
                  <p>No visits need action right now.</p>
                  <p className="bm-muted">
                    Check <Link to="/dashboard/bookings">Bookings</Link> for search, or the{" "}
                    <a href={supportPortalUrl("/inbox")} target="_blank" rel="noreferrer">
                      Support desk
                    </a>{" "}
                    for customer messages.
                  </p>
                </div>
              ) : (
                <>
                  <div className="bm-table-wrap">
                    <table className="bm-table bm-table--bookings">
                      <thead>
                        <tr>
                          <th>Reference / plan</th>
                          <th>Queue</th>
                          <th>Reason</th>
                          <th>Timing</th>
                          <th>Risk</th>
                          <th>Partner</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inboxWindow.map((row) => (
                          <tr key={row.id}>
                            <td>
                              <code className="bm-ref">{row.title}</code>
                              {row.kind === "amc_setup" ? (
                                <div className="bm-muted" style={{ fontSize: "0.75rem", marginTop: "0.15rem" }}>
                                  AMC subscription
                                </div>
                              ) : null}
                            </td>
                            <td>{opsDeskCategoryLabel(row.category)}</td>
                            <td className="bm-risk-line">{row.reason}</td>
                            <td style={{ fontSize: "0.85rem", whiteSpace: "nowrap" }}>{row.timingLabel}</td>
                            <td>
                              {row.severity ? (
                                <Badge tone={row.severity === "high" ? "danger" : "warning"}>
                                  {formatOpsIssueLevel(row.severity)}
                                </Badge>
                              ) : (
                                "-"
                              )}
                            </td>
                            <td>{row.partnerLabel}</td>
                            <td>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                                <Button
                                  variant="primary"
                                  size="sm"
                                  type="button"
                                  loading={
                                    row.kind === "otp_risk" &&
                                    resetOtpMut.isPending &&
                                    resetOtpMut.variables === row.bookingId
                                  }
                                  onClick={() => handlePrimaryAction(row)}
                                >
                                  {opsDeskPrimaryActionLabel(row)}
                                </Button>
                                {row.kind === "amc_setup" && row.subscriptionId ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    type="button"
                                    onClick={() =>
                                      navigate(
                                        `/dashboard/finance/amc-contracts?highlight=${row.subscriptionId}`,
                                      )
                                    }
                                  >
                                    Open in Finance
                                  </Button>
                                ) : null}
                                {row.kind === "booking_exception" && row.bookingId ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    type="button"
                                    onClick={() =>
                                      setIntervention({
                                        bookingId: row.bookingId!,
                                        referenceCode: row.referenceCode ?? row.title,
                                        issueType: row.issueType,
                                        presetVendorId: row.vendorId,
                                      })
                                    }
                                  >
                                    Intervene
                                  </Button>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ padding: "0.75rem 1rem 1rem" }}>
                    <TablePaginationBar page={inboxPage} total={inboxTotal} onPageChange={setInboxPage} />
                  </div>
                </>
              )
            ) : exceptionsPagedQuery.isLoading ? (
              <p className="dash-table-empty">Loading queue…</p>
            ) : exceptionsPagedQuery.isError ? (
              <p className="bm-error dash-table-empty">{(exceptionsPagedQuery.error as Error).message}</p>
            ) : (exceptionsPagedQuery.data?.total ?? 0) === 0 ? (
              <p className="dash-table-empty">No rows in this queue.</p>
            ) : (
              <>
                <div className="bm-table-wrap">
                  <table className="bm-table bm-table--bookings">
                    <thead>
                      <tr>
                        <th>Reference</th>
                        <th>Reason</th>
                        <th>Timing</th>
                        <th>Risk</th>
                        <th>Partner</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(exceptionsPagedQuery.data?.rows ?? []).map((row) => {
                        const inboxRow = buildOpsDeskInboxRows({
                          exceptions: [row],
                          monitorRows: [],
                          amcRows: [],
                          vendorNameById,
                          timeFilter,
                          categoryFilter: "all",
                        })[0];
                        if (!inboxRow) return null;
                        return (
                          <tr key={row.booking_id}>
                            <td>
                              <code className="bm-ref">{inboxRow.title}</code>
                            </td>
                            <td>{inboxRow.reason}</td>
                            <td style={{ fontSize: "0.85rem" }}>{inboxRow.timingLabel}</td>
                            <td>
                              {inboxRow.severity ? (
                                <Badge tone={inboxRow.severity === "high" ? "danger" : "warning"}>
                                  {formatOpsIssueLevel(inboxRow.severity)}
                                </Badge>
                              ) : (
                                "-"
                              )}
                            </td>
                            <td>{inboxRow.partnerLabel}</td>
                            <td>
                              <Button
                                variant="primary"
                                size="sm"
                                type="button"
                                onClick={() =>
                                  setIntervention({
                                    bookingId: row.booking_id,
                                    referenceCode: row.reference_code ?? row.booking_id.slice(0, 8),
                                    issueType: row.issue_type,
                                    presetVendorId: row.vendor_id,
                                  })
                                }
                              >
                                Intervene
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div style={{ padding: "0.75rem 1rem 1rem" }}>
                  <TablePaginationBar
                    page={legacyPage}
                    total={exceptionsPagedQuery.data?.total ?? 0}
                    onPageChange={setLegacyPage}
                  />
                </div>
              </>
            )}
          </Card>
        </div>
      )}

      <OpsInterventionModal
        target={intervention}
        onClose={() => setIntervention(null)}
        onSuccess={() => void refreshDesk()}
      />

      <Modal
        open={Boolean(amcAssignTarget)}
        onClose={() => {
          setAmcAssignTarget(null);
          setAmcAssignVendorId("");
        }}
        title={amcAssignTarget ? `Assign AMC partner · ${amcAssignTarget.planName}` : "Assign AMC partner"}
      >
        {amcAssignTarget ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            <p className="bm-muted" style={{ margin: 0, fontSize: "0.875rem", lineHeight: 1.5 }}>
              Customer paid for this AMC. Assigning unlocks included visit scheduling in the customer app.
            </p>
            <label className="dash-card-label" htmlFor="ops-amc-assign-vendor">
              Approved partner
            </label>
            <select
              id="ops-amc-assign-vendor"
              className="vd-select bm-select"
              value={amcAssignVendorId}
              onChange={(e) => setAmcAssignVendorId(e.target.value)}
            >
              <option value="">Select partner…</option>
              {(vendorsQuery.data ?? []).map((v) => (
                <option key={v.id} value={v.id}>
                  {v.business_name}
                </option>
              ))}
            </select>
            <div className="bm-modal-actions">
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => {
                  setAmcAssignTarget(null);
                  setAmcAssignVendorId("");
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="button"
                loading={amcAssignMut.isPending}
                disabled={!amcAssignVendorId}
                onClick={() => {
                  if (!amcAssignVendorId || !amcAssignTarget) return;
                  void amcAssignMut.mutateAsync({
                    subscriptionId: amcAssignTarget.subscriptionId,
                    vendorId: amcAssignVendorId,
                  });
                }}
              >
                Confirm assignment
              </Button>
            </div>
            {amcAssignMut.isError ? <p className="bm-error">{(amcAssignMut.error as Error).message}</p> : null}
          </div>
        ) : null}
      </Modal>
    </>
  );
}
