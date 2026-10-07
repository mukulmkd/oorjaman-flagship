import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminBackfillVisitPayoutSettlements,
  adminFetchFinanceDashboardStats,
  adminGetPlatformSettings,
  adminListVendorSettlements,
  adminUpdatePlatformSettings,
  adminUpdateVendorSettlement,
  formatInrFromPaise,
  normalizeVendorPlatformFeePercent,
  queryKeys,
  settlementCustomerPaidToLabel,
  settlementDisplayAmountPaise,
  settlementKindLabel,
  settlementStatusLabel,
  settlementVisitChannelLabel,
  visitGrossTaxableValuePaise,
  vendorApi,
  type VendorSettlementKind,
  type VendorSettlementAdminRow,
  type VendorSettlementStatus,
} from "@oorjaman/api";
import { formatDisplayDateTime } from "@oorjaman/utils";
import { Badge, Button, Card, PageHeader } from "@oorjaman/web-ui";
import { Link } from "react-router-dom";
import { TablePaginationBar } from "@oorjaman/web-ui";
import { useSupabase } from "@oorjaman/web-ui";
import "./finance-settlements-page.css";

const PAGE_SIZE = 10;

function statusTone(status: VendorSettlementStatus): "neutral" | "warning" | "success" | "danger" {
  if (status === "settled" || status === "waived") return "success";
  if (status === "approved") return "neutral";
  return "warning";
}

function kpiMoney(
  query: { isPending: boolean; isError: boolean; isSuccess: boolean },
  paise: number | undefined,
): string {
  if (query.isPending) return "…";
  if (query.isError || !query.isSuccess) return "-";
  return formatInrFromPaise(paise ?? 0);
}

function splitHint(
  query: { isPending: boolean; isSuccess: boolean },
  amcPaise: number | undefined,
  oneTimePaise: number | undefined,
  otherPaise = 0,
  amcLabel = "AMC",
  oneTimeLabel = "One-time",
): string {
  if (query.isPending || !query.isSuccess) return "";
  const parts = [
    `${amcLabel} ${formatInrFromPaise(amcPaise ?? 0)}`,
    `${oneTimeLabel} ${formatInrFromPaise(oneTimePaise ?? 0)}`,
  ];
  if (otherPaise > 0) parts.push(`Other ${formatInrFromPaise(otherPaise)}`);
  return parts.join(" · ");
}

function FinanceKpi({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="fin-kpi">
      <span className="fin-kpi-label">{label}</span>
      <span className="fin-kpi-value">{value}</span>
      {hint ? <span className="fin-kpi-hint">{hint}</span> : null}
    </div>
  );
}

function settlementLoadErrorMessage(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  if (msg.includes("vendor_settlements") || msg.includes("42P01") || msg.includes("does not exist")) {
    return "Settlement tables are not on this database yet. Run Supabase migrations (vendor_settlements + platform_settings fee column), then refresh.";
  }
  return msg;
}

export function FinanceSettlementsPage() {
  const supabase = useSupabase();
  const qc = useQueryClient();
  const [kindFilter, setKindFilter] = useState<"" | VendorSettlementKind>("");
  const [statusFilter, setStatusFilter] = useState<"" | VendorSettlementStatus>("");
  const [page, setPage] = useState(1);
  const [editingPenalty, setEditingPenalty] = useState<Record<string, string>>({});
  const [platformFeeText, setPlatformFeeText] = useState("10");

  const filtersKey = `${kindFilter}|${statusFilter}`;

  const platformSettingsQ = useQuery({
    queryKey: queryKeys.platform.settings(),
    queryFn: () => adminGetPlatformSettings(supabase!),
    enabled: Boolean(supabase),
  });

  useEffect(() => {
    if (!platformSettingsQ.isSuccess || !platformSettingsQ.data) return;
    setPlatformFeeText(String(normalizeVendorPlatformFeePercent(platformSettingsQ.data.vendor_platform_fee_percent)));
  }, [platformSettingsQ.isSuccess, platformSettingsQ.data]);

  const savePlatformFeeMut = useMutation({
    mutationFn: async () => {
      if (!supabase) throw new Error("No Supabase client");
      const n = Number.parseFloat(platformFeeText.replace(/,/g, "").trim());
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        throw new Error("Enter a platform fee between 0 and 100.");
      }
      return adminUpdatePlatformSettings(supabase, { vendor_platform_fee_percent: n });
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.platform.settings() }),
  });

  const financeDashboardQ = useQuery({
    queryKey: [...queryKeys.admin.analytics(), "finance-dashboard"] as const,
    queryFn: () => adminFetchFinanceDashboardStats(supabase!),
    enabled: Boolean(supabase),
  });

  const settlementsQuery = useQuery({
    queryKey: queryKeys.finance.adminSettlements(filtersKey),
    queryFn: () =>
      adminListVendorSettlements(supabase!, {
        kind: kindFilter || undefined,
        status: statusFilter || undefined,
        limit: 300,
      }),
    enabled: Boolean(supabase),
  });

  const vendorsQuery = useQuery({
    queryKey: queryKeys.vendors.adminList("approved"),
    queryFn: () => vendorApi.listApprovedVendors(supabase!),
    enabled: Boolean(supabase),
  });

  const vendorNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const v of vendorsQuery.data ?? []) {
      map.set(v.id, v.trade_name?.trim() || v.business_name);
    }
    return map;
  }, [vendorsQuery.data]);

  const rows = settlementsQuery.data ?? [];
  const total = rows.length;
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const platformFeePercent = normalizeVendorPlatformFeePercent(platformSettingsQ.data?.vendor_platform_fee_percent);

  const updateMut = useMutation({
    mutationFn: (input: {
      id: string;
      status?: VendorSettlementStatus;
      penaltyFinalPaise?: number;
      adminNotes?: string;
    }) => adminUpdateVendorSettlement(supabase!, input.id, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.finance.all() });
      void qc.invalidateQueries({ queryKey: queryKeys.admin.analytics() });
    },
  });

  const backfillMut = useMutation({
    mutationFn: () => adminBackfillVisitPayoutSettlements(supabase!, 200),
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.finance.all() }),
  });

  const pendingPayouts = rows.filter((r) => r.kind === "visit_payout" && r.status === "pending_review").length;
  const pendingPenalties = rows.filter(
    (r) => r.kind === "cancellation_penalty" && r.status === "pending_review",
  ).length;

  return (
    <div className="dash-page fin-page">
      <PageHeader
        title="Finance & settlements"
        subtitle="Customer payments are collected by OorjaMan. Recognized revenue is the platform fee on each completed visit. Settled revenue is that fee after the partner payout is marked settled. Prepaid AMC stays held until those visits happen."
        actions={
          <>
          <Link to="/dashboard/finance/payments" className="fin-amc-wallets-link">
            Payments
          </Link>
          <Link to="/dashboard/finance/amc-contracts" className="fin-amc-wallets-link">
            AMC contracts
          </Link>
          <Button
            type="button"
            variant="outline"
            size="sm"
            loading={backfillMut.isPending}
            onClick={() => void backfillMut.mutateAsync()}
          >
            Backfill completed visits
          </Button>
          </>
        }
      />

      {!supabase ? (
        <Card padded>
          <p className="dash-muted-line">Connect Supabase via Vite env variables.</p>
        </Card>
      ) : (
        <div className="fin-root">
          <Card padded>
            <h2 className="fin-settings-title">Platform settings</h2>
            <p className="dash-muted-line fin-settings-help">
              Commission on the GST-exclusive visit value (18% GST stripped from the catalogue price), for a one-time
              checkout or an AMC visit. The percent is saved on the payout row when the visit is completed, and that fee
              is recognized then. Marking the payout settled records that the partner has been paid.
            </p>
            {platformSettingsQ.isPending ? (
              <p className="dash-muted-line">Loading platform settings…</p>
            ) : platformSettingsQ.isError ? (
              <p className="fin-error">
                Could not load platform settings: {(platformSettingsQ.error as Error).message}. Run migrations for{" "}
                <code>vendor_platform_fee_percent</code> (default 10% until then).
              </p>
            ) : (
              <>
                <div className="bm-table-wrap fin-platform-settings-table">
                  <table className="bm-table">
                    <thead>
                      <tr>
                        <th scope="col">Setting</th>
                        <th scope="col">Value</th>
                        <th scope="col">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Vendor platform fee (%)</td>
                        <td>
                          <label className="fin-sr-only" htmlFor="fin-platform-fee-percent">
                            Vendor platform fee percent
                          </label>
                          <input
                            id="fin-platform-fee-percent"
                            name="vendor_platform_fee_percent"
                            type="text"
                            className="web-input fin-platform-fee-input"
                            value={platformFeeText}
                            onChange={(e) => setPlatformFeeText(e.target.value)}
                            inputMode="decimal"
                            autoComplete="off"
                          />
                        </td>
                        <td className="fin-platform-fee-action">
                          <Button
                            type="button"
                            size="sm"
                            variant="primary"
                            loading={savePlatformFeeMut.isPending}
                            onClick={() => void savePlatformFeeMut.mutateAsync()}
                          >
                            Save
                          </Button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                {savePlatformFeeMut.isError ? (
                  <p className="fin-settings-feedback fin-error">{(savePlatformFeeMut.error as Error).message}</p>
                ) : null}
                {savePlatformFeeMut.isSuccess ? (
                  <p className="fin-settings-feedback dash-muted-line">
                    Saved. New completions will use {platformFeePercent}%.
                  </p>
                ) : null}
              </>
            )}
          </Card>

          <div className="fin-kpi-grid" aria-label="Finance summary">
            <FinanceKpi
              label="Recognized revenue"
              value={kpiMoney(financeDashboardQ, financeDashboardQ.data?.recognized_revenue_paise)}
              hint={`${
                platformSettingsQ.isSuccess ? `OorjaMan's ${platformFeePercent}%` : "OorjaMan's platform fee"
              } on each completed visit. Earned when the visit finishes, including payouts still waiting to be marked settled. ${splitHint(
                financeDashboardQ,
                financeDashboardQ.data?.recognized_amc_revenue_paise,
                financeDashboardQ.data?.recognized_one_time_revenue_paise,
                (financeDashboardQ.data?.recognized_revenue_paise ?? 0) -
                  (financeDashboardQ.data?.recognized_amc_revenue_paise ?? 0) -
                  (financeDashboardQ.data?.recognized_one_time_revenue_paise ?? 0),
              )}`}
            />
            <FinanceKpi
              label="Settled revenue"
              value={kpiMoney(financeDashboardQ, financeDashboardQ.data?.total_revenue_cents)}
              hint={`Platform fee already marked settled with the partner. ${splitHint(
                financeDashboardQ,
                financeDashboardQ.data?.amc_revenue_cents,
                financeDashboardQ.data?.one_time_revenue_cents,
                (financeDashboardQ.data?.total_revenue_cents ?? 0) -
                  (financeDashboardQ.data?.amc_revenue_cents ?? 0) -
                  (financeDashboardQ.data?.one_time_revenue_cents ?? 0),
              )}`}
            />
            <FinanceKpi
              label="Customer payments"
              value={kpiMoney(financeDashboardQ, financeDashboardQ.data?.total_collections_cents)}
              hint={`Money received from customers. This includes the partner's share, not only OorjaMan's fee. ${splitHint(
                financeDashboardQ,
                financeDashboardQ.data?.amc_contract_collections_cents,
                Math.max(
                  0,
                  (financeDashboardQ.data?.total_collections_cents ?? 0) -
                    (financeDashboardQ.data?.amc_contract_collections_cents ?? 0),
                ),
                0,
                "AMC plans",
                "One-time visits",
              )}`}
            />
            <FinanceKpi
              label="AMC prepaid still held"
              value={kpiMoney(financeDashboardQ, financeDashboardQ.data?.amc_deferred_liability_paise)}
              hint="Customers paid this up front for AMC visits that have not happened yet. It is not OorjaMan income. When a visit is completed, the partner is paid and OorjaMan's fee is recognized. This is what has not been released."
            />
            <FinanceKpi
              label="Still to pay partners"
              value={kpiMoney(
                financeDashboardQ,
                (financeDashboardQ.data?.amc_vendor_payables_pending_paise ?? 0) +
                  (financeDashboardQ.data?.one_time_vendor_payables_pending_paise ?? 0),
              )}
              hint={`Partner share on finished visits that is not marked settled yet. ${splitHint(
                financeDashboardQ,
                financeDashboardQ.data?.amc_vendor_payables_pending_paise,
                financeDashboardQ.data?.one_time_vendor_payables_pending_paise,
              )}`}
            />
            <FinanceKpi
              label="Payouts to review"
              value={String(pendingPayouts)}
              hint="Visit payouts waiting for approval."
            />
            <FinanceKpi
              label="Penalties to review"
              value={String(pendingPenalties)}
              hint="Cancellation charges waiting for a decision."
            />
          </div>

          {backfillMut.isSuccess ? (
            <p className="dash-muted-line">
              Backfill: {backfillMut.data.created} created, {backfillMut.data.skipped} skipped (already had a row).
            </p>
          ) : null}

          {settlementsQuery.isError ? (
            <Card padded>
              <p className="fin-error">{settlementLoadErrorMessage(settlementsQuery.error)}</p>
            </Card>
          ) : null}

          <Card padded={false}>
            <div className="fin-toolbar">
              <div className="fin-field">
                <label className="fin-field-label" htmlFor="fin-filter-kind">
                  Type
                </label>
                <select
                  id="fin-filter-kind"
                  name="settlement_kind"
                  className="fin-select"
                  value={kindFilter}
                  onChange={(e) => {
                    setKindFilter(e.target.value as "" | VendorSettlementKind);
                    setPage(1);
                  }}
                >
                  <option value="">All types</option>
                  <option value="visit_payout">Visit payout</option>
                  <option value="cancellation_penalty">Cancellation penalty</option>
                </select>
              </div>
              <div className="fin-field">
                <label className="fin-field-label" htmlFor="fin-filter-status">
                  Status
                </label>
                <select
                  id="fin-filter-status"
                  name="settlement_status"
                  className="fin-select"
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value as "" | VendorSettlementStatus);
                    setPage(1);
                  }}
                >
                  <option value="">All statuses</option>
                  <option value="pending_review">Pending review</option>
                  <option value="approved">Approved</option>
                  <option value="settled">Settled</option>
                  <option value="waived">Waived</option>
                </select>
              </div>
            </div>

            {settlementsQuery.isLoading ? (
              <p className="bm-empty">Loading settlements…</p>
            ) : settlementsQuery.isError ? null : total === 0 ? (
              <p className="bm-empty">No settlement rows yet. Complete a visit or run backfill for historical visits.</p>
            ) : (
              <>
                <div className="bm-table-wrap">
                  <table className="bm-table fin-table">
                    <thead>
                      <tr>
                        <th>Visit</th>
                        <th>Partner</th>
                        <th>Type</th>
                        <th>Channel</th>
                        <th>Amount</th>
                        <th>Breakdown</th>
                        <th>Status</th>
                        <th>Created</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.map((row) => (
                        <SettlementRow
                          key={row.id}
                          row={row}
                          vendorName={vendorNameById.get(row.vendor_id) ?? row.vendor_id.slice(0, 8)}
                          editingPenalty={editingPenalty[row.id]}
                          onPenaltyEdit={(v) => setEditingPenalty((prev) => ({ ...prev, [row.id]: v }))}
                          onAction={(input) => void updateMut.mutateAsync({ id: row.id, ...input })}
                          busy={updateMut.isPending}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="fin-footer">
                  <TablePaginationBar page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
                </div>
              </>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

function SettlementRow({
  row,
  vendorName,
  editingPenalty,
  onPenaltyEdit,
  onAction,
  busy,
}: {
  row: VendorSettlementAdminRow;
  vendorName: string;
  editingPenalty?: string;
  onPenaltyEdit: (value: string) => void;
  onAction: (input: {
    status?: VendorSettlementStatus;
    penaltyFinalPaise?: number;
    adminNotes?: string;
  }) => void;
  busy: boolean;
}) {
  const amount = settlementDisplayAmountPaise(row);
  const isPenalty = row.kind === "cancellation_penalty";
  const isPartnerHeld = row.kind === "visit_payout" && row.customer_paid_to === "partner";
  const feePercent =
    row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>).platform_fee_percent
      : null;
  const taxableValuePaise =
    row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>).taxable_value_paise
      : null;
  const channelLabel = settlementVisitChannelLabel(row);
  const breakdown =
    row.kind === "visit_payout"
      ? `Gross ${formatInrFromPaise(row.visit_gross_paise ?? 0)} · Fee base (ex-GST) ${formatInrFromPaise(
          typeof taxableValuePaise === "number" ? taxableValuePaise : visitGrossTaxableValuePaise(row.visit_gross_paise ?? 0),
        )} · OorjaMan fee ${formatInrFromPaise(row.platform_fee_paise ?? 0)}${typeof feePercent === "number" ? ` (${feePercent}%)` : ""
      } · ${settlementCustomerPaidToLabel(row.customer_paid_to)}${
        row.status === "settled"
          ? isPartnerHeld
            ? " · Fee collected from vendor"
            : " · Fee settled"
          : isPartnerHeld
            ? " · Fee receivable, not settled"
            : " · Fee earned, payout not settled"
      }`
      : `Assessed ${formatInrFromPaise(row.penalty_assessed_paise ?? 0)}`;

  return (
    <tr>
      <td className="bm-cell-mono">{row.reference_code ?? row.booking_id.slice(0, 8)}</td>
      <td>{vendorName}</td>
      <td>{settlementKindLabel(row.kind)}</td>
      <td>{channelLabel ?? "-"}</td>
      <td className={isPenalty ? "fin-amount-penalty" : "fin-amount-payout"}>
        {isPenalty ? "Charge " : isPartnerHeld ? "Collect fee " : "Pay "}
        {formatInrFromPaise(amount)}
      </td>
      <td className="fin-breakdown">{breakdown}</td>
      <td>
        <Badge tone={statusTone(row.status)}>{settlementStatusLabel(row.status)}</Badge>
      </td>
      <td>{formatDisplayDateTime(row.created_at)}</td>
      <td>
        <div className="fin-row-actions">
          {isPenalty && row.status === "pending_review" ? (
            <>
              <label className="fin-sr-only" htmlFor={`fin-penalty-${row.id}`}>
                Final penalty (paise)
              </label>
              <input
                id={`fin-penalty-${row.id}`}
                name="penalty_final_paise"
                type="text"
                inputMode="numeric"
                className="fin-select fin-text-input fin-penalty-input"
                aria-label={`Final penalty for ${row.reference_code ?? row.booking_id}`}
                value={editingPenalty ?? String(row.penalty_final_paise ?? 0)}
                onChange={(e) => onPenaltyEdit(e.target.value.replace(/\D/g, ""))}
              />
            </>
          ) : null}
          {row.status === "pending_review" ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  onAction({
                    status: "approved",
                    ...(isPenalty && editingPenalty
                      ? { penaltyFinalPaise: Number(editingPenalty) }
                      : {}),
                  })
                }
              >
                Approve
              </Button>
              {isPenalty ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    onAction({
                      status: "waived",
                      ...(editingPenalty ? { penaltyFinalPaise: Number(editingPenalty) } : {}),
                    })
                  }
                >
                  Waive
                </Button>
              ) : null}
            </>
          ) : null}
          {row.status === "approved" ? (
            <Button
              type="button"
              size="sm"
              variant="primary"
              disabled={busy}
              onClick={() => onAction({ status: "settled" })}
            >
              Mark settled
            </Button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
