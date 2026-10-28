import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  adminFetchNationalKpiSource,
  formatInrFromPaise,
  nationalKpiMondayYmd,
  nationalKpiScorecardForWeek,
  nationalKpiWeekBounds,
  queryKeys,
  type NationalKpiFormat,
  type NationalKpiItem,
} from "@oorjaman/api";
import { Button, Card, PageHeader } from "@oorjaman/web-ui";
import { useSupabase } from "@oorjaman/web-ui";
import { Link } from "react-router-dom";
import "./kpis-page.css";

const DAY_MS = 86_400_000;

function trimNumber(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function formatMeasure(format: NationalKpiFormat, value: number | null): string {
  if (value == null || Number.isNaN(value)) return "—";
  if (format === "count") return String(Math.round(value));
  if (format === "money") return formatInrFromPaise(value);
  if (format === "percent") return `${trimNumber(value * 100)}%`;
  return trimNumber(value);
}

function deltaLabel(item: NationalKpiItem): string {
  if (item.thisWeek == null || item.lastWeek == null) return "No comparison yet";
  const diff = item.thisWeek - item.lastWeek;
  if (item.format === "percent") {
    const points = diff * 100;
    if (Math.abs(points) < 0.05) return "Same as last week";
    return points > 0 ? `Up ${trimNumber(points)} points from last week` : `Down ${trimNumber(Math.abs(points))} points from last week`;
  }
  if (item.format === "money") {
    if (Math.abs(diff) < 50) return "Same as last week";
    const amount = formatInrFromPaise(Math.abs(diff));
    return diff > 0 ? `Up ${amount} from last week` : `Down ${amount} from last week`;
  }
  if (Math.abs(diff) < 0.05) return "Same as last week";
  const shown = item.format === "count" ? String(Math.abs(Math.round(diff))) : trimNumber(Math.abs(diff));
  return diff > 0 ? `Up ${shown} from last week` : `Down ${shown} from last week`;
}

function shiftMonday(mondayYmd: string, days: number): string {
  const next = new Date(new Date(`${mondayYmd}T00:00:00+05:30`).getTime() + days * DAY_MS);
  return nationalKpiMondayYmd(next);
}

export function KpisPage() {
  const supabase = useSupabase();
  const bounds = nationalKpiWeekBounds();
  const [mondayYmd, setMondayYmd] = useState(bounds.mondayYmd);
  const sourceQuery = useQuery({
    queryKey: queryKeys.admin.nationalKpis(),
    queryFn: () => adminFetchNationalKpiSource(supabase!),
    enabled: Boolean(supabase),
  });
  const scorecard = useMemo(() => {
    if (!sourceQuery.data) return null;
    return nationalKpiScorecardForWeek(sourceQuery.data, new Date(`${mondayYmd}T12:00:00+05:30`));
  }, [sourceQuery.data, mondayYmd]);
  const onCurrentWeek = mondayYmd === bounds.mondayYmd;

  return (
    <div className="dash-page">
      <PageHeader
        title="KPIs"
        subtitle={
          scorecard
            ? `${onCurrentWeek ? "This week" : "Selected week"} ${scorecard.thisWeek.label}, compared with ${scorecard.lastWeek.label}. Weeks run Monday to Sunday, India time.`
            : "Weekly operating scorecard for India. The current week is the latest you can open."
        }
        actions={
          <div className="kpis-week">
            <label className="kpis-week-field">
              <span className="kpis-week-label">Week starting</span>
              <input
                type="date"
                className="web-input kpis-week-input"
                value={mondayYmd}
                max={bounds.sundayYmd}
                aria-label="Week starting"
                onChange={(event) => {
                  const value = event.target.value;
                  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
                  const picked = new Date(`${value}T12:00:00+05:30`);
                  if (Number.isNaN(picked.getTime())) return;
                  setMondayYmd(nationalKpiMondayYmd(picked));
                }}
              />
            </label>
            <Button type="button" size="sm" variant="outline" onClick={() => setMondayYmd((current) => shiftMonday(current, -7))}>
              Previous
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={onCurrentWeek} onClick={() => setMondayYmd((current) => shiftMonday(current, 7))}>
              Next
            </Button>
          </div>
        }
      />
      {!supabase ? (
        <Card padded>
          <p className="kpis-note">Connect Supabase via Vite env variables.</p>
        </Card>
      ) : sourceQuery.isPending ? (
        <Card padded>
          <p className="kpis-note">Loading the scorecard…</p>
        </Card>
      ) : sourceQuery.isError ? (
        <Card padded>
          <p className="kpis-error">
            {sourceQuery.error instanceof Error ? sourceQuery.error.message : "Could not load KPIs."}
          </p>
        </Card>
      ) : scorecard ? (
        <div className="kpis-root">
          {scorecard.truncated ? (
            <Card padded>
              <p className="kpis-note">
                This scorecard stopped after 20,000 rows in one table. A database summary would be needed before the totals can be treated as complete.
              </p>
            </Card>
          ) : null}
          {scorecard.groups.map((group) => (
            <section key={group.title} className="kpis-section" aria-label={group.title}>
              <h2 className="kpis-section-title">{group.title}</h2>
              <div className="kpis-grid">
                {group.items.map((item) => (
                  <Link key={item.id} to={item.href} className="kpis-card">
                    <span className="kpis-label">{item.label}</span>
                    <span className="kpis-value">{formatMeasure(item.format, item.thisWeek)}</span>
                    {item.thisDetail ? <span className="kpis-detail">{item.thisDetail}</span> : null}
                    <span className="kpis-compare">
                      Last week {formatMeasure(item.format, item.lastWeek)}
                      <span className="kpis-delta">{deltaLabel(item)}</span>
                    </span>
                    <span className="kpis-hint">{item.hint}</span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}
