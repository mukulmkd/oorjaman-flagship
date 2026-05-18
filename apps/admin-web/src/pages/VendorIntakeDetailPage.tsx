import { webTypography } from "./../styles/typography";
import { useCallback, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createVendorIntakeDocumentSignedUrl, queryKeys, vendorIntakeApi } from "@oorjaman/api";
import type { Json, VendorRegistrationIntakeRow } from "@oorjaman/api";
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
import { useSupabase } from "../lib/supabase-context";
import {
  cityFromRegisteredAddress,
  formatIntakeExperienceLine,
  formatSubmittedAt,
} from "../lib/vendor-approval-utils";

function stringifyAddress(value: unknown): string {
  if (value == null) return "-";
  if (typeof value === "string") return value || "-";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function asFormRecord(form: Json): Record<string, unknown> {
  if (form && typeof form === "object" && !Array.isArray(form)) {
    return form as Record<string, unknown>;
  }
  return {};
}

function intakeLogoPath(form: Json): string | null {
  const m = asFormRecord(form).metadata;
  if (!m || typeof m !== "object" || Array.isArray(m)) return null;
  const p = (m as Record<string, unknown>).company_logo_storage_path;
  return typeof p === "string" && p.trim() ? p.trim() : null;
}

function intakeStatusTone(
  s: VendorRegistrationIntakeRow["status"],
): "neutral" | "warning" | "success" | "danger" {
  switch (s) {
    case "approved":
      return "success";
    case "rejected":
      return "danger";
    case "submitted":
      return "warning";
    default:
      return "neutral";
  }
}

export function VendorIntakeDetailPage() {
  const supabase = useSupabase();
  const resolveIntakeDocUrl = useCallback(
    (storagePath: string) => createVendorIntakeDocumentSignedUrl(supabase!, storagePath),
    [supabase],
  );
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const { intakeId } = useParams<{ intakeId: string }>();

  const fromVendorApproval = useMemo(() => {
    const st = location.state as { fromVendorApproval?: boolean } | null;
    return Boolean(st?.fromVendorApproval);
  }, [location.state]);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const detailQuery = useQuery({
    queryKey: intakeId ? queryKeys.vendors.intakeDetail(intakeId) : [],
    queryFn: () => vendorIntakeApi.adminGetVendorRegistrationIntake(supabase!, intakeId!),
    enabled: Boolean(supabase && intakeId),
  });

  const approveMut = useMutation({
    mutationFn: async () => {
      if (!supabase || !intakeId) throw new Error("Missing intake");
      const res = await vendorIntakeApi.adminApproveVendorRegistrationIntake(supabase, intakeId);
      if (!res.ok) throw new Error(res.message);
      return res;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.vendors.all() });
      if (fromVendorApproval) {
        navigate("/dashboard/vendor-approval");
        return;
      }
      navigate("/dashboard/vendors/approved");
    },
  });

  const rejectMut = useMutation({
    mutationFn: async () => {
      if (!supabase || !intakeId) throw new Error("Missing intake");
      const reason = rejectReason.trim();
      if (!reason) throw new Error("Rejection reason is required.");
      return vendorIntakeApi.adminRejectVendorRegistrationIntake(supabase, intakeId, reason);
    },
    onSuccess: () => {
      setRejectOpen(false);
      setRejectReason("");
      void qc.invalidateQueries({ queryKey: queryKeys.vendors.all() });
      if (fromVendorApproval) {
        navigate("/dashboard/vendor-approval");
        return;
      }
      navigate("/dashboard/vendors/rejected");
    },
  });

  const row = detailQuery.data;
  const form = row?.form_data ?? ({} as Json);
  const f = asFormRecord(form);
  const logoPath = intakeLogoPath(form);
  const canDecide = row?.status === "submitted";
  const displayName =
    (typeof f.contact_person_name === "string" && f.contact_person_name.trim()) ||
    (typeof f.business_name === "string" && f.business_name.trim()) ||
    "-";

  const expLine = formatIntakeExperienceLine(form);

  return (
    <>
      <PageHeader
        title={row?.business_name ?? "Partner application"}
        subtitle={
          row?.submitted_at
            ? `Submitted ${formatSubmittedAt(row.submitted_at)}`
            : row
              ? `Created ${formatSubmittedAt(row.created_at)}`
              : "…"
        }
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
              navigate("/dashboard/vendors/pending");
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
          <p style={{ margin: "0 0 0.5rem", fontWeight: webTypography.weight.semibold }}>Couldn&apos;t load application</p>
          <p style={{ margin: "0 0 1rem", color: "var(--wb-destructive)", fontSize: webTypography.size.sm }}>
            {(detailQuery.error as Error).message}
          </p>
          <Button variant="primary" size="sm" type="button" onClick={() => void detailQuery.refetch()}>
            Retry
          </Button>
        </Card>
      ) : !row ? (
        <Card padded>
          <p style={{ margin: 0, color: "var(--wb-muted-fg)" }}>Application not found.</p>
        </Card>
      ) : (
        <>
          {approveMut.isError ? (
            <p style={{ margin: "0 0 1rem", fontSize: webTypography.size.sm, color: "var(--wb-destructive)" }}>
              {(approveMut.error as Error).message}
            </p>
          ) : null}
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1rem" }}>
            <Badge tone={intakeStatusTone(row.status)}>{row.status}</Badge>
          </div>

          <div className="dash-detail-grid">
            <Card padded>
              <h3 style={{ margin: "0 0 1rem", fontSize: webTypography.size.md, fontWeight: webTypography.weight.bold }}>Login (after approval)</h3>
              <dl className="dash-dl">
                <dt>Email</dt>
                <dd>{String(f.partner_login_email ?? f.contact_email ?? "-")}</dd>
                <dt style={{ marginTop: "0.75rem" }}>Phone</dt>
                <dd>{String(f.partner_login_phone_e164 ?? f.partner_login_phone ?? "-")}</dd>
              </dl>
            </Card>
            <Card padded>
              <h3 style={{ margin: "0 0 1rem", fontSize: webTypography.size.md, fontWeight: webTypography.weight.bold }}>Business</h3>
              <dl className="dash-dl">
                <dt>GSTIN</dt>
                <dd>{String(f.gstin ?? "-")}</dd>
                <dt style={{ marginTop: "0.75rem" }}>PAN</dt>
                <dd>{String(f.pan ?? "-")}</dd>
                <dt style={{ marginTop: "0.75rem" }}>Operating regions</dt>
                <dd>
                  {Array.isArray(f.operating_regions) && f.operating_regions.length
                    ? (f.operating_regions as string[]).join(", ")
                    : String(f.operating_regions_text ?? "-")}
                </dd>
              </dl>
            </Card>
            <Card padded>
              <h3 style={{ margin: "0 0 1rem", fontSize: webTypography.size.md, fontWeight: webTypography.weight.bold }}>Contact</h3>
              <dl className="dash-dl">
                <dt>Display name</dt>
                <dd>{displayName}</dd>
                <dt style={{ marginTop: "0.75rem" }}>Org email</dt>
                <dd>{String(f.contact_email ?? "-")}</dd>
                <dt style={{ marginTop: "0.75rem" }}>Org phone</dt>
                <dd>{String(f.contact_phone ?? "-")}</dd>
              </dl>
            </Card>
            <Card padded style={{ gridColumn: "1 / -1" }}>
              <h3 style={{ margin: "0 0 1rem", fontSize: webTypography.size.md, fontWeight: webTypography.weight.bold }}>Registered address</h3>
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
                {stringifyAddress(f.registered_address)}
              </pre>
            </Card>
            <Card padded>
              <h3 style={{ margin: "0 0 1rem", fontSize: webTypography.size.md, fontWeight: webTypography.weight.bold }}>Company details</h3>
              <dl className="dash-dl">
                <dt>Type</dt>
                <dd>{String(f.company_type ?? "-")}</dd>
                <dt style={{ marginTop: "0.75rem" }}>CIN / registration no.</dt>
                <dd>{String(f.company_registration_number ?? "-")}</dd>
                <dt style={{ marginTop: "0.75rem" }}>Website</dt>
                <dd>{String(f.website_url ?? "-")}</dd>
              </dl>
            </Card>
            <Card padded>
              <h3 style={{ margin: "0 0 1rem", fontSize: webTypography.size.md, fontWeight: webTypography.weight.bold }}>Contact person</h3>
              <dl className="dash-dl">
                <dt>Name</dt>
                <dd>{String(f.contact_person_name ?? "-")}</dd>
                <dt style={{ marginTop: "0.75rem" }}>Role</dt>
                <dd>{String(f.contact_person_role ?? "-")}</dd>
                <dt style={{ marginTop: "0.75rem" }}>Phone</dt>
                <dd>{String(f.contact_person_phone ?? "-")}</dd>
                <dt style={{ marginTop: "0.75rem" }}>Email</dt>
                <dd>{String(f.contact_person_email ?? "-")}</dd>
              </dl>
            </Card>
            <Card padded style={{ gridColumn: "1 / -1" }}>
              <h3 style={{ margin: "0 0 1rem", fontSize: webTypography.size.md, fontWeight: webTypography.weight.bold }}>Coverage & experience</h3>
              <dl className="dash-dl">
                <dt>City</dt>
                <dd>{cityFromRegisteredAddress(f.registered_address)}</dd>
                <dt style={{ marginTop: "0.75rem" }}>Service areas</dt>
                <dd>
                  {Array.isArray(f.service_areas) && f.service_areas.length
                    ? (f.service_areas as string[]).join(", ")
                    : String(f.service_areas_text ?? "-")}
                </dd>
                <dt style={{ marginTop: "0.75rem" }}>Experience line</dt>
                <dd>{expLine}</dd>
              </dl>
            </Card>
            <Card padded style={{ gridColumn: "1 / -1" }}>
              <h3 style={{ margin: "0 0 1rem", fontSize: webTypography.size.md, fontWeight: webTypography.weight.bold }}>Equipment & safety</h3>
              <dl className="dash-dl">
                <dt>Equipment</dt>
                <dd>
                  {Array.isArray(f.equipment_available) && f.equipment_available.length
                    ? (f.equipment_available as string[]).join(", ")
                    : String(f.equipment_text ?? "-")}
                </dd>
                <dt style={{ marginTop: "0.75rem" }}>Safety training</dt>
                <dd>{f.flag_safety_training ? "Yes" : "No"}</dd>
                <dt style={{ marginTop: "0.75rem" }}>PPE available</dt>
                <dd>{f.flag_ppe_available ? "Yes" : "No"}</dd>
                <dt style={{ marginTop: "0.75rem" }}>Insurance coverage</dt>
                <dd>{f.flag_insurance_coverage ? "Yes" : "No"}</dd>
              </dl>
            </Card>
            <Card padded style={{ gridColumn: "1 / -1" }}>
              <h3 style={{ margin: "0 0 1rem", fontSize: webTypography.size.md, fontWeight: webTypography.weight.bold }}>Documents (intake storage)</h3>
              <p style={{ margin: "0 0 0.75rem", fontSize: webTypography.size.sm, color: "var(--wb-muted-fg)" }}>
                View in a modal with optional download (signed URL from the vendor-intake bucket).
              </p>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                {logoPath ? (
                  <DocumentViewButton label="Company logo" storagePath={logoPath} resolveSignedUrl={resolveIntakeDocUrl} />
                ) : null}
                <DocumentViewButton label="PAN" storagePath={typeof f.doc_pan_url === "string" ? f.doc_pan_url : null} resolveSignedUrl={resolveIntakeDocUrl} />
                <DocumentViewButton
                  label="Aadhaar"
                  storagePath={typeof f.doc_aadhaar_url === "string" ? f.doc_aadhaar_url : null}
                  resolveSignedUrl={resolveIntakeDocUrl}
                />
                <DocumentViewButton label="GST" storagePath={typeof f.doc_gst_url === "string" ? f.doc_gst_url : null} resolveSignedUrl={resolveIntakeDocUrl} />
                <DocumentViewButton
                  label="Bank proof"
                  storagePath={typeof f.doc_bank_proof_url === "string" ? f.doc_bank_proof_url : null}
                  resolveSignedUrl={resolveIntakeDocUrl}
                />
              </div>
            </Card>
            {row.created_vendor_id ? (
              <Card padded style={{ gridColumn: "1 / -1" }}>
                <h3 style={{ margin: "0 0 1rem", fontSize: webTypography.size.md, fontWeight: webTypography.weight.bold }}>Provisioned vendor</h3>
                <p style={{ margin: 0, fontSize: webTypography.size.sm }}>
                  Vendor ID: <code className="dash-mono">{row.created_vendor_id}</code>
                </p>
                {row.created_user_id ? (
                  <p style={{ margin: "0.5rem 0 0", fontSize: webTypography.size.sm }}>
                    User ID: <code className="dash-mono">{row.created_user_id}</code>
                  </p>
                ) : null}
              </Card>
            ) : null}
            {(row.rejection_reason || row.reviewed_at) && (
              <Card padded style={{ gridColumn: "1 / -1" }}>
                <h3 style={{ margin: "0 0 1rem", fontSize: webTypography.size.md, fontWeight: webTypography.weight.bold }}>Review</h3>
                <dl className="dash-dl">
                  {row.reviewed_at ? (
                    <>
                      <dt>Reviewed</dt>
                      <dd>{formatSubmittedAt(row.reviewed_at)}</dd>
                    </>
                  ) : null}
                  {row.rejection_reason ? (
                    <>
                      <dt style={{ marginTop: "0.75rem" }}>Rejection reason</dt>
                      <dd>{row.rejection_reason}</dd>
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
                  Approve & create account
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
            title="Reject application"
            description="The applicant will not receive an account. Give a clear reason if you follow up manually."
          >
            <TextArea
              label="Reason"
              required
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Incomplete bank proof."
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
                Reject application
              </Button>
            </div>
          </Modal>
        </>
      )}
    </>
  );
}
