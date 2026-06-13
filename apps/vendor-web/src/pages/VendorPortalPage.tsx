import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { VendorRow } from "@oorjaman/api";
import { authApi, vendorApi } from "@oorjaman/api";
import { Button, Card } from "@oorjaman/web-ui";
import { formatDisplayDateTime } from "@oorjaman/utils";
import { useSupabase } from "../lib/supabase-context";

function isAwaitingApproval(status: VendorRow["approval_status"]): boolean {
  return status === "pending" || status === "under_review";
}

function formatIsoDate(iso: string): string {
  return formatDisplayDateTime(iso);
}

/**
 * Partner portal landing: registration paths for pending applicants; organisation snapshot for approved partners.
 */
export default function VendorPortalPage() {
  const supabase = useSupabase();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vendor, setVendor] = useState<VendorRow | null | undefined>(undefined);

  const refresh = useCallback(async () => {
    if (!supabase) return;
    setError(null);
    setLoading(true);
    try {
      const v = await vendorApi.getMyVendor(supabase);
      setVendor(v ?? null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load vendor profile.");
      setVendor(null);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signOut = () => {
    if (!supabase) return;
    void authApi.signOut(supabase).then(() => navigate("/login", { replace: true }));
  };

  if (!supabase) {
    return (
      <div className="al-root">
        <p className="al-lede">Configure Supabase environment variables.</p>
      </div>
    );
  }

  if (loading && vendor === undefined && !error) {
    return (
      <div className="al-root">
        <Card padded className="al-card">
          <p className="al-lede al-text-reset">
            Loading your partner profile…
          </p>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="al-root">
        <Card padded className="al-card">
          <p className="al-error">{error}</p>
          <Button variant="outline" type="button" onClick={() => void refresh()}>
            Retry
          </Button>
          <Button variant="primary" type="button" className="al-inline-gap" onClick={() => void signOut()}>
            Sign out
          </Button>
        </Card>
      </div>
    );
  }

  if (vendor === undefined) {
    return (
      <div className="al-root">
        <Card padded className="al-card">
          <p className="al-lede al-text-reset">
            Loading your partner profile…
          </p>
        </Card>
      </div>
    );
  }

  if (vendor === null) {
    return (
      <div className="al-root">
        <Card padded className="al-card">
          <h1 className="al-title">Complete registration</h1>
          <p className="al-lede">
            We don&apos;t have a partner profile linked to this account yet. Finish registration to submit your
            application.
          </p>
          <Button variant="primary" type="button" onClick={() => navigate("/signup")}>
            Continue to registration
          </Button>
          <p className="al-footer">
            <button
              type="button"
              className="al-resend"
              onClick={() => void signOut()}
            >
              Sign out
            </button>
          </p>
        </Card>
      </div>
    );
  }

  if (vendor.approval_status === "approved") {
    return (
      <div className="al-root al-root-wide">
        <Card padded className="al-card">
          <h1 className="al-title al-title-no-top">
            Organisation &amp; application
          </h1>
          <p className="al-lede al-lede-spaced">
            Your partner record and shortcuts. Respond to paid requests and track visits from{" "}
            <strong>Operations</strong>; see your technicians and visit history under{" "}
            <strong>Team</strong>.
          </p>
          <p className="al-status-row">
            <strong>Application status:</strong>{" "}
            <span className="al-status-approved">Approved</span>
            <span className="al-status-meta">
              · Profile updated {formatIsoDate(vendor.updated_at)}
            </span>
          </p>
          <dl className="al-info-grid">
            <dt>Business</dt>
            <dd>{vendor.business_name?.trim() || "-"}</dd>
            {vendor.trade_name ? (
              <>
                <dt>Trade name</dt>
                <dd>{vendor.trade_name}</dd>
              </>
            ) : null}
            {vendor.contact_phone ? (
              <>
                <dt>Contact</dt>
                <dd>{vendor.contact_phone}</dd>
              </>
            ) : null}
            <dt>Field crew</dt>
            <dd>
              Technicians are managed by your organisation. Assign your verified team members while accepting bookings.
            </dd>
          </dl>
          <p className="al-nav-caption">Go to</p>
          <div className="al-btn-row">
            <Button variant="primary" type="button" onClick={() => navigate("/dashboard/operations")}>
              Operations - incoming visits
            </Button>
            <Button variant="outline" type="button" onClick={() => navigate("/dashboard/team")}>
              Team - crew &amp; history
            </Button>
            <Button variant="outline" type="button" onClick={() => navigate("/dashboard/overview")}>
              Overview
            </Button>
            <Button variant="outline" type="button" onClick={() => void refresh()}>
              Reload profile
            </Button>
          </div>
          <p className="al-note">
            To amend company details or documents after approval, use the{" "}
            <Link to="/signup" className="al-link-strong">
              registration &amp; documents form
            </Link>
            . The sidebar links above stay available from any page.
          </p>
        </Card>
      </div>
    );
  }

  if (isAwaitingApproval(vendor.approval_status)) {
    return (
      <div className="al-root">
        <Card padded className="al-card">
          <h1 className="al-title">Awaiting approval</h1>
          <p className="al-lede">
            Your partner application is under review. You&apos;ll be notified when a decision is made. Current status:{" "}
            <strong>{vendor.approval_status}</strong>.
          </p>
          <Button variant="outline" type="button" onClick={() => void refresh()}>
            Refresh status
          </Button>
          <Button variant="outline" type="button" className="al-inline-gap" onClick={() => navigate("/signup")}>
            View registration form
          </Button>
          <p className="al-footer">
            <button
              type="button"
              className="al-resend"
              onClick={() => void signOut()}
            >
              Sign out
            </button>
          </p>
        </Card>
      </div>
    );
  }

  if (vendor.approval_status === "rejected") {
    return (
      <div className="al-root">
        <Card padded className="al-card">
          <h1 className="al-title">Application not approved</h1>
          <p className="al-lede">Your partner registration was not approved.</p>
          {vendor.rejection_reason ? (
            <div className="al-rejection-banner">
              {vendor.rejection_reason}
            </div>
          ) : (
            <p className="al-hint">No detailed reason was provided. Contact support if you need clarification.</p>
          )}
          <Button variant="outline" type="button" onClick={() => void signOut()}>
            Sign out
          </Button>
        </Card>
      </div>
    );
  }

  if (vendor.approval_status === "suspended") {
    return (
      <div className="al-root">
        <Card padded className="al-card">
          <h1 className="al-title">Account suspended</h1>
          <p className="al-lede">Your partner organisation access is suspended. Contact Oorjaman support.</p>
          <Button variant="outline" type="button" onClick={() => void signOut()}>
            Sign out
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="al-root">
      <Card padded className="al-card">
        <p className="al-lede">Unknown status: {vendor.approval_status}</p>
        <Button variant="outline" type="button" onClick={() => void refresh()}>
          Refresh
        </Button>
      </Card>
    </div>
  );
}
