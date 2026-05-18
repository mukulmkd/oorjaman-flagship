import type { CSSProperties, HTMLAttributes } from "react";

type BlockProps = HTMLAttributes<HTMLDivElement> & {
  style?: CSSProperties;
};

/** Shimmer block for dashboard loading states (replaces spinners in admin). */
export function SkeletonBlock({ className, style, ...rest }: BlockProps) {
  return <div className={className ? `web-skeleton-block ${className}` : "web-skeleton-block"} style={style} {...rest} />;
}

type DashboardSkeletonProps = {
  /** Number of placeholder KPI tiles */
  kpiCount?: number;
};

/** KPI row + chart placeholders for analytics-style pages */
export function DashboardSkeleton({ kpiCount = 3 }: DashboardSkeletonProps) {
  const n = Math.min(Math.max(kpiCount, 2), 6);
  return (
    <div className="web-dashboard-skeleton" aria-busy="true" aria-label="Loading dashboard">
      <div className="web-dashboard-skeleton-kpis">
        {Array.from({ length: n }).map((_, i) => (
          <SkeletonBlock key={i} className="web-dashboard-skeleton-kpi" />
        ))}
      </div>
      <SkeletonBlock className="web-dashboard-skeleton-chart" />
      <SkeletonBlock className="web-dashboard-skeleton-chart web-dashboard-skeleton-chart--short" />
      <SkeletonBlock className="web-dashboard-skeleton-chart web-dashboard-skeleton-chart--tall" />
    </div>
  );
}

/** Table row strip for list pages */
export function TableRowsSkeleton({ rows = 6 }: { rows?: number }) {
  const r = Math.min(Math.max(rows, 3), 14);
  return (
    <div className="web-table-skeleton" aria-busy="true" aria-label="Loading table">
      {Array.from({ length: r }).map((_, i) => (
        <SkeletonBlock key={i} className="web-table-skeleton-row" />
      ))}
    </div>
  );
}
