import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  adminListAmcDesk,
  formatInrFromCents,
  isNationalAdminRole,
  listMyOperationStateNames,
  queryKeys,
  type AmcDeskRow,
  type AmcDeskSituation,
} from "@oorjaman/api";
import { formatDisplayDate } from "@oorjaman/utils";
import { Badge, Card, Input, PageHeader } from "@oorjaman/web-ui";
import { useAdminPortalSession, useSupabase } from "@oorjaman/web-ui";
import "./amc-desk-page.css";

const SITUATIONS: {
  id: AmcDeskSituation | "all";
  label: string;
  tone: "neutral" | "warning" | "success" | "danger";
}[] = [
  { id: "all", label: "All", tone: "neutral" },
  { id: "payment_pending", label: "Payment pending", tone: "warning" },
  { id: "paid_no_booking", label: "Paid, no visit booked", tone: "warning" },
  { id: "next_visit_due", label: "Next visit not booked", tone: "warning" },
  { id: "visit_open", label: "Visit booked", tone: "success" },
  { id: "past_due", label: "Past due", tone: "danger" },
  { id: "paused", label: "Paused", tone: "neutral" },
  { id: "complete", label: "Visits complete", tone: "success" },
  { id: "expired", label: "Ended", tone: "neutral" },
  { id: "cancelled", label: "Cancelled", tone: "danger" },
];

function situationMeta(id: AmcDeskSituation) {
  return SITUATIONS.find((item) => item.id === id) ?? SITUATIONS[0];
}

function actionFor(row: AmcDeskRow): string {
  switch (row.situation) {
    case "payment_pending":
      return `Collect ${formatInrFromCents(row.amountCents)} before scheduling a visit.`;
    case "paid_no_booking":
      return row.nextSlotOverdue
        ? "First visit is overdue. Schedule it with the partner."
        : "Payment is in. Schedule the first visit.";
    case "next_visit_due":
      return row.nextSlotOverdue
        ? "The next visit is overdue. Schedule it."
        : "Earlier visits are done. Schedule the next one.";
    case "visit_open":
      return row.openBookingReference
        ? `${row.openBookingReference} is ${(row.openBookingStatus ?? "booked").replaceAll("_", " ")}.`
        : "A visit is already booked.";
    case "past_due":
      return "Payment is overdue. Follow up before the next visit.";
    case "paused":
      return "Plan is paused. Resume it before scheduling.";
    case "cancelled":
      return "Contract is cancelled.";
    case "expired":
      return "Contract has ended.";
    case "complete":
      return "Included visits are done.";
  }
}

export function AmcDeskPage() {
  const supabase = useSupabase();
  const sessionQuery = useAdminPortalSession();
  const national = isNationalAdminRole(sessionQuery.data?.row?.role);
  const [situation, setSituation] = useState<AmcDeskSituation | "all">("all");
  const [search, setSearch] = useState("");

  const scopeQuery = useQuery({
    queryKey: queryKeys.bookings.operationScope(),
    queryFn: () => listMyOperationStateNames(supabase!),
    enabled: Boolean(supabase) && sessionQuery.data?.row?.role === "state_ops",
  });

  const scopeKey = national ? "all" : (scopeQuery.data ?? []).join("|");
  const deskQuery = useQuery({
    queryKey: queryKeys.subscriptions.amcDesk(scopeKey),
    queryFn: () =>
      adminListAmcDesk(
        supabase!,
        national ? undefined : { stateNames: scopeQuery.data ?? [] },
      ),
    enabled: Boolean(supabase) && (national || scopeQuery.isSuccess),
  });

  const rows = deskQuery.data ?? [];
  const counts = useMemo(() => {
    const map = new Map<AmcDeskSituation | "all", number>();
    map.set("all", rows.length);
    for (const item of SITUATIONS) {
      if (item.id !== "all") map.set(item.id, 0);
    }
    for (const row of rows) map.set(row.situation, (map.get(row.situation) ?? 0) + 1);
    return map;
  }, [rows]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (situation !== "all" && row.situation !== situation) return false;
      if (!needle) return true;
      const haystack = [row.customerName, row.customerPhone, row.customerEmail, row.city, row.state, row.site, row.planName, row.vendorName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [rows, search, situation]);

  const scopeLabel = national
    ? "All states"
    : scopeQuery.data && scopeQuery.data.length > 0
      ? scopeQuery.data.join(", ")
      : "No state assigned";

  return (
    <div className="amc-desk">
      <PageHeader
        title="AMC"
        subtitle={`${scopeLabel}. Paid plans with no visit, unpaid plans, and every other contract state.`}
      />

      <div className="amc-desk-filters">
        {SITUATIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={situation === item.id ? "amc-desk-chip is-active" : "amc-desk-chip"}
            onClick={() => setSituation(item.id)}
          >
            {item.label}
            <span>{counts.get(item.id) ?? 0}</span>
          </button>
        ))}
      </div>

      <Card padded>
        <Input
          label=""
          type="search"
          placeholder="Search customer, city, or plan"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label="Search AMC contracts"
        />
      </Card>

      {deskQuery.isError ? (
        <Card padded>
          <p className="amc-desk-error">{(deskQuery.error as Error).message}</p>
        </Card>
      ) : deskQuery.isPending ? (
        <Card padded>
          <p className="amc-desk-muted">Loading AMC contracts…</p>
        </Card>
      ) : visible.length === 0 ? (
        <Card padded>
          <p className="amc-desk-muted">No AMC contracts in this view.</p>
        </Card>
      ) : (
        <div className="amc-desk-table-wrap">
          <table className="amc-desk-table">
            <thead>
              <tr>
                <th>Situation</th>
                <th>Customer</th>
                <th>Site</th>
                <th>Plan</th>
                <th>Visits</th>
                <th>What to do</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const meta = situationMeta(row.situation);
                return (
                  <tr key={row.subscriptionId}>
                    <td>
                      <Badge tone={meta?.tone ?? "neutral"}>{meta?.label ?? row.situation}</Badge>
                    </td>
                    <td>
                      <div className="amc-desk-primary">{row.customerName}</div>
                      <div className="amc-desk-muted">{row.customerPhone || row.customerEmail || "No contact"}</div>
                    </td>
                    <td>
                      <div className="amc-desk-primary">{[row.city, row.state].filter(Boolean).join(", ") || "Site not set"}</div>
                      {row.site ? <div className="amc-desk-muted">{row.site}</div> : null}
                    </td>
                    <td>
                      <div className="amc-desk-primary">{row.planName}</div>
                      <div className="amc-desk-muted">
                        {formatInrFromCents(row.amountCents)}
                        {row.vendorName ? ` · ${row.vendorName}` : " · No partner"}
                      </div>
                      <div className="amc-desk-muted">Through {formatDisplayDate(row.endsAt)}</div>
                    </td>
                    <td>
                      {row.visitsCompleted}
                      {row.visitsIncluded != null ? ` / ${row.visitsIncluded}` : ""}
                    </td>
                    <td className="amc-desk-action">{actionFor(row)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
