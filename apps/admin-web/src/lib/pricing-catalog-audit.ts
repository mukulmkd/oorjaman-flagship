import { formatInrFromCents, type PricingCatalogAuditRow } from "@oorjaman/api";
import { formatSqlOperationLabel } from "./notification-labels";

/** Stable audit record id for platform_settings singleton (id=1). */
export const PLATFORM_SETTINGS_AUDIT_RECORD_ID = "00000000-0000-4000-8000-000000000001";

export type CatalogueAuditScope =
  | { kind: "one_time"; capacityTierCode: string; recordId?: string | null }
  | { kind: "amc"; planCode: string; recordId?: string | null }
  | { kind: "geo_tier"; tierCode: string; recordId?: string | null }
  | { kind: "platform_settings" };

function readSnapshot(row: PricingCatalogAuditRow): Record<string, unknown> | null {
  const snap = row.operation === "delete" ? row.old_snapshot : row.new_snapshot;
  if (!snap || typeof snap !== "object" || Array.isArray(snap)) return null;
  return snap as Record<string, unknown>;
}

function readOldSnapshot(row: PricingCatalogAuditRow): Record<string, unknown> | null {
  if (!row.old_snapshot || typeof row.old_snapshot !== "object" || Array.isArray(row.old_snapshot)) return null;
  return row.old_snapshot as Record<string, unknown>;
}

function snapshotTierCode(snap: Record<string, unknown> | null): string | null {
  if (!snap) return null;
  return typeof snap.capacity_tier_code === "string" ? snap.capacity_tier_code : null;
}

function snapshotPlanCode(snap: Record<string, unknown> | null): string | null {
  if (!snap) return null;
  return typeof snap.plan_code === "string" ? snap.plan_code : null;
}

function snapshotGeoTierCode(snap: Record<string, unknown> | null): string | null {
  if (!snap) return null;
  return typeof snap.code === "string" ? snap.code : null;
}

function formatCentsChange(
  row: PricingCatalogAuditRow,
  field: string,
  snap: Record<string, unknown>,
): string | null {
  const next = Number(snap[field]);
  if (!Number.isFinite(next)) return null;
  const prev = Number(readOldSnapshot(row)?.[field]);
  if (row.operation === "update" && Number.isFinite(prev) && prev !== next) {
    return `${formatInrFromCents(prev)} → ${formatInrFromCents(next)}`;
  }
  return formatInrFromCents(next);
}

export function filterCatalogAuditForScope(
  rows: PricingCatalogAuditRow[],
  scope: CatalogueAuditScope,
): PricingCatalogAuditRow[] {
  if (scope.kind === "platform_settings") {
    return rows
      .filter(
        (row) =>
          row.table_name === "platform_settings" && row.record_id === PLATFORM_SETTINGS_AUDIT_RECORD_ID,
      )
      .sort((a, b) => b.changed_at.localeCompare(a.changed_at));
  }

  const table =
    scope.kind === "one_time"
      ? "pricing_one_time_rates"
      : scope.kind === "amc"
        ? "pricing_amc_plans"
        : "pricing_tiers";

  return rows
    .filter((row) => {
      if (row.table_name !== table) return false;
      if (scope.recordId && row.record_id === scope.recordId) return true;
      const snap = readSnapshot(row);
      if (scope.kind === "one_time") {
        return snapshotTierCode(snap) === scope.capacityTierCode;
      }
      if (scope.kind === "amc") {
        return snapshotPlanCode(snap) === scope.planCode;
      }
      return snapshotGeoTierCode(snap) === scope.tierCode;
    })
    .sort((a, b) => b.changed_at.localeCompare(a.changed_at));
}

export function formatCatalogAuditDetail(row: PricingCatalogAuditRow): string {
  const snap = readSnapshot(row);
  if (!snap) return formatSqlOperationLabel(row.operation);

  const parts: string[] = [formatSqlOperationLabel(row.operation)];

  if (row.table_name === "platform_settings") {
    const fee = formatCentsChange(row, "customer_late_cancel_fee_paise", snap);
    if (fee) parts.push(`Late-cancellation fee ${fee}`);
    const feePct = readOldSnapshot(row)?.vendor_platform_fee_percent;
    const nextPct = snap.vendor_platform_fee_percent;
    if (typeof nextPct === "number" || typeof nextPct === "string") {
      const next = Number(nextPct);
      const prev = Number(feePct);
      if (row.operation === "update" && Number.isFinite(prev) && Number.isFinite(next) && prev !== next) {
        parts.push(`Platform fee ${prev}% → ${next}%`);
      }
    }
    return parts.join(" · ");
  }

  if (row.table_name === "pricing_tiers") {
    const label = typeof snap.label === "string" ? snap.label : snapshotGeoTierCode(snap) ?? "";
    if (label) parts.push(label);
    const visit = formatCentsChange(row, "visit_addon_cents", snap);
    const amc = formatCentsChange(row, "amc_addon_cents", snap);
    if (visit) parts.push(`visit add-on ${visit}`);
    if (amc) parts.push(`AMC add-on ${amc}`);
    return parts.join(" · ");
  }

  const tier = snapshotTierCode(snap);
  const plan =
    typeof snap.plan_name === "string"
      ? snap.plan_name
      : snapshotPlanCode(snap) ?? tier ?? "";
  if (plan) parts.push(plan);

  const amount = Number(snap.amount_cents);
  if (Number.isFinite(amount)) {
    const amountChange = formatCentsChange(row, "amount_cents", snap);
    if (amountChange) parts.push(amountChange);
  }

  const perPanel = Number(snap.per_panel_rate_cents);
  if (Number.isFinite(perPanel) && row.table_name === "pricing_one_time_rates") {
    const perPanelChange = formatCentsChange(row, "per_panel_rate_cents", snap);
    if (perPanelChange) parts.push(`per panel ${perPanelChange}`);
  }

  return parts.join(" · ");
}

export function formatCatalogAuditWhen(changedAt: string): string {
  return new Date(changedAt).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
