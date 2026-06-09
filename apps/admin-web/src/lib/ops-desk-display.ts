import type {
  BookingMonitoringEnriched,
  OpsAmcAwaitingPartnerRow,
  OpsBookingExceptionRow,
  OpsIssueType,
} from "@oorjaman/api";
import { readBookingServiceOtpMeta } from "@oorjaman/api";
import { formatDisplayDateTime } from "@oorjaman/utils";
import { isOpsExceptionPastWindow } from "./ops-exceptions-display";
import { OPS_ISSUE_LABELS } from "./booking-routing-display";

export type OpsDeskTimeFilter = "needs_action" | "overdue_cleanup" | "history";

export type OpsDeskCategoryFilter =
  | "all"
  | "partner_needed"
  | "partner_slow"
  | "visit_at_risk"
  | "onsite_blocked"
  | "amc_setup";

export type OpsDeskInboxKind = "booking_exception" | "otp_risk" | "amc_setup";

export type OpsDeskQueueCategory =
  | "partner_needed"
  | "partner_slow"
  | "visit_at_risk"
  | "onsite_blocked"
  | "amc_setup";

export type OpsDeskInboxRow = {
  id: string;
  kind: OpsDeskInboxKind;
  category: OpsDeskQueueCategory;
  title: string;
  reason: string;
  timingLabel: string;
  severity: "high" | "medium" | null;
  partnerLabel: string;
  sortKey: number;
  bookingId?: string;
  subscriptionId?: string;
  referenceCode?: string;
  issueType?: string | null;
  vendorId?: string | null;
};

export const OPS_DESK_TIME_TABS: {
  id: OpsDeskTimeFilter;
  label: string;
  hint: string;
}[] = [
  {
    id: "needs_action",
    label: "Needs action now",
    hint: "Visits at risk today, on-site OTP blocks, and AMC paid without a partner.",
  },
  {
    id: "overdue_cleanup",
    label: "Overdue cleanup",
    hint: "Scheduled window ended but the booking is still open. Resolve on Bookings or cancel.",
  },
  {
    id: "history",
    label: "History",
    hint: "All booking exceptions including stale schedule-missed rows.",
  },
];

export const OPS_DESK_CATEGORY_FILTERS: {
  id: OpsDeskCategoryFilter;
  label: string;
}[] = [
  { id: "all", label: "All" },
  { id: "partner_needed", label: "Partner needed" },
  { id: "partner_slow", label: "Partner slow" },
  { id: "visit_at_risk", label: "Visit at risk" },
  { id: "onsite_blocked", label: "On-site blocked" },
  { id: "amc_setup", label: "AMC setup" },
];

const PARTNER_NEEDED: OpsIssueType[] = [
  "default_vendor_unclaimed",
  "awaiting_admin_float",
];

const PARTNER_SLOW: OpsIssueType[] = [
  "preferred_vendor_no_response",
  "vendor_slow_confirmation",
];

const VISIT_AT_RISK: OpsIssueType[] = [
  "visit_not_started",
  "visit_not_closed",
  "schedule_missed",
];

export function opsDeskCategoryForIssue(issueType: string | null): OpsDeskQueueCategory {
  if (!issueType) return "visit_at_risk";
  if (PARTNER_NEEDED.includes(issueType as OpsIssueType)) return "partner_needed";
  if (PARTNER_SLOW.includes(issueType as OpsIssueType)) return "partner_slow";
  if (VISIT_AT_RISK.includes(issueType as OpsIssueType)) return "visit_at_risk";
  return "visit_at_risk";
}

export function opsDeskHumanReason(issueType: string | null, issueLabel: string | null): string {
  if (issueLabel?.trim()) return issueLabel.trim();
  if (!issueType) return "Operational exception";
  return OPS_ISSUE_LABELS[issueType as OpsIssueType] ?? issueType.replace(/_/g, " ");
}

export function formatOpsDeskSla(
  scheduledStart: string,
  scheduledEnd: string,
  now = new Date(),
): string {
  const start = new Date(scheduledStart).getTime();
  const end = new Date(scheduledEnd).getTime();
  const t = now.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "Schedule pending";

  if (t > end) {
    const overdueMin = Math.max(0, Math.round((t - end) / 60_000));
    if (overdueMin < 60) return `Past window · ${overdueMin}m overdue`;
    const h = Math.floor(overdueMin / 60);
    return `Past window · ${h}h overdue`;
  }

  if (t >= start && t <= end) {
    const intoMin = Math.max(0, Math.round((t - start) / 60_000));
    if (intoMin < 60) return `In visit window · started ${intoMin}m ago`;
    return `In visit window · ${Math.floor(intoMin / 60)}h in`;
  }

  const untilMin = Math.max(0, Math.round((start - t) / 60_000));
  if (untilMin < 60) return `Starts in ${untilMin}m`;
  const untilH = Math.floor(untilMin / 60);
  const remM = untilMin % 60;
  return remM > 0 ? `Starts in ${untilH}h ${remM}m` : `Starts in ${untilH}h`;
}

function rowFromException(
  row: OpsBookingExceptionRow,
  vendorNameById: Map<string, string>,
  now: Date,
): OpsDeskInboxRow {
  const category = opsDeskCategoryForIssue(row.issue_type);
  const partnerLabel = row.vendor_id
    ? (vendorNameById.get(row.vendor_id) ?? `${row.vendor_id.slice(0, 8)}…`)
    : "None";
  return {
    id: `exc-${row.booking_id}`,
    kind: "booking_exception",
    category,
    title: row.reference_code ?? row.booking_id.slice(0, 8),
    reason: opsDeskHumanReason(row.issue_type, row.issue_label),
    timingLabel: formatOpsDeskSla(row.scheduled_start, row.scheduled_end, now),
    severity: row.issue_level,
    partnerLabel,
    sortKey: new Date(row.scheduled_start).getTime(),
    bookingId: row.booking_id,
    referenceCode: row.reference_code ?? undefined,
    issueType: row.issue_type,
    vendorId: row.vendor_id,
  };
}

function rowFromOtp(
  row: BookingMonitoringEnriched,
  vendorNameById: Map<string, string>,
): OpsDeskInboxRow | null {
  const otp = readBookingServiceOtpMeta(row.metadata);
  const locked = Boolean(otp.startLockedUntil || otp.happyLockedUntil);
  const mismatches = otp.startFailCount + otp.happyFailCount;
  if (!locked && mismatches < 2) return null;

  const partnerLabel = row.vendor_id
    ? (vendorNameById.get(row.vendor_id) ?? `${row.vendor_id.slice(0, 8)}…`)
    : "None";

  return {
    id: `otp-${row.id}`,
    kind: "otp_risk",
    category: "onsite_blocked",
    title: row.reference_code,
    reason: locked
      ? "OTP locked - technician cannot start or close visit"
      : `High OTP mismatches (${mismatches} attempts)`,
    timingLabel: formatOpsDeskSla(row.scheduled_start, row.scheduled_end),
    severity: locked ? "high" : "medium",
    partnerLabel,
    sortKey: locked ? 0 : Date.now(),
    bookingId: row.id,
    referenceCode: row.reference_code,
    vendorId: row.vendor_id,
  };
}

function rowFromAmc(row: OpsAmcAwaitingPartnerRow): OpsDeskInboxRow {
  const customer = row.customer_label?.trim() || `Customer ${row.customer_id.slice(0, 8)}`;
  return {
    id: `amc-${row.subscription_id}`,
    kind: "amc_setup",
    category: "amc_setup",
    title: row.plan_name,
    reason: `${customer} paid - assign dedicated AMC partner`,
    timingLabel: row.funded_at
      ? `Paid ${formatDisplayDateTime(row.funded_at)}`
      : "Payment received",
    severity: "high",
    partnerLabel: "None",
    sortKey: row.funded_at ? new Date(row.funded_at).getTime() : Date.now(),
    subscriptionId: row.subscription_id,
  };
}

export function buildOpsDeskInboxRows(input: {
  exceptions: OpsBookingExceptionRow[];
  monitorRows: BookingMonitoringEnriched[];
  amcRows: OpsAmcAwaitingPartnerRow[];
  vendorNameById: Map<string, string>;
  timeFilter: OpsDeskTimeFilter;
  categoryFilter: OpsDeskCategoryFilter;
  now?: Date;
}): OpsDeskInboxRow[] {
  const now = input.now ?? new Date();
  const out: OpsDeskInboxRow[] = [];

  if (input.timeFilter === "needs_action") {
    for (const row of input.exceptions) {
      if (isOpsExceptionPastWindow(row, now)) continue;
      out.push(rowFromException(row, input.vendorNameById, now));
    }
    for (const row of input.monitorRows) {
      const otpRow = rowFromOtp(row, input.vendorNameById);
      if (otpRow) out.push(otpRow);
    }
    for (const amc of input.amcRows) {
      out.push(rowFromAmc(amc));
    }
  } else {
    for (const row of input.exceptions) {
      if (input.timeFilter === "overdue_cleanup" && !isOpsExceptionPastWindow(row, now)) {
        continue;
      }
      out.push(rowFromException(row, input.vendorNameById, now));
    }
  }

  const filtered =
    input.categoryFilter === "all"
      ? out
      : out.filter((r) => r.category === input.categoryFilter);

  return filtered.sort((a, b) => {
    const sev =
      (b.severity === "high" ? 2 : b.severity === "medium" ? 1 : 0) -
      (a.severity === "high" ? 2 : a.severity === "medium" ? 1 : 0);
    if (sev !== 0) return sev;
    return a.sortKey - b.sortKey;
  });
}

export function opsDeskPrimaryActionLabel(row: OpsDeskInboxRow): string {
  if (row.kind === "amc_setup") return "Assign AMC partner";
  if (row.kind === "otp_risk") return "Reset OTP";
  if (row.category === "partner_needed") return "Assign partner";
  return "Intervene";
}

export function opsDeskCategoryLabel(category: OpsDeskQueueCategory): string {
  return OPS_DESK_CATEGORY_FILTERS.find((c) => c.id === category)?.label ?? category;
}
