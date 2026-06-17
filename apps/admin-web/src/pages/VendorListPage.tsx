import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { DEFAULT_TABLE_PAGE_SIZE, queryKeys, vendorApi } from "@oorjaman/api";
import {
  Badge,
  Button,
  Card,
  PageHeader,
  TableRowsSkeleton,
  Tabs,
} from "@oorjaman/web-ui";
import { TablePaginationBar } from "../components/TablePaginationBar";
import { useSupabase } from "../lib/supabase-client";
import {
  approvalBadgeTone,
  formatSubmittedAt,
  parseVendorTab,
  tabStatuses,
  type VendorTab,
} from "../lib/vendor-approval-utils";

const TAB_ITEMS: { id: VendorTab; label: string }[] = [
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
];

export function VendorListPage() {
  const supabase = useSupabase();
  const navigate = useNavigate();
  const { tab: tabParam } = useParams<{ tab: string }>();
  const tab = parseVendorTab(tabParam);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [tab]);

  useEffect(() => {
    if (tabParam !== tab && tabParam !== undefined) {
      navigate(`/dashboard/vendors/${tab}`, { replace: true });
    }
  }, [tabParam, tab, navigate]);

  const statuses = tabStatuses(tab);

  const query = useQuery({
    queryKey: queryKeys.vendors.adminListPage(tab, page, DEFAULT_TABLE_PAGE_SIZE),
    queryFn: () =>
      vendorApi.adminListVendorsPaged(supabase!, { approvalStatus: statuses }, { page, pageSize: DEFAULT_TABLE_PAGE_SIZE }),
    enabled: Boolean(supabase),
    placeholderData: (prev) => prev,
  });

  const rows = useMemo(() => query.data?.rows ?? [], [query.data?.rows]);
  const total = query.data?.total ?? 0;
  const vendorIds = useMemo(() => rows.map((v) => v.id), [rows]);
  const vendorIdsKey = useMemo(() => [...vendorIds].sort().join(","), [vendorIds]);

  const statsQuery = useQuery({
    queryKey: queryKeys.vendors.publicStats(vendorIdsKey),
    queryFn: () => vendorApi.listVendorPublicStats(supabase!, vendorIds),
    enabled: Boolean(supabase && vendorIds.length > 0 && !query.isFetching),
  });
  const statsByVendorId = useMemo(
    () => new Map((statsQuery.data ?? []).map((s) => [s.vendor_id, s] as const)),
    [statsQuery.data],
  );
  const statsLoading = statsQuery.isPending || statsQuery.isFetching;

  return (
    <>
      <PageHeader
        title="All vendors"
        subtitle="Partner directory by approval status."
        actions={
          <>
            <Button variant="outline" size="sm" type="button" onClick={() => navigate("/dashboard/vendor-approval")}>
              Approval queue
            </Button>
            <Button variant="outline" size="sm" type="button" onClick={() => void query.refetch()}>
              Refresh
            </Button>
          </>
        }
      />

      {!supabase ? (
        <Card padded>
          <p className="dash-muted-line">
            Connect Supabase via Vite env variables to load vendors.
          </p>
        </Card>
      ) : (
        <>
          <div className="dash-section-gap">
            <Tabs
              aria-label="Approval queue"
              items={TAB_ITEMS}
              activeId={tab}
              onChange={(id) => navigate(`/dashboard/vendors/${id}`)}
            />
          </div>

          <Card padded={false}>
            {query.isLoading ? (
              <div className="dash-table-skeleton-wrap">
                <TableRowsSkeleton rows={7} />
              </div>
            ) : query.isError ? (
              <div className="dash-table-empty">
                <p className="dash-empty-title">
                  Couldn&apos;t load vendors
                </p>
                <p className="dash-empty-error">
                  {(query.error as Error).message}
                </p>
                <p className="dash-empty-help">
                  Ensure you are signed in as a user with{" "}
                  <code className="dash-mono">public.users.role = admin</code>.
                </p>
                <div className="dash-top-gap">
                  <Button variant="primary" size="sm" type="button" onClick={() => void query.refetch()}>
                    Retry
                  </Button>
                </div>
              </div>
            ) : total === 0 ? (
              <div className="dash-table-empty">
                <p className="dash-empty-title">
                  No vendors in this queue
                </p>
                <p className="dash-empty-help dash-empty-help-narrow">
                  When partners submit registration, they will appear here by approval stage.
                </p>
              </div>
            ) : (
              <>
                <div className="bm-table-wrap">
                  <table className="bm-table">
                    <thead>
                      <tr>
                        <th>Business</th>
                        <th>Status</th>
                        <th>Contact</th>
                        <th>Submitted</th>
                        <th>Performance</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((v) => (
                        <tr key={v.id}>
                          <td>
                            <strong>{v.business_name}</strong>
                            {v.trade_name ? (
                              <div className="dash-mono" style={{ fontSize: "var(--type-xs)", color: "var(--wb-muted-fg)" }}>
                                {v.trade_name}
                              </div>
                            ) : null}
                          </td>
                          <td>
                            <Badge tone={approvalBadgeTone(v.approval_status)}>{v.approval_status}</Badge>
                          </td>
                          <td>
                            <div>{v.contact_email ?? "-"}</div>
                            <div className="dash-mono" style={{ fontSize: "var(--type-xs)" }}>
                              {v.contact_phone ?? "-"}
                            </div>
                          </td>
                          <td>{formatSubmittedAt(v.submitted_at)}</td>
                          <td>
                            {statsLoading ? (
                              <div className="dash-mono" style={{ fontSize: "var(--type-xs)", color: "var(--wb-muted-fg)" }}>
                                Loading…
                              </div>
                            ) : statsQuery.isError ? (
                              <div className="dash-mono" style={{ fontSize: "var(--type-xs)", color: "var(--wb-destructive)" }}>
                                Stats unavailable
                              </div>
                            ) : (
                              <>
                                <div>{(statsByVendorId.get(v.id)?.total_jobs ?? 0).toString()} services</div>
                                <div className="dash-mono" style={{ fontSize: "var(--type-xs)", color: "var(--wb-muted-fg)" }}>
                                  {statsByVendorId.get(v.id)?.avg_rating != null
                                    ? `${statsByVendorId.get(v.id)!.avg_rating!.toFixed(1)} / 5`
                                    : "No rating"}
                                  {statsByVendorId.get(v.id)?.rating_count
                                    ? ` (${statsByVendorId.get(v.id)!.rating_count})`
                                    : ""}
                                </div>
                              </>
                            )}
                          </td>
                          <td>
                            <Button
                              variant="ghost"
                              size="sm"
                              type="button"
                              onClick={() => navigate(`/dashboard/vendors/item/${v.id}`, { state: { tab } })}
                            >
                              View
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ padding: "0.75rem 1rem" }}>
                  <TablePaginationBar
                    page={page}
                    pageSize={DEFAULT_TABLE_PAGE_SIZE}
                    total={total}
                    onPageChange={setPage}
                  />
                </div>
              </>
            )}
          </Card>
        </>
      )}
    </>
  );
}
