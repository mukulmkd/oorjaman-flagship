import { webTypography } from "./../styles/typography";
import { useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { createTechnicianDocumentSignedUrl, queryKeys, technicianApi } from "@oorjaman/api";
import {
  Badge,
  Button,
  Card,
  PageHeader,
  TableRowsSkeleton,
} from "@oorjaman/web-ui";
import { DocumentViewButton } from "../components/DocumentViewer";
import { useSupabase } from "../lib/supabase-context";

export function TechnicianDetailPage() {
  const supabase = useSupabase();
  const navigate = useNavigate();
  const { technicianId } = useParams<{ technicianId: string }>();
  const resolveTechnicianDocUrl = useCallback(
    (storagePath: string) => createTechnicianDocumentSignedUrl(supabase!, storagePath),
    [supabase],
  );

  const detailQuery = useQuery({
    queryKey: technicianId ? queryKeys.technicians.detail(technicianId) : [],
    queryFn: () => technicianApi.adminGetTechnician(supabase!, technicianId!),
    enabled: Boolean(supabase && technicianId),
  });
  const statsQuery = useQuery({
    queryKey: queryKeys.technicians.publicStats(technicianId ?? ""),
    queryFn: () => technicianApi.listTechnicianPublicStats(supabase!, technicianId ? [technicianId] : []),
    enabled: Boolean(supabase && technicianId),
  });

  const t = detailQuery.data;
  const tStats = statsQuery.data?.[0] ?? null;

  return (
    <>
      <PageHeader
        title="Technician profile"
        subtitle={t ? `User ${t.user_id.slice(0, 8)}… · Vendor ${t.vendor_id?.slice(0, 8) ?? "-"}…` : "…"}
        actions={
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => navigate("/dashboard/technicians")}
          >
            Back
          </Button>
        }
      />

      {!supabase ? (
        <Card padded>
          <p style={{ margin: 0, fontSize: webTypography.size.sm, color: "var(--wb-muted-fg)" }}>Configure Supabase first.</p>
        </Card>
      ) : detailQuery.isLoading ? (
        <Card padded>
          <TableRowsSkeleton rows={5} />
        </Card>
      ) : detailQuery.isError ? (
        <Card padded>
          <p style={{ margin: "0 0 0.5rem", fontWeight: webTypography.weight.semibold }}>Couldn&apos;t load technician</p>
          <p style={{ margin: "0 0 1rem", color: "var(--wb-destructive)", fontSize: webTypography.size.sm }}>
            {(detailQuery.error as Error).message}
          </p>
          <Button variant="primary" size="sm" type="button" onClick={() => void detailQuery.refetch()}>
            Retry
          </Button>
        </Card>
      ) : !t ? (
        <Card padded>
          <p style={{ margin: 0, color: "var(--wb-muted-fg)" }}>Not found.</p>
        </Card>
      ) : (
        <>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1rem" }}>
            <Badge tone={t.verification_status === "verified" ? "success" : t.verification_status === "rejected" ? "danger" : "warning"}>
              {t.verification_status}
            </Badge>
            <Badge tone={t.vendor_review_status === "approved" ? "success" : t.vendor_review_status === "rejected" ? "danger" : "warning"}>
              vendor: {t.vendor_review_status}
            </Badge>
            {t.is_verified ? <Badge tone="success">platform verified</Badge> : <Badge tone="neutral">platform pending</Badge>}
            <Badge tone="neutral">{(tStats?.total_jobs ?? 0).toString()} services</Badge>
            <Badge tone="neutral">
              {tStats?.avg_rating != null ? `${tStats.avg_rating.toFixed(1)} / 5` : "No rating"}
              {tStats?.rating_count ? ` (${tStats.rating_count})` : ""}
            </Badge>
            <Badge tone="neutral">
              30d {tStats?.avg_rating_30d != null ? `${tStats.avg_rating_30d.toFixed(1)} / 5` : "-"}
              {tStats?.rating_count_30d ? ` (${tStats.rating_count_30d})` : ""}
            </Badge>
          </div>

          <div className="dash-detail-grid">
            <Card padded>
              <h3 style={{ margin: "0 0 1rem", fontSize: webTypography.size.md, fontWeight: webTypography.weight.bold }}>Identity</h3>
              <dl className="dash-dl">
                <dt>Father / guardian</dt>
                <dd>{t.father_guardian_name ?? "-"}</dd>
                <dt style={{ marginTop: "0.75rem" }}>Gender</dt>
                <dd>{t.gender ?? "-"}</dd>
                <dt style={{ marginTop: "0.75rem" }}>Contact email</dt>
                <dd>{t.contact_email ?? "-"}</dd>
                <dt style={{ marginTop: "0.75rem" }}>Name as per Aadhaar</dt>
                <dd>{t.name_as_per_aadhaar ?? "-"}</dd>
                <dt style={{ marginTop: "0.75rem" }}>Date of birth</dt>
                <dd>{t.date_of_birth ?? "-"}</dd>
                <dt style={{ marginTop: "0.75rem" }}>PAN</dt>
                <dd>{t.pan_number ?? "-"}</dd>
                <dt style={{ marginTop: "0.75rem" }}>Aadhaar (last 4)</dt>
                <dd>{t.aadhaar_last4 ?? "-"}</dd>
              </dl>
            </Card>
            <Card padded>
              <h3 style={{ margin: "0 0 1rem", fontSize: webTypography.size.md, fontWeight: webTypography.weight.bold }}>Experience</h3>
              <dl className="dash-dl">
                <dt>Skills</dt>
                <dd>{t.skills?.length ? t.skills.join(", ") : "-"}</dd>
                <dt style={{ marginTop: "0.75rem" }}>Solar cleaning</dt>
                <dd>{t.flag_solar_cleaning_experience ? "Yes" : "No"}</dd>
                <dt style={{ marginTop: "0.75rem" }}>Other skills</dt>
                <dd>{t.other_skills ?? "-"}</dd>
                <dt style={{ marginTop: "0.75rem" }}>Years</dt>
                <dd>{t.years_experience != null ? String(t.years_experience) : "-"}</dd>
              </dl>
            </Card>
            <Card padded style={{ gridColumn: "1 / -1" }}>
              <h3 style={{ margin: "0 0 1rem", fontSize: webTypography.size.md, fontWeight: webTypography.weight.bold }}>Safety</h3>
              <dl className="dash-dl">
                <dt>Safety training</dt>
                <dd>{t.flag_safety_training ? "Yes" : "No"}</dd>
                <dt style={{ marginTop: "0.75rem" }}>Training organisation</dt>
                <dd>{t.safety_training_org ?? "-"}</dd>
                <dt style={{ marginTop: "0.75rem" }}>Height / rope cert</dt>
                <dd>{t.flag_height_work_cert ? "Yes" : "No"}</dd>
              </dl>
            </Card>
            <Card padded style={{ gridColumn: "1 / -1" }}>
              <h3 style={{ margin: "0 0 1rem", fontSize: webTypography.size.md, fontWeight: webTypography.weight.bold }}>Bank</h3>
              <dl className="dash-dl">
                <dt>Holder</dt>
                <dd>{t.bank_account_holder_name ?? "-"}</dd>
                <dt style={{ marginTop: "0.75rem" }}>Account (last 4)</dt>
                <dd>{t.bank_account_last4 ?? "-"}</dd>
                <dt style={{ marginTop: "0.75rem" }}>IFSC</dt>
                <dd>{t.bank_ifsc ?? "-"}</dd>
              </dl>
            </Card>
            <Card padded style={{ gridColumn: "1 / -1" }}>
              <h3 style={{ margin: "0 0 1rem", fontSize: webTypography.size.md, fontWeight: webTypography.weight.bold }}>Documents</h3>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <DocumentViewButton label="Aadhaar" storagePath={t.doc_aadhaar_url} resolveSignedUrl={resolveTechnicianDocUrl} />
                <DocumentViewButton label="PAN" storagePath={t.doc_pan_url} resolveSignedUrl={resolveTechnicianDocUrl} />
                <DocumentViewButton label="Passport photo" storagePath={t.doc_passport_url} resolveSignedUrl={resolveTechnicianDocUrl} />
                <DocumentViewButton label="Safety certificate" storagePath={t.doc_safety_certificate_url} resolveSignedUrl={resolveTechnicianDocUrl} />
                <DocumentViewButton label="Bank proof" storagePath={t.doc_bank_proof_url} resolveSignedUrl={resolveTechnicianDocUrl} />
              </div>
            </Card>
            {t.verification_rejection_reason ? (
              <Card padded style={{ gridColumn: "1 / -1" }}>
                <h3 style={{ margin: "0 0 1rem", fontSize: webTypography.size.md, fontWeight: webTypography.weight.bold }}>Rejection</h3>
                <p style={{ margin: 0 }}>{t.verification_rejection_reason}</p>
              </Card>
            ) : null}
            {t.vendor_rejection_reason ? (
              <Card padded style={{ gridColumn: "1 / -1" }}>
                <h3 style={{ margin: "0 0 1rem", fontSize: webTypography.size.md, fontWeight: webTypography.weight.bold }}>Vendor review note</h3>
                <p style={{ margin: 0 }}>{t.vendor_rejection_reason}</p>
              </Card>
            ) : null}
          </div>
        </>
      )}
    </>
  );
}
