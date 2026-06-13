import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { DEFAULT_TABLE_PAGE_SIZE, queryKeys, technicianApi, vendorApi } from "@oorjaman/api";
import { formatDisplayDateTime } from "@oorjaman/utils";
import { Badge, Button, Card, Input, PageHeader, TableRowsSkeleton } from "@oorjaman/web-ui";
import { useSupabase } from "../lib/supabase-context";
import { TablePaginationBar } from "../components/TablePaginationBar";

type TechHistorySummary = {
  total: number;
  completed: number;
  active: number;
  latestScheduledAt: string | null;
};

function formatVendorLabel(v: { id: string; business_name: string; trade_name: string | null }): string {
  return v.trade_name?.trim() ? `${v.business_name} (${v.trade_name})` : v.business_name;
}

export function TechnicianDirectoryPage() {
  const supabase = useSupabase();
  const navigate = useNavigate();
  const [selectedVendorId, setSelectedVendorId] = useState<string>("all");
  const [onlyVerified, setOnlyVerified] = useState<boolean>(true);
  const [search, setSearch] = useState("");
  const [directoryPage, setDirectoryPage] = useState(1);

  useEffect(() => {
    setDirectoryPage(1);
  }, [selectedVendorId, onlyVerified, search]);

  const query = useQuery({
    queryKey: queryKeys.technicians.directory(),
    queryFn: () => technicianApi.adminListVendorApprovedTechnicians(supabase!),
    enabled: Boolean(supabase),
  });
  const vendorsQuery = useQuery({
    queryKey: queryKeys.vendors.adminList("approved"),
    queryFn: () => vendorApi.adminListVendors(supabase!, { approvalStatus: "approved" }),
    enabled: Boolean(supabase),
  });
  const techStatsQuery = useQuery({
    queryKey: queryKeys.technicians.publicStats((query.data ?? []).map((t) => t.id).join(",")),
    queryFn: () => technicianApi.listTechnicianPublicStats(supabase!, (query.data ?? []).map((t) => t.id)),
    enabled: Boolean(supabase && query.data),
  });
  const techIdsKey = useMemo(() => (query.data ?? []).map((t) => t.id).join(","), [query.data]);
  const historyQuery = useQuery({
    queryKey: queryKeys.technicians.jobHistory(techIdsKey, selectedVendorId === "all" ? undefined : selectedVendorId),
    queryFn: () =>
      technicianApi.adminListTechnicianJobHistory(supabase!, {
        technicianIds: (query.data ?? []).map((t) => t.id),
        vendorId: selectedVendorId === "all" ? null : selectedVendorId,
        limit: 500,
      }),
    enabled: Boolean(supabase && query.data && (query.data?.length ?? 0) > 0),
  });

  const statsByTechId = new Map((techStatsQuery.data ?? []).map((s) => [s.technician_id, s] as const));
  const vendorById = new Map((vendorsQuery.data ?? []).map((v) => [v.id, v] as const));
  const historyByTechId = useMemo(() => {
    const out = new Map<string, TechHistorySummary>();
    for (const row of historyQuery.data ?? []) {
      if (!row.technician_id) continue;
      const prev = out.get(row.technician_id) ?? {
        total: 0,
        completed: 0,
        active: 0,
        latestScheduledAt: null,
      };
      prev.total += 1;
      if (row.status === "completed") prev.completed += 1;
      if (row.status === "accepted" || row.status === "in_progress") prev.active += 1;
      if (!prev.latestScheduledAt || row.scheduled_start > prev.latestScheduledAt) prev.latestScheduledAt = row.scheduled_start;
      out.set(row.technician_id, prev);
    }
    return out;
  }, [historyQuery.data]);
  const searchLower = search.trim().toLowerCase();
  const filteredRows = useMemo(() => {
    const rows = query.data ?? [];
    return rows.filter((t) => {
      if (selectedVendorId !== "all" && t.vendor_id !== selectedVendorId) return false;
      if (onlyVerified && !(t.vendor_review_status === "approved" && t.is_verified)) return false;
      if (!searchLower) return true;
      const hay = [
        t.user_id,
        t.employee_code ?? "",
        t.personal_phone ?? "",
        t.contact_email ?? "",
        t.vendor_id ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(searchLower);
    });
  }, [query.data, selectedVendorId, onlyVerified, searchLower]);

  const directoryTotal = filteredRows.length;
  const directoryWindow = useMemo(
    () =>
      filteredRows.slice(
        (directoryPage - 1) * DEFAULT_TABLE_PAGE_SIZE,
        directoryPage * DEFAULT_TABLE_PAGE_SIZE,
      ),
    [filteredRows, directoryPage],
  );

  return (
    <>
      <PageHeader
        title="Technician directory"
        subtitle="Readonly list of vendor-approved technicians. Vendor teams manage verification and onboarding."
        actions={
          <Button variant="outline" size="sm" type="button" onClick={() => void query.refetch()}>
            Refresh
          </Button>
        }
      />

      {!supabase ? (
        <Card padded>
          <p className="dash-muted-line">Connect Supabase via Vite env variables.</p>
        </Card>
      ) : (
        <>
          <Card padded>
            <div className="dash-card-grid">
              <div>
                <label className="dash-card-label" htmlFor="tech-vendor-filter">
                  Vendor filter
                </label>
                <select
                  id="tech-vendor-filter"
                  className="vd-select"
                  value={selectedVendorId}
                  onChange={(e) => setSelectedVendorId(e.target.value)}
                >
                  <option value="all">All approved vendors</option>
                  {(vendorsQuery.data ?? []).map((v) => (
                    <option key={v.id} value={v.id}>
                      {formatVendorLabel(v)}
                    </option>
                  ))}
                </select>
              </div>
              <Input
                label="Search technician"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="user id, employee code, email or phone"
              />
              <div>
                <p className="dash-card-label">Verification scope</p>
                <label className="dash-card-sub">
                  <input
                    type="checkbox"
                    checked={onlyVerified}
                    onChange={(e) => setOnlyVerified(e.target.checked)}
                  />{" "}
                  Show only verified technicians
                </label>
              </div>
            </div>
          </Card>
          <Card padded={false}>
            {query.isLoading ? (
              <div className="dash-table-empty">
                <div className="dash-table-skeleton-wrap-sm">
                  <TableRowsSkeleton rows={8} />
                </div>
              </div>
            ) : query.isError ? (
              <div className="dash-table-empty">
                <p className="dash-empty-error">{(query.error as Error).message}</p>
              </div>
            ) : !query.data?.length ? (
              <div className="dash-table-empty">No vendor-approved technicians found.</div>
            ) : filteredRows.length === 0 ? (
              <div className="dash-table-empty">No technicians match the selected filters.</div>
            ) : (
              <>
                <div className="bm-table-wrap">
                  <table className="bm-table">
                    <thead>
                      <tr>
                        <th>Technician ID</th>
                        <th>Verification</th>
                        <th>Vendor</th>
                        <th>Jobs</th>
                        <th>Performance</th>
                        <th>Last job</th>
                        <th>Vendor review</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {directoryWindow.map((t) => (
                        <tr key={t.id}>
                          <td className="dash-mono">{t.user_id.slice(0, 8)}…</td>
                          <td>
                            <Badge tone={t.is_verified ? "success" : "warning"}>
                              {t.is_verified ? "verified" : "pending"}
                            </Badge>
                          </td>
                          <td>{t.vendor_id ? vendorById.get(t.vendor_id)?.business_name ?? t.vendor_id.slice(0, 8) + "…" : "-"}</td>
                          <td>
                            {(historyByTechId.get(t.id)?.total ?? 0).toString()}
                            <span className="dash-help" style={{ display: "block", fontSize: "0.75rem", marginTop: "0.15rem" }}>
                              done {(historyByTechId.get(t.id)?.completed ?? 0).toString()} · active{" "}
                              {(historyByTechId.get(t.id)?.active ?? 0).toString()}
                            </span>
                          </td>
                          <td>
                            <span>{(statsByTechId.get(t.id)?.total_jobs ?? 0).toString()} services</span>
                            <span style={{ display: "block", marginTop: "0.25rem" }}>
                              {statsByTechId.get(t.id)?.avg_rating != null
                                ? `${statsByTechId.get(t.id)!.avg_rating!.toFixed(1)} / 5`
                                : "-"}
                              {statsByTechId.get(t.id)?.rating_count ? ` (${statsByTechId.get(t.id)!.rating_count})` : ""}
                            </span>
                            <span className="dash-help" style={{ display: "block", fontSize: "0.75rem", marginTop: "0.15rem" }}>
                              30d:{" "}
                              {statsByTechId.get(t.id)?.avg_rating_30d != null
                                ? `${statsByTechId.get(t.id)!.avg_rating_30d!.toFixed(1)} / 5`
                                : "-"}{" "}
                              ({statsByTechId.get(t.id)?.rating_count_30d ?? 0})
                            </span>
                          </td>
                          <td style={{ whiteSpace: "nowrap", fontSize: "0.85rem" }}>
                            {historyByTechId.get(t.id)?.latestScheduledAt
                              ? formatDisplayDateTime(historyByTechId.get(t.id)!.latestScheduledAt!)
                              : "-"}
                          </td>
                          <td>{t.vendor_review_status}</td>
                          <td>
                            <Button
                              variant="ghost"
                              size="sm"
                              type="button"
                              onClick={() => navigate(`/dashboard/technicians/item/${t.id}`)}
                            >
                              View
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ padding: "0.75rem 1rem 1rem" }}>
                  <TablePaginationBar page={directoryPage} total={directoryTotal} onPageChange={setDirectoryPage} />
                </div>
              </>
            )}
          </Card>
        </>
      )}
    </>
  );
}
