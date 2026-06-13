import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminAssignAmcSubscriptionVendor,
  adminListAmcContracts,
  amcContractStatusLabel,
  formatInrFromPaise,
  queryKeys,
  vendorApi,
  type AmcContractAdminRow,
  type AmcContractStatus,
} from "@oorjaman/api";
import { formatDisplayDateTime } from "@oorjaman/utils";
import { Badge, Button, Card, PageHeader } from "@oorjaman/web-ui";
import { Link, useSearchParams } from "react-router-dom";
import { useSupabase } from "../lib/supabase-context";
import "./amc-contracts-page.css";

const STATUS_OPTIONS: { value: "" | AmcContractStatus; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "pending_funding", label: "Awaiting payment" },
  { value: "funded", label: "Active" },
  { value: "depleted", label: "Fully allocated" },
  { value: "cancelled", label: "Cancelled" },
];

function contractStatusTone(status: AmcContractStatus): "neutral" | "warning" | "success" | "danger" {
  if (status === "funded") return "success";
  if (status === "pending_funding") return "warning";
  if (status === "depleted") return "neutral";
  return "danger";
}

export function AmcContractsPage() {
  const supabase = useSupabase();
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const highlightSubscriptionId = searchParams.get("highlight")?.trim() || null;
  const highlightRowRef = useRef<HTMLTableRowElement | null>(null);
  const [statusFilter, setStatusFilter] = useState<"" | AmcContractStatus>("");
  const [assignVendorBySub, setAssignVendorBySub] = useState<Record<string, string>>({});
  const [reassignOpenBookings, setReassignOpenBookings] = useState(true);

  const statusKey = statusFilter || "all";

  const contractsQuery = useQuery({
    queryKey: queryKeys.finance.amcContracts(statusKey),
    queryFn: () =>
      adminListAmcContracts(supabase!, {
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
    const m = new Map<string, string>();
    for (const v of vendorsQuery.data ?? []) {
      m.set(v.id, v.trade_name?.trim() || v.business_name);
    }
    return m;
  }, [vendorsQuery.data]);

  const assignVendorMut = useMutation({
    mutationFn: async ({
      subscriptionId,
      vendorId,
      reassignOpen,
    }: {
      subscriptionId: string;
      vendorId: string;
      reassignOpen: boolean;
    }) => {
      if (!supabase) throw new Error("No Supabase client");
      return adminAssignAmcSubscriptionVendor(supabase, subscriptionId, vendorId, {
        reassignOpenBookings: reassignOpen,
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.finance.all() });
      await qc.invalidateQueries({ queryKey: queryKeys.subscriptions.all() });
      await qc.invalidateQueries({ queryKey: queryKeys.bookings.all() });
    },
  });

  const contracts = contractsQuery.data ?? [];

  useEffect(() => {
    if (!highlightSubscriptionId || contractsQuery.isPending) return;
    const row = highlightRowRef.current;
    if (!row) return;
    row.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [highlightSubscriptionId, contractsQuery.isPending, contracts.length]);

  return (
    <div className="amc-contracts-page">
      <PageHeader
        title="AMC contracts"
        subtitle="Customer AMC payments are collected by OorjaMan. Deferred balance is released per settled visit; platform revenue is recognized when you mark the AMC payout settled."
        actions={
          <Link to="/dashboard/finance" className="amc-contracts-back-link">
            ← Finance & settlements
          </Link>
        }
      />

      <Card padded className="amc-contracts-filters">
        <label className="amc-contracts-filter-label" htmlFor="amc-contract-status">
          Contract status
        </label>
        <select
          id="amc-contract-status"
          className="amc-contracts-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "" | AmcContractStatus)}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value || "all"} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <label className="amc-contracts-checkbox-label">
          <input
            type="checkbox"
            checked={reassignOpenBookings}
            onChange={(e) => setReassignOpenBookings(e.target.checked)}
          />
          When changing AMC partner, also reassign open AMC visits
        </label>
      </Card>

      {contractsQuery.isError ? (
        <Card padded>
          <p>{(contractsQuery.error as Error).message}</p>
        </Card>
      ) : contractsQuery.isPending ? (
        <Card padded>
          <p>Loading AMC contracts…</p>
        </Card>
      ) : contracts.length === 0 ? (
        <Card padded>
          <p>No AMC contracts match this filter.</p>
        </Card>
      ) : (
        <div className="amc-contracts-table-wrap">
          <table className="amc-contracts-table">
            <thead>
              <tr>
                <th>Subscription</th>
                <th>Status</th>
                <th>Deferred balance</th>
                <th>Visits</th>
                <th>Assigned partner</th>
                <th>Assign / change partner</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((c: AmcContractAdminRow) => {
                const sub = c.subscription;
                const assignedName = c.assigned_vendor_id
                  ? vendorNameById.get(c.assigned_vendor_id) ?? c.assigned_vendor_id.slice(0, 8)
                  : "-";
                const selectedVendor = assignVendorBySub[c.subscription_id] ?? c.assigned_vendor_id ?? "";
                const canAssign = Boolean(selectedVendor) && selectedVendor !== c.assigned_vendor_id;
                const highlighted = highlightSubscriptionId === c.subscription_id;
                return (
                  <tr
                    key={c.id}
                    ref={highlighted ? highlightRowRef : undefined}
                    className={highlighted ? "amc-contracts-row-highlight" : undefined}
                  >
                    <td>
                      <div className="amc-contracts-sub-cell">
                        <strong>{sub?.plan_name ?? "AMC"}</strong>
                        <span className="amc-contracts-sub-meta">
                          {sub?.status ?? "-"}
                          {sub?.ends_at ? ` · ends ${formatDisplayDateTime(sub.ends_at)}` : ""}
                        </span>
                        <span className="amc-contracts-sub-id">{c.subscription_id}</span>
                      </div>
                    </td>
                    <td>
                      <Badge tone={contractStatusTone(c.status)}>{amcContractStatusLabel(c.status)}</Badge>
                      {c.funded_at ? (
                        <div className="amc-contracts-sub-meta">Paid {formatDisplayDateTime(c.funded_at)}</div>
                      ) : null}
                    </td>
                    <td>
                      <div>{formatInrFromPaise(c.balance_paise)}</div>
                      <div className="amc-contracts-sub-meta">
                        of {formatInrFromPaise(c.total_funded_paise)} collected
                      </div>
                      <div className="amc-contracts-sub-meta">
                        Released to partners {formatInrFromPaise(c.released_to_vendor_paise)} · OorjaMan fee{" "}
                        {formatInrFromPaise(c.platform_fee_collected_paise)} (on settled visits)
                      </div>
                    </td>
                    <td>
                      {c.visits_released} / {c.visits_allocated} settled
                      <div className="amc-contracts-sub-meta">
                        {formatInrFromPaise(c.per_visit_alloc_paise)} per visit allocation
                      </div>
                    </td>
                    <td>{assignedName}</td>
                    <td>
                      <div className="amc-contracts-assign-row">
                        <select
                          className="amc-contracts-select"
                          value={selectedVendor}
                          onChange={(e) =>
                            setAssignVendorBySub((prev) => ({
                              ...prev,
                              [c.subscription_id]: e.target.value,
                            }))
                          }
                        >
                          <option value="">Choose vendor…</option>
                          {(vendorsQuery.data ?? []).map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.business_name}
                            </option>
                          ))}
                        </select>
                        <Button
                          size="sm"
                          variant="primary"
                          disabled={!canAssign || assignVendorMut.isPending}
                          onClick={() =>
                            assignVendorMut.mutate({
                              subscriptionId: c.subscription_id,
                              vendorId: selectedVendor,
                              reassignOpen: reassignOpenBookings,
                            })
                          }
                        >
                          {c.assigned_vendor_id ? "Change" : "Assign"}
                        </Button>
                      </div>
                      {assignVendorMut.isError &&
                      assignVendorMut.variables?.subscriptionId === c.subscription_id ? (
                        <p className="amc-contracts-error">{(assignVendorMut.error as Error).message}</p>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
