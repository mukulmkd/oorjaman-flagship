import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { DEFAULT_TABLE_PAGE_SIZE, queryKeys, technicianApi, vendorApi } from "@oorjaman/api";
import { Button, Card, PageHeader } from "@oorjaman/web-ui";
import { TablePaginationBar } from "../components/TablePaginationBar";
import { useSupabase } from "../lib/supabase-context";

type WatchRow =
  | {
      kind: "vendor";
      id: string;
      name: string;
      rating: number;
      count: number;
      r30?: number | null;
      c30?: number | null;
    }
  | {
      kind: "technician";
      id: string;
      name: string;
      rating: number;
      count: number;
      r30?: number | null;
      c30?: number | null;
    };

export function PartnerQualityPage() {
  const supabase = useSupabase();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);

  const vendorsQuery = useQuery({
    queryKey: queryKeys.vendors.adminList("approved"),
    queryFn: () => vendorApi.adminListVendors(supabase!, { approvalStatus: "approved" }),
    enabled: Boolean(supabase),
  });
  const vendorStatsQuery = useQuery({
    queryKey: queryKeys.vendors.publicStats(),
    queryFn: () => vendorApi.listVendorPublicStats(supabase!),
    enabled: Boolean(supabase),
  });
  const techniciansQuery = useQuery({
    queryKey: queryKeys.technicians.verificationQueue(),
    queryFn: () => technicianApi.adminListVendorApprovedTechnicians(supabase!),
    enabled: Boolean(supabase),
  });
  const techStatsQuery = useQuery({
    queryKey: queryKeys.technicians.publicStats(),
    queryFn: () => technicianApi.listTechnicianPublicStats(supabase!),
    enabled: Boolean(supabase),
  });

  const watchlistRowsAll = useMemo(() => {
    const vendorNameById = new Map((vendorsQuery.data ?? []).map((v) => [v.id, v.business_name] as const));
    const techById = new Map((techniciansQuery.data ?? []).map((t) => [t.id, t] as const));
    const lowVendors: WatchRow[] = (vendorStatsQuery.data ?? [])
      .filter((s) => (s.avg_rating ?? 5) < 3.8 && (s.rating_count ?? 0) >= 5)
      .sort((a, b) => (a.avg_rating ?? 5) - (b.avg_rating ?? 5))
      .slice(0, 80)
      .map((s) => ({
        kind: "vendor" as const,
        id: s.vendor_id,
        name: vendorNameById.get(s.vendor_id) ?? s.vendor_id.slice(0, 8),
        rating: s.avg_rating ?? 0,
        count: s.rating_count ?? 0,
        r30: s.avg_rating_30d ?? null,
        c30: s.rating_count_30d ?? null,
      }));
    const lowTechs: WatchRow[] = (techStatsQuery.data ?? [])
      .filter((s) => (s.avg_rating ?? 5) < 3.8 && (s.rating_count ?? 0) >= 5)
      .sort((a, b) => (a.avg_rating ?? 5) - (b.avg_rating ?? 5))
      .slice(0, 80)
      .map((s) => ({
        kind: "technician" as const,
        id: s.technician_id,
        name:
          techById.get(s.technician_id)?.employee_code ??
          techById.get(s.technician_id)?.user_id.slice(0, 8) ??
          s.technician_id.slice(0, 8),
        rating: s.avg_rating ?? 0,
        count: s.rating_count ?? 0,
        r30: s.avg_rating_30d ?? null,
        c30: s.rating_count_30d ?? null,
      }));
    return [...lowVendors, ...lowTechs].sort((a, b) => a.rating - b.rating);
  }, [vendorsQuery.data, techniciansQuery.data, vendorStatsQuery.data, techStatsQuery.data]);

  const total = watchlistRowsAll.length;
  const window = useMemo(
    () =>
      watchlistRowsAll.slice((page - 1) * DEFAULT_TABLE_PAGE_SIZE, page * DEFAULT_TABLE_PAGE_SIZE),
    [watchlistRowsAll, page],
  );

  const loading =
    vendorsQuery.isPending ||
    vendorStatsQuery.isPending ||
    techniciansQuery.isPending ||
    techStatsQuery.isPending;

  return (
    <>
      <PageHeader
        title="Partner quality"
        subtitle="Partners and technicians with sustained low ratings (≥5 reviews, average below 3.8). Review weekly - not a live ops queue."
      />

      {!supabase ? (
        <Card padded>
          <p className="bm-muted">Connect Supabase via Vite env variables.</p>
        </Card>
      ) : (
        <Card padded={false}>
          {loading ? (
            <p className="dash-table-empty">Loading quality watchlist…</p>
          ) : total === 0 ? (
            <p className="dash-table-empty">No low-rating partners or technicians on the watchlist.</p>
          ) : (
            <>
              <div className="bm-table-wrap">
                <table className="bm-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Name</th>
                      <th>Rating</th>
                      <th>Reviews</th>
                      <th>Last 30 days</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {window.map((w) => (
                      <tr key={`${w.kind}-${w.id}`}>
                        <td>{w.kind === "vendor" ? "Partner" : "Technician"}</td>
                        <td>{w.name}</td>
                        <td>{w.rating.toFixed(1)}</td>
                        <td>{w.count}</td>
                        <td>
                          {w.r30 != null ? w.r30.toFixed(1) : "-"} ({w.c30 ?? 0} reviews)
                        </td>
                        <td>
                          <Button
                            variant="outline"
                            size="sm"
                            type="button"
                            onClick={() =>
                              navigate(
                                w.kind === "vendor"
                                  ? "/dashboard/vendors/approved"
                                  : "/dashboard/technicians",
                              )
                            }
                          >
                            Open directory
                          </Button>
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
