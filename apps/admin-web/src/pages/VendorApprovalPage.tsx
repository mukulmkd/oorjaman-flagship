import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { DEFAULT_TABLE_PAGE_SIZE, queryKeys, vendorIntakeApi } from "@oorjaman/api";
import type { VendorRegistrationIntakeRow } from "@oorjaman/api";
import {
  Badge,
  Button,
  Card,
  PageHeader,
  TableRowsSkeleton,
} from "@oorjaman/web-ui";
import { TablePaginationBar } from "../components/TablePaginationBar";
import { useSupabase } from "../lib/supabase-context";
import {
  cityFromRegisteredAddress,
  formatIntakeExperienceLine,
  formatSubmittedAt,
} from "../lib/vendor-approval-utils";
import "../layouts/dashboard-layout.css";

function intakeDisplayName(row: VendorRegistrationIntakeRow): string {
  const form = row.form_data;
  if (form && typeof form === "object" && !Array.isArray(form)) {
    const f = form as Record<string, unknown>;
    const n =
      typeof f.contact_person_name === "string" && f.contact_person_name.trim()
        ? f.contact_person_name.trim()
        : typeof f.business_name === "string"
          ? f.business_name.trim()
          : "";
    if (n) return n;
  }
  return "-";
}

export function VendorApprovalPage() {
  const supabase = useSupabase();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: queryKeys.vendors.intakeApprovalQueuePage(page, DEFAULT_TABLE_PAGE_SIZE),
    queryFn: () =>
      vendorIntakeApi.adminListVendorRegistrationIntakesPaged(supabase!, { status: "submitted" }, {
        page,
        pageSize: DEFAULT_TABLE_PAGE_SIZE,
      }),
    enabled: Boolean(supabase),
    placeholderData: (prev) => prev,
  });

  const rows = query.data?.rows ?? [];
  const total = query.data?.total ?? 0;

  return (
    <>
      <PageHeader
        title="Vendor approval"
        subtitle="Submitted partner applications (intake). Approving creates the vendor login and organisation record. Use All vendors for the full directory."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => navigate("/dashboard/vendors/pending")}
            >
              All vendors
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
            Connect Supabase via Vite env variables to load applications.
          </p>
        </Card>
      ) : (
        <Card padded={false}>
          {query.isLoading ? (
            <div className="dash-table-empty">
              <div className="dash-table-skeleton-wrap-sm">
                <TableRowsSkeleton rows={8} />
              </div>
            </div>
          ) : query.isError ? (
            <div className="dash-table-empty">
              <p className="dash-empty-error">
                {(query.error as Error).message}
              </p>
              <p className="dash-empty-help">
                Ensure you are signed in as a user with{" "}
                <code className="dash-mono">public.users.role = admin</code>.
              </p>
            </div>
          ) : total === 0 ? (
            <div className="dash-table-empty">No partner applications awaiting review.</div>
          ) : (
            <>
              <div className="bm-table-wrap">
                <table className="bm-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Company</th>
                      <th>City</th>
                      <th>Experience</th>
                      <th>Submitted</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const form = row.form_data;
                      const addr =
                        form && typeof form === "object" && !Array.isArray(form)
                          ? (form as Record<string, unknown>).registered_address
                          : null;
                      return (
                        <tr key={row.id}>
                          <td>{intakeDisplayName(row)}</td>
                          <td>{row.business_name ?? "-"}</td>
                          <td>{cityFromRegisteredAddress(addr)}</td>
                          <td>{formatIntakeExperienceLine(row.form_data)}</td>
                          <td>{row.submitted_at ? formatSubmittedAt(row.submitted_at) : "-"}</td>
                          <td>
                            <Badge tone="warning">{row.status}</Badge>
                          </td>
                          <td>
                            <Button
                              variant="outline"
                              size="sm"
                              type="button"
                              onClick={() =>
                                navigate(`/dashboard/vendors/intake/${row.id}`, {
                                  state: { fromVendorApproval: true },
                                })
                              }
                            >
                              Open
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
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
      )}
    </>
  );
}
