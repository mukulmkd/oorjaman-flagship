import { webTypography } from "./../styles/typography";
import { useCallback, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createVendorDocumentSignedUrl, queryKeys, vendorApi } from "@oorjaman/api";
import {
  Badge,
  Button,
  Card,
  Modal,
  PageHeader,
  TableRowsSkeleton,
  TextArea,
} from "@oorjaman/web-ui";
import { DocumentViewButton } from "../components/DocumentViewer";
import { useSupabase } from "../lib/supabase-client";
import {
  approvalBadgeTone,
  formatSubmittedAt,
  parseVendorTab,
  vendorApprovalListPath,
} from "../lib/vendor-approval-utils";

function vendorLogoStoragePath(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const p = (metadata as Record<string, unknown>).company_logo_storage_path;
  return typeof p === "string" && p.trim() ? p.trim() : null;
}

function stringifyAddress(value: unknown): string {
  if (value == null) return "-";
  if (typeof value === "string") return value || "-";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function VendorDetailPage() {
  const supabase = useSupabase();
  const resolveVendorDocUrl = useCallback(
    (storagePath: string) => createVendorDocumentSignedUrl(supabase!, storagePath),
    [supabase],
  );
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const { vendorId } = useParams<{ vendorId: string }>();

  const listTab = useMemo(() => {
    const st = location.state as { tab?: string } | null;
    return parseVendorTab(st?.tab);
  }, [location.state]);

  const fromVendorApproval = useMemo(() => {
    const st = location.state as { fromVendorApproval?: boolean } | null;
    return Boolean(st?.fromVendorApproval);
  }, [location.state]);

  const fromReview = useMemo(() => {
    const st = location.state as { fromRegistrationReview?: boolean; fromVendorApproval?: boolean } | null;
    return Boolean(st?.fromRegistrationReview || st?.fromVendorApproval);
  }, [location.state]);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const detailQuery = useQuery({
    queryKey: vendorId ? queryKeys.vendors.detail(vendorId) : [],
    queryFn: () => vendorApi.adminGetVendor(supabase!, vendorId!),
    enabled: Boolean(supabase && vendorId),
  });
  const statsQuery = useQuery({
    queryKey: queryKeys.vendors.publicStats(vendorId ?? ""),
    queryFn: () => vendorApi.listVendorPublicStats(supabase!, vendorId ? [vendorId] : []),
    enabled: Boolean(supabase && vendorId),
  });

  const approveMut = useMutation({
    mutationFn: async () => {
      const v = detailQuery.data;
      if (!supabase || !v) throw new Error("Missing vendor");
      return vendorApi.adminSetVendorApproval(supabase, v.id, { decision: "approved" });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.vendors.all() });
      if (fromVendorApproval) {
        navigate("/dashboard/vendor-approval");
        return;
      }
      navigate(fromReview ? vendorApprovalListPath("approved") : `/dashboard/vendors/${listTab}`);
    },
  });

  const rejectMut = useMutation({
    mutationFn: async () => {
      const v = detailQuery.data;
      if (!supabase || !v) throw new Error("Missing vendor");
      const reason = rejectReason.trim();
      if (!reason) throw new Error("Rejection reason is required.");
      return vendorApi.adminSetVendorApproval(supabase, v.id, {
        decision: "rejected",
        rejectionReason: reason,
      });
    },
    onSuccess: () => {
      setRejectOpen(false);
      setRejectReason("");
      void qc.invalidateQueries({ queryKey: queryKeys.vendors.all() });
      if (fromVendorApproval) {
        navigate("/dashboard/vendor-approval");
        return;
      }
      navigate(fromReview ? vendorApprovalListPath("rejected") : `/dashboard/vendors/rejected`);
    },
  });

  const v = detailQuery.data;
  const vStats = statsQuery.data?.[0] ?? null;
  const vendorLogoPath = v ? vendorLogoStoragePath(v.metadata) : null;
  const canDecide =
    v && (v.approval_status === "pending" || v.approval_status === "under_review");

  return (
    <>
      <PageHeader
        title={v?.business_name ?? "Vendor"}
        subtitle={v ? `${v.trade_name ?? "No trade name"} · ${formatSubmittedAt(v.submitted_at)}` : "…"}
        actions={
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => {
              if (fromVendorApproval) {
                navigate("/dashboard/vendor-approval");
                return;
              }
              navigate(fromReview ? vendorApprovalListPath(listTab) : `/dashboard/vendors/${listTab}`);
            }}
          >
            Back
          </Button>
        }
      />

      {!supabase ? (
        <Card padded>
          <p style={{ margin: 0, fontSize: webTypography.size.sm, color: "var(--wb-muted-fg)" }}>
            Configure Supabase environment variables first.
          </p>
        </Card>
      ) : detailQuery.isLoading ? (
        <Card padded>
          <TableRowsSkeleton rows={5} />
        </Card>
      ) : detailQuery.isError ? (
        <Card padded>
          <p style={{ margin: "0 0 0.5rem", fontWeight: webTypography.weight.semibold }}>Couldn&apos;t load vendor</p>
          <p style={{ margin: "0 0 1rem", color: "var(--wb-destructive)", fontSize: webTypography.size.sm }}>
            {(detailQuery.error as Error).message}
          </p>
          <Button variant="primary" size="sm" type="button" onClick={() => void detailQuery.refetch()}>
            Retry
          </Button>
        </Card>
      ) : !v ? (
        <Card padded>
          <p style={{ margin: 0, color: "var(--wb-muted-fg)" }}>Vendor not found.</p>
        </Card>
      ) : (
        <>
          {approveMut.isError ? (
            <p style={{ margin: "0 0 1rem", fontSize: webTypography.size.sm, color: "var(--wb-destructive)" }}>
              {(approveMut.error as Error).message}
            </p>
          ) : null}
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1rem" }}>
            <Badge tone={approvalBadgeTone(v.approval_status)}>{v.approval_status}</Badge>
            <Badge tone="neutral">{(vStats?.total_jobs ?? 0).toString()} services</Badge>
            <Badge tone="neutral">
              {vStats?.avg_rating != null ? `${vStats.avg_rating.toFixed(1)} / 5` : "No rating"}
              {vStats?.rating_count ? ` (${vStats.rating_count})` : ""}
            </Badge>
            <Badge tone="neutral">
              30d {vStats?.avg_rating_30d != null ? `${vStats.avg_rating_30d.toFixed(1)} / 5` : "-"}
              {vStats?.rating_count_30d ? ` (${vStats.rating_count_30d})` : ""}
            </Badge>
          </div>

          <div className="dash-detail-grid">
            <Card padded>
              <h3 style={{ margin: "0 0 1rem", fontSize: webTypography.size.md, fontWeight: webTypography.weight.bold }}>Business</h3>
              <dl className="dash-dl">
                <dt>GSTIN</dt>
                <dd>{v.gstin ?? "-"}</dd>
                <dt style={{ marginTop: "0.75rem" }}>PAN</dt>
                <dd>{v.pan ?? "-"}</dd>
                <dt style={{ marginTop: "0.75rem" }}>Operating regions</dt>
                <dd>{v.operating_regions?.length ? v.operating_regions.join(", ") : "-"}</dd>
              </dl>
            </Card>
            <Card padded>
              <h3 style={{ margin: "0 0 1rem", fontSize: webTypography.size.md, fontWeight: webTypography.weight.bold }}>Contact</h3>
              <dl className="dash-dl">
                <dt>Email</dt>
                <dd>{v.contact_email ?? "-"}</dd>
                <dt style={{ marginTop: "0.75rem" }}>Phone</dt>
                <dd>{v.contact_phone ?? "-"}</dd>
                <dt style={{ marginTop: "0.75rem" }}>User ID</dt>
                <dd className="dash-mono">{v.user_id}</dd>
              </dl>
            </Card>
            <Card padded style={{ gridColumn: "1 / -1" }}>
              <h3 style={{ margin: "0 0 1rem", fontSize: webTypography.size.md, fontWeight: webTypography.weight.bold }}>
                Registered address
              </h3>
              <pre
                style={{
                  margin: 0,
                  fontSize: webTypography.size.sm,
                  whiteSpace: "pre-wrap",
                  fontFamily: "inherit",
                  color: "var(--wb-fg)",
                  lineHeight: 1.5,
                }}
              >
                {stringifyAddress(v.registered_address)}
              </pre>
            </Card>
            <Card padded>
              <h3 style={{ margin: "0 0 1rem", fontSize: webTypography.size.md, fontWeight: webTypography.weight.bold }}>Company details</h3>
              <dl className="dash-dl">
                <dt>Type</dt>
                <dd>{v.company_type ?? "-"}</dd>
                <dt style={{ marginTop: "0.75rem" }}>CIN / registration no.</dt>
                <dd>{v.company_registration_number ?? "-"}</dd>
                <dt style={{ marginTop: "0.75rem" }}>Website</dt>
                <dd>{v.website_url ?? "-"}</dd>
              </dl>
            </Card>
            <Card padded>
              <h3 style={{ margin: "0 0 1rem", fontSize: webTypography.size.md, fontWeight: webTypography.weight.bold }}>Contact person</h3>
              <dl className="dash-dl">
                <dt>Name</dt>
                <dd>{v.contact_person_name ?? "-"}</dd>
                <dt style={{ marginTop: "0.75rem" }}>Role</dt>
                <dd>{v.contact_person_role ?? "-"}</dd>
                <dt style={{ marginTop: "0.75rem" }}>Phone</dt>
                <dd>{v.contact_person_phone ?? "-"}</dd>
                <dt style={{ marginTop: "0.75rem" }}>Email</dt>
                <dd>{v.contact_person_email ?? "-"}</dd>
              </dl>
            </Card>
            <Card padded style={{ gridColumn: "1 / -1" }}>
              <h3 style={{ margin: "0 0 1rem", fontSize: webTypography.size.md, fontWeight: webTypography.weight.bold }}>
                Coverage & experience
              </h3>
              <dl className="dash-dl">
                <dt>Service areas</dt>
                <dd>{v.service_areas?.length ? v.service_areas.join(", ") : "-"}</dd>
                <dt style={{ marginTop: "0.75rem" }}>Operating regions</dt>
                <dd>{v.operating_regions?.length ? v.operating_regions.join(", ") : "-"}</dd>
                <dt style={{ marginTop: "0.75rem" }}>Years in business</dt>
                <dd>{v.years_in_business != null ? String(v.years_in_business) : "-"}</dd>
                <dt style={{ marginTop: "0.75rem" }}>Experience</dt>
                <dd style={{ whiteSpace: "pre-wrap" }}>{v.experience_summary ?? "-"}</dd>
              </dl>
            </Card>
            <Card padded style={{ gridColumn: "1 / -1" }}>
              <h3 style={{ margin: "0 0 1rem", fontSize: webTypography.size.md, fontWeight: webTypography.weight.bold }}>
                Equipment & safety
              </h3>
              <dl className="dash-dl">
                <dt>Equipment</dt>
                <dd>{v.equipment_available?.length ? v.equipment_available.join(", ") : "-"}</dd>
                <dt style={{ marginTop: "0.75rem" }}>Safety training</dt>
                <dd>{v.flag_safety_training ? "Yes" : "No"}</dd>
                <dt style={{ marginTop: "0.75rem" }}>PPE available</dt>
                <dd>{v.flag_ppe_available ? "Yes" : "No"}</dd>
                <dt style={{ marginTop: "0.75rem" }}>Insurance coverage</dt>
                <dd>{v.flag_insurance_coverage ? "Yes" : "No"}</dd>
              </dl>
            </Card>
            <Card padded style={{ gridColumn: "1 / -1" }}>
              <h3 style={{ margin: "0 0 1rem", fontSize: webTypography.size.md, fontWeight: webTypography.weight.bold }}>Registration documents</h3>
              <p style={{ margin: "0 0 0.75rem", fontSize: webTypography.size.sm, color: "var(--wb-muted-fg)" }}>
                Opens a time-limited signed URL from private storage.
              </p>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                {vendorLogoPath ? (
                  <DocumentViewButton label="Company logo" storagePath={vendorLogoPath} resolveSignedUrl={resolveVendorDocUrl} />
                ) : null}
                <DocumentViewButton label="PAN" storagePath={v.doc_pan_url} resolveSignedUrl={resolveVendorDocUrl} />
                <DocumentViewButton label="Aadhaar" storagePath={v.doc_aadhaar_url} resolveSignedUrl={resolveVendorDocUrl} />
                <DocumentViewButton label="GST" storagePath={v.doc_gst_url} resolveSignedUrl={resolveVendorDocUrl} />
                <DocumentViewButton label="Bank proof" storagePath={v.doc_bank_proof_url} resolveSignedUrl={resolveVendorDocUrl} />
              </div>
            </Card>
            {(v.rejection_reason || v.reviewed_at) && (
              <Card padded style={{ gridColumn: "1 / -1" }}>
                <h3 style={{ margin: "0 0 1rem", fontSize: webTypography.size.md, fontWeight: webTypography.weight.bold }}>Review</h3>
                <dl className="dash-dl">
                  {v.reviewed_at ? (
                    <>
                      <dt>Reviewed</dt>
                      <dd>{formatSubmittedAt(v.reviewed_at)}</dd>
                    </>
                  ) : null}
                  {v.approved_at ? (
                    <>
                      <dt style={{ marginTop: "0.75rem" }}>Approved</dt>
                      <dd>{formatSubmittedAt(v.approved_at)}</dd>
                    </>
                  ) : null}
                  {v.rejection_reason ? (
                    <>
                      <dt style={{ marginTop: "0.75rem" }}>Rejection reason</dt>
                      <dd>{v.rejection_reason}</dd>
                    </>
                  ) : null}
                </dl>
              </Card>
            )}
          </div>

          {canDecide ? (
            <div className="dash-sticky-cta">
              <div className="dash-sticky-cta-actions">
                <Button
                  size="md"
                  type="button"
                  loading={approveMut.isPending}
                  disabled={rejectMut.isPending}
                  onClick={() => void approveMut.mutateAsync()}
                >
                  Approve
                </Button>
                <Button
                  variant="danger"
                  size="md"
                  type="button"
                  loading={rejectMut.isPending}
                  disabled={approveMut.isPending}
                  onClick={() => setRejectOpen(true)}
                >
                  Reject
                </Button>
              </div>
            </div>
          ) : null}

          <Modal
            open={rejectOpen}
            onClose={() => {
              setRejectOpen(false);
              setRejectReason("");
            }}
            title="Reject vendor"
            description="Share an actionable reason - vendors see this in-app where applicable."
          >
            <TextArea
              label="Reason"
              required
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. GSTIN mismatch with uploaded documents."
            />
            {rejectMut.isError ? (
              <p style={{ margin: "0.75rem 0 0", fontSize: webTypography.size.sm, color: "var(--wb-destructive)" }}>
                {(rejectMut.error as Error).message}
              </p>
            ) : null}
            <div className="web-modal-actions">
              <Button variant="outline" type="button" onClick={() => setRejectOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                type="button"
                loading={rejectMut.isPending}
                onClick={() => void rejectMut.mutateAsync()}
              >
                Reject vendor
              </Button>
            </div>
          </Modal>
        </>
      )}
    </>
  );
}
