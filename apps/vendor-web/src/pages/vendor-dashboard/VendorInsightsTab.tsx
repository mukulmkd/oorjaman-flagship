import type { BookingRow, JobReportRow } from "@oorjaman/api";
import { DEFAULT_TABLE_PAGE_SIZE, readBookingRecipientMeta } from "@oorjaman/api";
import { Card } from "@oorjaman/web-ui";
import { useMemo, useState } from "react";
import { TablePaginationBar } from "../../components/TablePaginationBar";
import { formatScheduleRange } from "./formatters";
import {
  computeAcceptanceRatePercent,
  computeAvgVendorResponseMinutes,
  computeJobsPerTechnician,
  computeRatingStats,
  countVendorDeclines,
  upcomingBookings,
} from "./metrics";

type Props = {
  bookings: BookingRow[];
  jobReports: JobReportRow[] | undefined;
  technicianLabel: (id: string | null) => string;
  jobReportsLoading: boolean;
  jobReportsError: Error | null;
};

export function VendorInsightsTab({
  bookings,
  jobReports,
  technicianLabel,
  jobReportsLoading,
  jobReportsError,
}: Props) {
  const [upcomingPage, setUpcomingPage] = useState(1);
  const [jobsPerTechPage, setJobsPerTechPage] = useState(1);
  const [ratingsPage, setRatingsPage] = useState(1);

  const acceptance = computeAcceptanceRatePercent(bookings);
  const declines = countVendorDeclines(bookings);
  const avgRespMin = computeAvgVendorResponseMinutes(bookings);
  const jobsPerTech = computeJobsPerTechnician(bookings);
  const upcomingAll = upcomingBookings(bookings, 7);
  const ratingsStats = computeRatingStats(jobReports ?? []);

  const sortedReports = useMemo(
    () =>
      [...(jobReports ?? [])].sort((a, b) =>
        new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime(),
      ),
    [jobReports],
  );

  const upcomingTotal = upcomingAll.length;
  const upcomingWindow = upcomingAll.slice(
    (upcomingPage - 1) * DEFAULT_TABLE_PAGE_SIZE,
    upcomingPage * DEFAULT_TABLE_PAGE_SIZE,
  );

  const jobsPerTechTotal = jobsPerTech.length;
  const jobsPerTechWindow = jobsPerTech.slice(
    (jobsPerTechPage - 1) * DEFAULT_TABLE_PAGE_SIZE,
    jobsPerTechPage * DEFAULT_TABLE_PAGE_SIZE,
  );

  const ratingsTotal = sortedReports.length;
  const ratingsWindow = sortedReports.slice(
    (ratingsPage - 1) * DEFAULT_TABLE_PAGE_SIZE,
    ratingsPage * DEFAULT_TABLE_PAGE_SIZE,
  );

  const serviceFor = (b: BookingRow) => {
    const rec = readBookingRecipientMeta(b.metadata);
    if (!rec || rec.is_self) return "Customer";
    return rec.recipient_name?.trim() || "Someone else";
  };

  return (
    <div className="vd-stack">
      <div className="vd-kpi-grid">
        <div className="vd-kpi-card">
          <div className="vd-kpi-label">Acceptance rate (approx.)</div>
          <div className="vd-kpi-value">{acceptance != null ? `${acceptance}%` : "-"}</div>
          <div className="vd-kpi-hint">Accepted pipeline vs declines recorded on bookings</div>
        </div>
        <div className="vd-kpi-card">
          <div className="vd-kpi-label">Vendor declines</div>
          <div className="vd-kpi-value">{declines}</div>
          <div className="vd-kpi-hint">Rejections with vendor reason in metadata</div>
        </div>
        <div className="vd-kpi-card">
          <div className="vd-kpi-label">Avg. response time</div>
          <div className="vd-kpi-value">
            {avgRespMin != null ? `${avgRespMin.toFixed(1)} min` : "-"}
          </div>
          <div className="vd-kpi-hint">Created → accept timestamp when available</div>
        </div>
        <div className="vd-kpi-card">
          <div className="vd-kpi-label">Avg. customer rating</div>
          <div className="vd-kpi-value">
            {ratingsStats.avg != null ? ratingsStats.avg.toFixed(2) : "-"}
            {ratingsStats.ratedCount > 0 ? ` (${ratingsStats.ratedCount})` : ""}
          </div>
          <div className="vd-kpi-hint">From job reports with ratings</div>
        </div>
        <div className="vd-kpi-card">
          <div className="vd-kpi-label">Jobs with anomaly notes</div>
          <div className="vd-kpi-value">{ratingsStats.complaints}</div>
          <div className="vd-kpi-hint">Reports carrying anomaly / complaint text</div>
        </div>
      </div>

      <Card padded>
        <h3 className="vd-subtitle">Map - upcoming visits</h3>
        <p className="vd-note">
          Live map integration (Google / Mapbox) can plot the addresses below. Placeholder until API keys and geocoding
          are configured.
        </p>
        <div className="vd-map-placeholder">
          Map preview - use Upcoming table for coordinates pipeline next.
        </div>
      </Card>

      <Card padded={false}>
        <div className="vd-card-head">
          <h2 className="vd-section-title">Upcoming (7 days)</h2>
        </div>
        {upcomingTotal === 0 ? (
          <p className="vd-empty">No scheduled visits in the next week.</p>
        ) : (
          <>
            <div className="bm-table-wrap">
              <table className="bm-table">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Status</th>
                    <th>Schedule</th>
                    <th>Technician</th>
                    <th>Service for</th>
                  </tr>
                </thead>
                <tbody>
                  {upcomingWindow.map((b) => (
                    <tr key={b.id}>
                      <td className="vd-mono">{b.booking_code ?? b.reference_code}</td>
                      <td>{b.status}</td>
                      <td>{formatScheduleRange(b)}</td>
                      <td>{technicianLabel(b.technician_id)}</td>
                      <td>{serviceFor(b)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ padding: "0.75rem 1rem" }}>
              <TablePaginationBar page={upcomingPage} total={upcomingTotal} onPageChange={setUpcomingPage} />
            </div>
          </>
        )}
      </Card>

      <Card padded={false}>
        <div className="vd-card-head">
          <h2 className="vd-section-title">Jobs per technician</h2>
          <p className="vd-note vd-note-spaced">
            Accepted / in-progress / completed visits with an assignee.
          </p>
        </div>
        {jobsPerTechTotal === 0 ? (
          <p className="vd-empty">No assignments.</p>
        ) : (
          <>
            <div className="bm-table-wrap">
              <table className="bm-table">
                <thead>
                  <tr>
                    <th>Technician</th>
                    <th>Jobs</th>
                  </tr>
                </thead>
                <tbody>
                  {jobsPerTechWindow.map((row) => (
                    <tr key={row.technicianId}>
                      <td>{technicianLabel(row.technicianId)}</td>
                      <td>{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ padding: "0.75rem 1rem" }}>
              <TablePaginationBar page={jobsPerTechPage} total={jobsPerTechTotal} onPageChange={setJobsPerTechPage} />
            </div>
          </>
        )}
      </Card>

      <Card padded={false}>
        <div className="vd-card-head">
          <h2 className="vd-section-title">Recent ratings & feedback</h2>
        </div>
        {jobReportsLoading ? (
          <p className="vd-empty">Loading…</p>
        ) : jobReportsError ? (
          <p className="vd-empty vd-error">
            {jobReportsError.message}
          </p>
        ) : ratingsTotal === 0 ? (
          <p className="vd-empty">No job reports.</p>
        ) : (
          <>
            <div className="bm-table-wrap">
              <table className="bm-table">
                <thead>
                  <tr>
                    <th>Booking</th>
                    <th>Rating</th>
                    <th>Completed</th>
                    <th>Feedback / anomalies</th>
                  </tr>
                </thead>
                <tbody>
                  {ratingsWindow.map((r) => (
                    <tr key={r.id}>
                      <td className="vd-mono">{r.booking_id.slice(0, 8)}…</td>
                      <td>{r.customer_rating ?? "—"}</td>
                      <td className="vd-mono">{new Date(r.completed_at).toLocaleString()}</td>
                      <td>
                        {r.feedback_hidden
                          ? "Feedback hidden by moderation."
                          : ([r.customer_feedback, r.anomaly_notes].filter(Boolean).join(" · ") || "—")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ padding: "0.75rem 1rem" }}>
              <TablePaginationBar page={ratingsPage} total={ratingsTotal} onPageChange={setRatingsPage} />
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
