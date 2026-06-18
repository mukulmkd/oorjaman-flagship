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
import { useSupabase } from "@oorjaman/web-ui";
import { TablePaginationBar } from "@oorjaman/web-ui";
import { Link } from "react-router-dom";
import { formatNotificationChannelLabel, formatNotificationEventTypeLabel } from "../lib/notification-labels";
import "./notification-templates-page.css";

const TPL_PAGE_SIZE = 10;

export function NotificationTemplatesPage() {
  const supabase = useSupabase();
  const qc = useQueryClient();
  const [editTemplate, setEditTemplate] = useState<NotificationTemplateRow | null>(null);
  const [tplPage, setTplPage] = useState(1);
  const [previewContextJson, setPreviewContextJson] = useState(
    JSON.stringify(
      {
        reference_code: "OM-1A2B3C4D",
        customer_name: "Priya",
        plan_name: "Annual Solar Care AMC",
        ends_at: "15 Jun 2026",
        days_to_expiry: 7,
        renewal_audience: "expiring_soon",
        renewal_intro:
          "Your Annual Solar Care AMC plan with OorjaMan reaches an important date on 15 Jun 2026 (in 7 days). Renewing on time avoids any gap in scheduled care.",
        renewal_cta: "Renew in the OorjaMan app when convenient; our team is here if you have questions.",
        rating: 2,
        feedback: "Technician arrived later than the slot we chose.",
      },
      null,
      2,
    ),
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
      let parsed: Record<string, string | number | boolean | null | undefined>;
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
        subtitle="Edit copy per channel. Delivery toggles live under Feature management."
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
        <div className="nt-root">
          <Card padded>
            <NotificationCopyGuideCard />
          </Card>

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

function NotificationCopyGuideCard() {
  return (
    <div className="nt-copy-guide">
      <div className="nt-copy-guide-head">
        <div>
          <p className="nt-copy-guide-title">OorjaMan copy guide</p>
          <p className="nt-copy-guide-lead">
            Every notification should feel like it comes from a caring solar-care team - not a generic alert.
            Use <code>{"{{variable}}"}</code> placeholders; the system fills them from each event&apos;s payload.{" "}
            <Link to="/dashboard/feature-management">Feature management</Link> controls which channels send (demo vs
            live).
          </p>
        </div>
      </div>

      <div className="nt-copy-grid">
        <section className="nt-copy-block" aria-labelledby="nt-guide-do">
          <h3 id="nt-guide-do" className="nt-copy-block-title">
            Do
          </h3>
          <ul className="nt-copy-list">
            <li>
              <strong>Lead with value</strong> - what happens next, how it helps their home or panels, or what we&apos;re
              doing for them.
            </li>
            <li>
              <strong>Sound human</strong> - &quot;Namaste&quot;, &quot;thank you&quot;, &quot;we&apos;re grateful&quot; where it fits; sign emails
              &quot;- Team OorjaMan&quot;.
            </li>
            <li>
              <strong>Be humble on hard news</strong> - declines, low ratings, lapses: acknowledge feelings, offer a
              clear next step.
            </li>
            <li>
              <strong>Name the brand once</strong> - &quot;OorjaMan&quot; in subject or first line; avoid repeating it every
              sentence.
            </li>
            <li>
              <strong>Give an out</strong> - &quot;If you&apos;ve already renewed, thank you - no action needed&quot; reduces noise and
              builds trust.
            </li>
          </ul>
        </section>

        <section className="nt-copy-block" aria-labelledby="nt-guide-avoid">
          <h3 id="nt-guide-avoid" className="nt-copy-block-title">
            Avoid
          </h3>
          <ul className="nt-copy-list nt-copy-list--avoid">
            <li>All-caps shouting, &quot;URGENT!!!&quot;, or blame (&quot;You failed to renew&quot;).</li>
            <li>Empty alerts (&quot;Booking updated&quot;) with no context or reference.</li>
            <li>Internal jargon (RLS, queue, marketplace float) in customer-facing copy.</li>
            <li>Over-promising (&quot;guaranteed same-day&quot;) unless ops has committed to it.</li>
            <li>Long SMS - keep under ~160 characters when possible; put warmth in WhatsApp or email.</li>
          </ul>
        </section>

        <section className="nt-copy-block" aria-labelledby="nt-guide-channels">
          <h3 id="nt-guide-channels" className="nt-copy-block-title">
            By channel
          </h3>
          <ul className="nt-copy-list">
            <li>
              <strong>Email</strong> - warmest; short paragraphs; subject personalises with name or plan.
            </li>
            <li>
              <strong>SMS</strong> - one idea + action; start with &quot;OorjaMan:&quot; for recognition.
            </li>
            <li>
              <strong>WhatsApp</strong> - conversational; still respectful; OK to use customer first name.
            </li>
            <li>
              <strong>In-app</strong> - title + body in the event payload from API; DB templates are fallbacks for some
              flows.
            </li>
          </ul>
          <div className="nt-channel-hints" aria-hidden>
            <span className="nt-channel-hint">email · fuller</span>
            <span className="nt-channel-hint">sms · brief</span>
            <span className="nt-channel-hint">whatsapp · friendly</span>
          </div>
        </section>

        <div className="nt-var-table-wrap">
          <section className="nt-copy-block" style={{ padding: 0, overflow: "hidden" }} aria-labelledby="nt-guide-vars">
            <h3 id="nt-guide-vars" className="nt-copy-block-title" style={{ padding: "0.75rem 0.85rem 0", margin: 0 }}>
              Common variables
            </h3>
            <table className="nt-var-table">
              <thead>
                <tr>
                  <th>Placeholder</th>
                  <th>Used for</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <code>{"{{reference_code}}"}</code>
                  </td>
                  <td>Bookings, marketplace, low-rating follow-ups</td>
                </tr>
                <tr>
                  <td>
                    <code>{"{{customer_name}}"}</code>, <code>{"{{plan_name}}"}</code>, <code>{"{{ends_at}}"}</code>
                  </td>
                  <td>AMC renewal reminders</td>
                </tr>
                <tr>
                  <td>
                    <code>{"{{renewal_intro}}"}</code>, <code>{"{{renewal_cta}}"}</code>
                  </td>
                  <td>Pre-written expiring vs lapsed lines (set in API when queued)</td>
                </tr>
                <tr>
                  <td>
                    <code>{"{{rating}}"}</code>, <code>{"{{feedback}}"}</code>
                  </td>
                  <td>Low-score follow-up to ops</td>
                </tr>
              </tbody>
            </table>
          </section>
        </div>
      </div>
    </div>
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
      <p className="nt-editor-hint">
        OorjaMan voice: lead with value, stay humble on bad news, use <code>{"{{placeholders}}"}</code>. See the copy
        guide on this page for do&apos;s, don&apos;ts, and variables. Preview JSON must match keys in your body.
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
