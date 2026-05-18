import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { queryKeys, supportApi } from "@oorjaman/api";
import { PageHeader } from "@oorjaman/web-ui";
import {
  inboxPathFromCategoryInsight,
  inboxPathFromInsightCard,
} from "../lib/support-inbox-url";
import { useSupabase } from "../lib/supabase-context";
import "./support-inbox.css";

const CATEGORY_LABELS: Record<string, string> = {
  booking: "Booking related",
  amc: "AMC related",
  other: "Any other query",
};

type InsightMetricCard = {
  key: Parameters<typeof inboxPathFromInsightCard>[0];
  value: string;
  label: string;
  hint: string;
};

export function SupportInsightsPage() {
  const supabase = useSupabase();

  const insightsQ = useQuery({
    queryKey: queryKeys.support.insights(),
    queryFn: () => supportApi.getSupportDeskInsights(supabase!),
    enabled: Boolean(supabase),
    refetchInterval: 60_000,
  });

  const data = insightsQ.data;

  const metricCards: InsightMetricCard[] = data
    ? [
        {
          key: "open",
          value: String(data.open_count),
          label: "Open chats",
          hint: "View all open conversations in the inbox",
        },
        {
          key: "queued",
          value: String(data.queued_count),
          label: "In queue",
          hint: "View chats waiting for an agent",
        },
        {
          key: "unassigned",
          value: String(data.unassigned_count),
          label: "Unassigned",
          hint: "View open chats with no assignee",
        },
        {
          key: "resolved_24h",
          value: String(data.resolved_24h),
          label: "Resolved (24h)",
          hint: "View chats resolved in the last 24 hours",
        },
        {
          key: "first_reply",
          value: data.avg_first_reply_minutes != null ? `${data.avg_first_reply_minutes}m` : "—",
          label: "Avg first reply (7d)",
          hint: "View resolved chats with first-reply timing (7d)",
        },
        {
          key: "csat",
          value: data.avg_csat_7d != null ? data.avg_csat_7d.toFixed(1) : "—",
          label: "Avg CSAT (7d)",
          hint: "View resolved chats with customer ratings (7d)",
        },
      ]
    : [];

  return (
    <div className="support-insights-page">
      <PageHeader
        title="Supervisor insights"
        subtitle="Live queue health and recent desk performance. Click a metric to open the matching inbox view."
      />
      {insightsQ.isPending ? <p className="support-inbox-muted">Loading…</p> : null}
      {insightsQ.isError ? (
        <p className="support-inbox-error">{(insightsQ.error as Error).message}</p>
      ) : null}
      {data ? (
        <div className="support-insights-grid">
          {metricCards.map((card) => (
            <Link
              key={card.key}
              to={inboxPathFromInsightCard(card.key)}
              className="support-insights-card support-insights-card-link"
              title={card.hint}
            >
              <div className="support-insights-value">{card.value}</div>
              <div className="support-insights-label">{card.label}</div>
              <span className="support-insights-card-cta">View in inbox →</span>
            </Link>
          ))}
        </div>
      ) : null}
      {data && data.by_category.length > 0 ? (
        <>
          <h2 className="support-context-subtitle">Open by category</h2>
          <p className="support-inbox-muted support-insights-category-lead">
            Click a category to see open chats in that topic.
          </p>
          <ul className="support-insights-categories">
            {data.by_category.map((row) => {
              const categoryLabel = CATEGORY_LABELS[row.category_slug] ?? row.category_slug;
              return (
                <li key={row.category_slug}>
                  <Link
                    to={inboxPathFromCategoryInsight(row.category_slug, categoryLabel)}
                    className="support-insights-category-link"
                  >
                    <span>{categoryLabel}</span>
                    <strong>{row.count}</strong>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
    </div>
  );
}
