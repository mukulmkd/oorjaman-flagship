import type { SupportInboxFilter } from "@oorjaman/api";

const VALID_FILTERS: SupportInboxFilter[] = ["queued", "mine", "open", "unassigned", "resolved"];

export type InboxDrillDown = {
  filter: SupportInboxFilter;
  category?: string;
  since?: "24h";
  highlight?: "csat" | "first-reply";
  /** Shown at top of inbox when arriving from Insights. */
  label?: string;
};

export function parseInboxDrillDown(params: URLSearchParams): InboxDrillDown {
  const rawFilter = params.get("filter");
  const filter = VALID_FILTERS.includes(rawFilter as SupportInboxFilter)
    ? (rawFilter as SupportInboxFilter)
    : "queued";

  const highlightRaw = params.get("highlight");
  const highlight =
    highlightRaw === "csat"
      ? "csat"
      : highlightRaw === "first-reply"
        ? "first-reply"
        : undefined;

  return {
    filter,
    category: params.get("category")?.trim() || undefined,
    since: params.get("since") === "24h" ? "24h" : undefined,
    highlight,
    label: params.get("label")?.trim() || undefined,
  };
}

export function inboxDrillDownPath(drill: InboxDrillDown): string {
  const p = new URLSearchParams();
  p.set("filter", drill.filter);
  if (drill.category) p.set("category", drill.category);
  if (drill.since) p.set("since", drill.since);
  if (drill.highlight) p.set("highlight", drill.highlight);
  if (drill.label) p.set("label", drill.label);
  const q = p.toString();
  return `/inbox${q ? `?${q}` : ""}`;
}

export type InsightCardKey =
  | "open"
  | "queued"
  | "unassigned"
  | "resolved_24h"
  | "first_reply"
  | "csat";

export function inboxPathFromInsightCard(key: InsightCardKey): string {
  switch (key) {
    case "open":
      return inboxDrillDownPath({ filter: "open", label: "All open chats" });
    case "queued":
      return inboxDrillDownPath({ filter: "queued", label: "Queued chats" });
    case "unassigned":
      return inboxDrillDownPath({ filter: "unassigned", label: "Unassigned chats" });
    case "resolved_24h":
      return inboxDrillDownPath({
        filter: "resolved",
        since: "24h",
        label: "Resolved in the last 24 hours",
      });
    case "first_reply":
      return inboxDrillDownPath({
        filter: "resolved",
        highlight: "first-reply",
        label: "Resolved chats — first reply performance (7d)",
      });
    case "csat":
      return inboxDrillDownPath({
        filter: "resolved",
        highlight: "csat",
        label: "Resolved chats — customer ratings (7d)",
      });
  }
}

export function inboxPathFromCategoryInsight(categorySlug: string, categoryLabel: string): string {
  return inboxDrillDownPath({
    filter: "open",
    category: categorySlug,
    label: `Open chats · ${categoryLabel}`,
  });
}
