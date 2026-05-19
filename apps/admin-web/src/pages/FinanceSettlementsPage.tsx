import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminBackfillVisitPayoutSettlements,
  adminGetPlatformSettings,
  adminListVendorSettlements,
  adminUpdatePlatformSettings,
  adminUpdateVendorSettlement,
  formatInrFromPaise,
  normalizeVendorPlatformFeePercent,
  queryKeys,
  settlementDisplayAmountPaise,
  settlementKindLabel,
  settlementStatusLabel,
  vendorApi,
  type VendorSettlementKind,
  type VendorSettlementRow,
  type VendorSettlementStatus,
} from "@oorjaman/api";
import { formatDisplayDateTime } from "@oorjaman/utils";
import { Badge, Button, Card, PageHeader } from "@oorjaman/web-ui";
import { TablePaginationBar } from "../components/TablePaginationBar";
import { useSupabase } from "../lib/supabase-context";
import "../layouts/dashboard-layout.css";
import "./finance-settlements-page.css";

const PAGE_SIZE = 10;

function statusTone(status: VendorSettlementStatus): "neutral" | "warning" | "success" | "danger" {
  if (status === "settled" || status === "waived") return "success";
  if (status === "approved") return "neutral";
  return "warning";
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
  }, [platformSettingsQ.isSuccess, platformSettingsQ.data?.vendor_platform_fee_percent]);

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
        subtitle="Partner payouts after completed visits, cancellation penalties, and platform commission from OorjaMan settings."
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            loading={backfillMut.isPending}
            onClick={() => void backfillMut.mutateAsync()}
          >
            Backfill completed visits
          </Button>
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
              Commission on completed visit gross. Stored on each payout row when the visit is completed; changing this
              does not recalculate existing rows.
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

          <div className="fin-kpi-grid">
            <div className="fin-kpi">
              <span className="fin-kpi-label">Payouts to review</span>
              <span className="fin-kpi-value">{pendingPayouts}</span>
            </div>
            <div className="fin-kpi">
              <span className="fin-kpi-label">Penalties to review</span>
              <span className="fin-kpi-value">{pendingPenalties}</span>
            </div>
            <div className="fin-kpi">
              <span className="fin-kpi-label">Ledger rows loaded</span>
              <span className="fin-kpi-value">{total}</span>
            </div>
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
  row: VendorSettlementRow;
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
  const feePercent =
    row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>).platform_fee_percent
      : null;
  const breakdown =
    row.kind === "visit_payout"
      ? `Gross ${formatInrFromPaise(row.visit_gross_paise ?? 0)} · Fee ${formatInrFromPaise(row.platform_fee_paise ?? 0)}${
          typeof feePercent === "number" ? ` (${feePercent}%)` : ""
        }`
      : `Assessed ${formatInrFromPaise(row.penalty_assessed_paise ?? 0)}`;

  return (
    <tr>
      <td className="bm-cell-mono">{row.reference_code ?? row.booking_id.slice(0, 8)}</td>
      <td>{vendorName}</td>
      <td>{settlementKindLabel(row.kind)}</td>
      <td className={isPenalty ? "fin-amount-penalty" : "fin-amount-payout"}>
        {isPenalty ? "Charge " : "Pay "}
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
          {row.status === "approved" || row.status === "pending_review" ? (
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
