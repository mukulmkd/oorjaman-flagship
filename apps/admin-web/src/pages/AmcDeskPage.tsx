import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminListAmcDesk,
  adminScheduleAmcVisit,
  formatInrFromCents,
  isNationalAdminRole,
  listMyOperationStateNames,
  queryKeys,
  type AmcDeskRow,
  type AmcDeskSituation,
} from "@oorjaman/api";
import {
  formatDayChip,
  formatDisplayDate,
  listSelectableDayKeys,
  NEW_BOOKING_EARLIEST_DAY_KEY,
  NEW_BOOKING_EARLIEST_LABEL,
  slotsForDay,
  type BookingSlotOption,
} from "@oorjaman/utils";
import { Badge, Button, Card, Input, Modal, PageHeader } from "@oorjaman/web-ui";
import { useAdminPortalSession, useSupabase } from "@oorjaman/web-ui";
import "./amc-desk-page.css";

function canScheduleVisit(row: AmcDeskRow): boolean {
  return Boolean(
    row.nextSlotId &&
      row.assignedVendorId &&
      (row.situation === "paid_no_booking" || row.situation === "next_visit_due"),
  );
}

const SITUATIONS: {
  id: AmcDeskSituation | "all";
  label: string;
  tone: "neutral" | "warning" | "success" | "danger";
}[] = [
  { id: "all", label: "All", tone: "neutral" },
  { id: "payment_pending", label: "Draft", tone: "warning" },
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
      return `Draft. Collect ${formatInrFromCents(row.amountCents)} to start the plan. It starts the day payment is received.`;
    case "expired":
      return row.amcPhase === "draft_inactive"
        ? "Draft closed after 14 days without payment. The customer can start a new AMC."
        : "Contract has ended.";
    case "paid_no_booking":
      if (!row.assignedVendorId) return "Payment is in. Assign a partner before scheduling the first visit.";
      return row.nextSlotOverdue
        ? "First visit is overdue. Schedule it from this page, or ask the customer to schedule one."
        : "Payment is in. Schedule the first visit from this page, or ask the customer to schedule one.";
    case "next_visit_due":
      if (!row.assignedVendorId) return "Assign a partner before scheduling the next visit.";
      return row.nextSlotOverdue
        ? "The next visit is overdue. Schedule it from this page, or ask the customer to schedule one."
        : "Earlier visits are done. Schedule the next one from this page, or ask the customer to schedule one.";
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
    case "complete":
      return "Included visits are done.";
  }
}

export function AmcDeskPage() {
  const supabase = useSupabase();
  const sessionQuery = useAdminPortalSession();
  const national = isNationalAdminRole(sessionQuery.data?.row?.role);
  const queryClient = useQueryClient();
  const [situation, setSituation] = useState<AmcDeskSituation | "all">("all");
  const [search, setSearch] = useState("");
  const [scheduleRow, setScheduleRow] = useState<AmcDeskRow | null>(null);
  const [dayKey, setDayKey] = useState("");
  const [slotId, setSlotId] = useState("");
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduledReference, setScheduledReference] = useState<string | null>(null);

  const dayKeys = useMemo(() => listSelectableDayKeys(new Date(), 21, NEW_BOOKING_EARLIEST_DAY_KEY), []);
  const daySlots = useMemo(() => (dayKey ? slotsForDay(dayKey, new Date(), NEW_BOOKING_EARLIEST_DAY_KEY) : []), [dayKey]);

  useEffect(() => {
    if (!scheduleRow) return;
    const first = dayKeys.find((key) => slotsForDay(key, new Date(), NEW_BOOKING_EARLIEST_DAY_KEY).length > 0) ?? dayKeys[0] ?? "";
    setDayKey(first);
    setSlotId("");
    setScheduleError(null);
  }, [scheduleRow, dayKeys]);

  useEffect(() => {
    if (!daySlots.some((slot) => slot.id === slotId)) setSlotId(daySlots[0]?.id ?? "");
  }, [daySlots, slotId]);

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

  const scheduleMutation = useMutation({
    mutationFn: async (slot: BookingSlotOption) => {
      const siteAddressText =
        scheduleRow?.site?.trim() ||
        [scheduleRow?.city, scheduleRow?.state].filter(Boolean).join(", ");
      if (!supabase || !scheduleRow?.nextSlotId || !siteAddressText) {
        throw new Error("This contract has no site address to schedule.");
      }
      return adminScheduleAmcVisit(supabase, {
        slotId: scheduleRow.nextSlotId,
        scheduledStart: slot.scheduledStart,
        scheduledEnd: slot.scheduledEnd,
        scheduleSlotMeta: { day_key: dayKey, slot_id: slot.id, label: slot.label },
        siteAddressText,
      });
    },
    onSuccess: async ({ booking }) => {
      setScheduledReference(booking.reference_code);
      setScheduleRow(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions.all() });
      await queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all() });
    },
    onError: (error: Error) => setScheduleError(error.message),
  });

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
                      <Badge tone={meta?.tone ?? "neutral"}>
                        {row.amcPhase === "draft_inactive" ? "Draft closed" : (meta?.label ?? row.situation)}
                      </Badge>
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
                      <div className="amc-desk-muted">
                        {row.situation === "payment_pending"
                          ? "Starts the day payment is received"
                          : `Through ${formatDisplayDate(row.endsAt)}`}
                      </div>
                    </td>
                    <td>
                      {row.visitsCompleted}
                      {row.visitsIncluded != null ? ` / ${row.visitsIncluded}` : ""}
                    </td>
                    <td className="amc-desk-action">
                      <div>{actionFor(row)}</div>
                      {canScheduleVisit(row) ? (
                        <Button type="button" size="sm" onClick={() => setScheduleRow(row)}>
                          Schedule visit
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {scheduledReference ? (
        <p className="amc-desk-success">Scheduled {scheduledReference}. It now appears in Bookings as an AMC visit.</p>
      ) : null}

      <Modal
        open={Boolean(scheduleRow)}
        title="Schedule visit"
        description={
          scheduleRow
            ? `${scheduleRow.customerName} · ${scheduleRow.vendorName ?? "Assigned partner"} · ${[scheduleRow.city, scheduleRow.state].filter(Boolean).join(", ")}`
            : undefined
        }
        onClose={() => {
          if (!scheduleMutation.isPending) setScheduleRow(null);
        }}
      >
        {scheduleRow ? (
          <form
            className="amc-desk-schedule"
            onSubmit={(event) => {
              event.preventDefault();
              const slot = daySlots.find((item) => item.id === slotId);
              if (!slot) {
                setScheduleError("Choose a time slot.");
                return;
              }
              setScheduleError(null);
              scheduleMutation.mutate(slot);
            }}
          >
            <p className="amc-desk-muted">{scheduleRow.site}</p>
            <p className="amc-desk-muted">Visits can be scheduled from {NEW_BOOKING_EARLIEST_LABEL}.</p>
            <label className="amc-desk-field">
              <span>Date</span>
              <select value={dayKey} onChange={(event) => setDayKey(event.target.value)}>
                {dayKeys.map((key) => (
                  <option key={key} value={key}>
                    {formatDayChip(key)}
                  </option>
                ))}
              </select>
            </label>
            <div className="amc-desk-slots" role="radiogroup" aria-label="Time slot">
              {daySlots.length === 0 ? <p className="amc-desk-muted">No slots on this day.</p> : null}
              {daySlots.map((slot) => (
                <label key={slot.id} className={slot.id === slotId ? "is-selected" : ""}>
                  <input
                    type="radio"
                    name="amc-slot"
                    checked={slot.id === slotId}
                    onChange={() => setSlotId(slot.id)}
                  />
                  {slot.label}
                </label>
              ))}
            </div>
            {scheduleError ? <p className="amc-desk-error">{scheduleError}</p> : null}
            <div className="amc-desk-schedule-actions">
              <Button type="button" variant="ghost" onClick={() => setScheduleRow(null)} disabled={scheduleMutation.isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={scheduleMutation.isPending || daySlots.length === 0}>
                {scheduleMutation.isPending ? "Scheduling…" : "Schedule visit"}
              </Button>
            </div>
          </form>
        ) : null}
      </Modal>
    </div>
  );
}
