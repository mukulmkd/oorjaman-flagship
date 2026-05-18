import { useMemo, useState } from "react";
import { type UseMutationResult, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminListNotificationTemplates,
  adminPreviewNotificationTemplate,
  adminProcessNotificationQueue,
  adminUpdateNotificationTemplate,
  queryKeys,
  type NotificationTemplateRow,
  type Database,
} from "@oorjaman/api";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Badge, Button, Card, Input, Modal, PageHeader, TextArea } from "@oorjaman/web-ui";
import { useSupabase } from "../lib/supabase-context";
import { TablePaginationBar } from "../components/TablePaginationBar";
import { formatNotificationChannelLabel, formatNotificationEventTypeLabel } from "../lib/notification-labels";
import "../layouts/dashboard-layout.css";

const TPL_PAGE_SIZE = 10;

export function NotificationTemplatesPage() {
  const supabase = useSupabase();
  const qc = useQueryClient();
  const [editTemplate, setEditTemplate] = useState<NotificationTemplateRow | null>(null);
  const [tplPage, setTplPage] = useState(1);
  const [previewContextJson, setPreviewContextJson] = useState(
    '{"reference_code":"OM-1A2B3C4D","vendor_name":"Acme Solar","booking_id":"0000-1111"}',
  );
  const [previewText, setPreviewText] = useState<string>("");

  const templatesQuery = useQuery({
    queryKey: queryKeys.bookings.notificationTemplates(),
    queryFn: () => adminListNotificationTemplates(supabase!),
    enabled: Boolean(supabase),
  });

  const flatSorted = useMemo(() => {
    const list = [...(templatesQuery.data ?? [])];
    list.sort((a, b) => {
      const e = a.event_type.localeCompare(b.event_type);
      if (e !== 0) return e;
      return a.channel.localeCompare(b.channel);
    });
    return list;
  }, [templatesQuery.data]);

  const tplTotal = flatSorted.length;
  const tplRows = flatSorted.slice((tplPage - 1) * TPL_PAGE_SIZE, tplPage * TPL_PAGE_SIZE);

  const previewMut = useMutation({
    mutationFn: async () => {
      if (!supabase || !editTemplate) throw new Error("Open a template with Action → Edit to preview.");
      let parsed: Record<string, string | number | boolean | null | undefined> = {};
      try {
        parsed = JSON.parse(previewContextJson) as Record<string, string | number | boolean | null | undefined>;
      } catch {
        throw new Error("Context JSON is invalid.");
      }
      return adminPreviewNotificationTemplate(supabase, editTemplate.id, parsed);
    },
    onSuccess: (data) => {
      setPreviewText(`${data.subject ? `Subject: ${data.subject}\n\n` : ""}${data.body}`);
    },
  });
  const processMut = useMutation({
    mutationFn: () => adminProcessNotificationQueue(supabase!, { limit: 30 }),
  });

  return (
    <>
      <PageHeader
        title="Notification templates"
        subtitle="Edit copy per channel. Delivery toggles are under Feature management in the sidebar."
        actions={
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <Button
              variant="outline"
              size="sm"
              type="button"
              loading={processMut.isPending}
              onClick={() => void processMut.mutateAsync()}
            >
              Dry-run send
            </Button>
            <Button variant="outline" size="sm" type="button" onClick={() => void templatesQuery.refetch()}>
              Refresh
            </Button>
          </div>
        }
      />

      {!supabase ? (
        <Card padded>
          <p className="dash-muted-line">Connect Supabase via Vite env variables.</p>
        </Card>
      ) : templatesQuery.isLoading ? (
        <Card padded>
          <p className="dash-table-empty">Loading templates…</p>
        </Card>
      ) : templatesQuery.isError ? (
        <Card padded>
          <p className="dash-empty-title">Couldn&apos;t load templates</p>
          <p className="dash-empty-error">{(templatesQuery.error as Error).message}</p>
        </Card>
      ) : (
        <div className="bm-stack">
          <Card padded={false}>
            {tplTotal === 0 ? (
              <p className="bm-empty">No templates.</p>
            ) : (
              <>
                <div className="bm-table-wrap">
                  <table className="bm-table">
                    <thead>
                      <tr>
                        <th>Event</th>
                        <th>Channel</th>
                        <th>Template key</th>
                        <th>Active</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tplRows.map((row) => (
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
                          <td className="bm-cell-mono">{row.template_key}</td>
                          <td>
                            <Badge tone={row.is_active ? "success" : "neutral"}>{row.is_active ? "Yes" : "No"}</Badge>
                          </td>
                          <td>
                            <Button size="sm" type="button" variant="outline" onClick={() => setEditTemplate(row)}>
                              Action
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ padding: "0.75rem 1rem" }}>
                  <TablePaginationBar page={tplPage} pageSize={TPL_PAGE_SIZE} total={tplTotal} onPageChange={setTplPage} />
                </div>
              </>
            )}
          </Card>

          <Modal
            open={Boolean(editTemplate)}
            title={
              editTemplate
                ? `Template · ${formatNotificationEventTypeLabel(editTemplate.event_type)} / ${formatNotificationChannelLabel(editTemplate.channel)}`
                : "Template"
            }
            onClose={() => setEditTemplate(null)}
          >
            {editTemplate && supabase ? (
              <TemplateEditor
                key={editTemplate.id}
                row={editTemplate}
                supabaseClient={supabase}
                previewContextJson={previewContextJson}
                setPreviewContextJson={setPreviewContextJson}
                previewText={previewText}
                previewMut={previewMut}
                processMut={processMut}
                onClose={() => setEditTemplate(null)}
                onSaved={async () => {
                  await qc.invalidateQueries({ queryKey: queryKeys.bookings.notificationTemplates() });
                }}
              />
            ) : null}
          </Modal>
        </div>
      )}
    </>
  );
}

function TemplateEditor({
  row,
  supabaseClient,
  previewContextJson,
  setPreviewContextJson,
  previewText,
  previewMut,
  processMut,
  onSaved,
  onClose,
}: {
  row: NotificationTemplateRow;
  supabaseClient: SupabaseClient<Database>;
  previewContextJson: string;
  setPreviewContextJson: (v: string) => void;
  previewText: string;
  previewMut: UseMutationResult<
    Awaited<ReturnType<typeof adminPreviewNotificationTemplate>>,
    Error,
    void,
    unknown
  >;
  processMut: UseMutationResult<
    Awaited<ReturnType<typeof adminProcessNotificationQueue>>,
    Error,
    void,
    unknown
  >;
  onSaved: () => Promise<void>;
  onClose: () => void;
}) {
  const [subject, setSubject] = useState(row.subject ?? "");
  const [body, setBody] = useState(row.body);
  const [isActive, setIsActive] = useState(row.is_active);
  const saveMut = useMutation({
    mutationFn: async () => {
      return adminUpdateNotificationTemplate(supabaseClient, row.id, {
        subject: subject.trim() ? subject.trim() : null,
        body: body.trim(),
        is_active: isActive,
      });
    },
    onSuccess: () => void onSaved(),
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <p className="bm-cell-mono" style={{ margin: 0, fontSize: "var(--type-sm)", color: "var(--wb-muted-fg)" }}>
        {row.template_key}
      </p>
      <Input label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
      <TextArea label="Body" value={body} onChange={(e) => setBody(e.target.value)} rows={6} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
        <Button
          type="button"
          size="sm"
          variant={isActive ? "outline" : "primary"}
          onClick={() => setIsActive((v) => !v)}
        >
          {isActive ? "Disable template" : "Enable template"}
        </Button>
        <Button type="button" size="sm" loading={saveMut.isPending} onClick={() => void saveMut.mutateAsync()}>
          Save template
        </Button>
      </div>
      {saveMut.isError ? <p className="dash-empty-error">{(saveMut.error as Error).message}</p> : null}

      <TextArea label="Preview context JSON" value={previewContextJson} onChange={(e) => setPreviewContextJson(e.target.value)} rows={4} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
        <Button
          type="button"
          size="sm"
          variant="outline"
          loading={previewMut.isPending}
          onClick={() => void previewMut.mutateAsync()}
        >
          Preview this template
        </Button>
      </div>
      {previewMut.isError ? <p className="dash-empty-error">{(previewMut.error as Error).message}</p> : null}
      {processMut.isSuccess ? (
        <p className="dash-muted-line" style={{ margin: 0 }}>
          Demo queue processed: {processMut.data.sent} sent, {processMut.data.failed} failed.
        </p>
      ) : null}
      <TextArea label="Rendered output" value={previewText} onChange={() => undefined} rows={6} />

      <div className="web-modal-actions">
        <Button variant="outline" type="button" disabled={saveMut.isPending || previewMut.isPending} onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}
