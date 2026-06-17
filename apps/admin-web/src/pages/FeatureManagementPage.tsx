import { webTypography } from "./../styles/typography";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  DEFAULT_TABLE_PAGE_SIZE,
  adminListNotificationChannelSettings,
  adminUpdateNotificationChannelSetting,
  queryKeys,
  type Database,
  type NotificationChannelSettingRow,
} from "@oorjaman/api";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Button, Card, Modal, PageHeader } from "@oorjaman/web-ui";
import { useSupabase } from "../lib/supabase-client";
import { TablePaginationBar } from "../components/TablePaginationBar";
import { formatNotificationChannelLabel, formatNotificationEventTypeLabel } from "../lib/notification-labels";

export function FeatureManagementPage() {
  const supabase = useSupabase();
  const qc = useQueryClient();
  const [actionRow, setActionRow] = useState<NotificationChannelSettingRow | null>(null);
  const [page, setPage] = useState(1);

  const channelSettingsQuery = useQuery({
    queryKey: queryKeys.bookings.notificationChannelSettings(),
    queryFn: () => adminListNotificationChannelSettings(supabase!),
    enabled: Boolean(supabase),
  });

  const rows = useMemo(
    () => [...(channelSettingsQuery.data ?? [])].sort((a, b) => a.event_type.localeCompare(b.event_type)),
    [channelSettingsQuery.data],
  );

  const rowsTotal = rows.length;
  const rowsWindow = useMemo(
    () => rows.slice((page - 1) * DEFAULT_TABLE_PAGE_SIZE, page * DEFAULT_TABLE_PAGE_SIZE),
    [rows, page],
  );

  return (
    <>
      <PageHeader
        title="Feature management"
        subtitle="Turn notification delivery channels on or off independently for demo and live pipelines - same flags as notifications, isolated for operational clarity."
        actions={
          <Button variant="outline" size="sm" type="button" onClick={() => void channelSettingsQuery.refetch()}>
            Refresh
          </Button>
        }
      />

      {!supabase ? (
        <Card padded>
          <p className="dash-muted-line">Connect Supabase via Vite env variables.</p>
        </Card>
      ) : channelSettingsQuery.isLoading ? (
        <Card padded>
          <p className="dash-table-empty">Loading feature flags…</p>
        </Card>
      ) : channelSettingsQuery.isError ? (
        <Card padded>
          <p className="dash-empty-title">Couldn&apos;t load channel settings</p>
          <p className="dash-empty-error">{(channelSettingsQuery.error as Error).message}</p>
        </Card>
      ) : (
        <Card padded={false}>
          <div style={{ padding: "1rem 1rem 0" }}>
            <h2 style={{ margin: "0 0 0.5rem", fontSize: webTypography.size.md, fontWeight: webTypography.weight.semibold }}>Notification channel flags</h2>
            <p style={{ margin: 0, fontSize: webTypography.size.sm, color: "var(--wb-muted-fg)" }}>
              Demo vs live toggles apply per event type and channel.
            </p>
          </div>
          {rows.length === 0 ? (
            <p className="vd-empty">No channel settings.</p>
          ) : (
            <>
              <div className="bm-table-wrap">
                <table className="bm-table">
                  <thead>
                    <tr>
                      <th>Event</th>
                      <th>Channel</th>
                      <th>Demo</th>
                      <th>Live</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rowsWindow.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <div>{formatNotificationEventTypeLabel(row.event_type)}</div>
                          <div className="bm-muted bm-cell-mono" style={{ fontSize: "0.75rem" }}>
                            {row.event_type}
                          </div>
                        </td>
                        <td>
                          <div>{formatNotificationChannelLabel(row.channel)}</div>
                          <div className="bm-muted bm-cell-mono" style={{ fontSize: "0.75rem" }}>
                            {row.channel}
                          </div>
                        </td>
                        <td>{row.enabled_demo ? "On" : "Off"}</td>
                        <td>{row.enabled_live ? "On" : "Off"}</td>
                        <td>
                          <Button size="sm" type="button" variant="outline" onClick={() => setActionRow(row)}>
                            Action
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: "0 1rem 1rem" }}>
                <TablePaginationBar page={page} total={rowsTotal} onPageChange={setPage} />
              </div>
            </>
          )}
        </Card>
      )}

      <Modal
        open={Boolean(actionRow)}
        title={
          actionRow
            ? `Channel flags · ${formatNotificationEventTypeLabel(actionRow.event_type)} / ${formatNotificationChannelLabel(actionRow.channel)}`
            : "Channel flags"
        }
        onClose={() => {
          setActionRow(null);
        }}
      >
        {actionRow && supabase ? (
          <ChannelFlagEditor
            key={actionRow.id}
            row={actionRow}
            supabaseClient={supabase}
            onClose={() => setActionRow(null)}
            onSaved={async () => {
              await qc.invalidateQueries({ queryKey: queryKeys.bookings.notificationChannelSettings() });
            }}
          />
        ) : null}
      </Modal>
    </>
  );
}

function ChannelFlagEditor({
  row,
  supabaseClient,
  onSaved,
  onClose,
}: {
  row: NotificationChannelSettingRow;
  supabaseClient: SupabaseClient<Database>;
  onSaved: () => Promise<void>;
  onClose: () => void;
}) {
  const [demoEnabled, setDemoEnabled] = useState(row.enabled_demo);
  const [liveEnabled, setLiveEnabled] = useState(row.enabled_live);
  const saveMut = useMutation({
    mutationFn: async () =>
      adminUpdateNotificationChannelSetting(supabaseClient, row.id, {
        enabled_demo: demoEnabled,
        enabled_live: liveEnabled,
      }),
    onSuccess: async () => {
      await onSaved();
      onClose();
    },
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
        <Button type="button" size="sm" variant={demoEnabled ? "primary" : "outline"} onClick={() => setDemoEnabled((v) => !v)}>
          Demo {demoEnabled ? "ON" : "OFF"}
        </Button>
        <Button type="button" size="sm" variant={liveEnabled ? "primary" : "outline"} onClick={() => setLiveEnabled((v) => !v)}>
          Live {liveEnabled ? "ON" : "OFF"}
        </Button>
      </div>
      {saveMut.isError ? <p className="dash-empty-error">{(saveMut.error as Error).message}</p> : null}
      <div className="web-modal-actions">
        <Button variant="outline" type="button" disabled={saveMut.isPending} onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" loading={saveMut.isPending} onClick={() => void saveMut.mutateAsync()}>
          Save
        </Button>
      </div>
    </div>
  );
}
