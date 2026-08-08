"""Word table-based architecture diagram builders for generate-architecture-doc.py."""

from __future__ import annotations

from docx import Document
from docx.enum.section import WD_ORIENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt

FILL_ACTOR = "D9EAD3"
FILL_APP = "CFE2F3"
FILL_PKG = "FFF2CC"
FILL_API = "EAD1DC"
FILL_SB = "D0E0E3"
FILL_EXT = "FCE5CD"
FILL_CONN = "F3F3F3"
FILL_NOTE = "EFEFEF"


def shade_cell(cell, fill: str) -> None:
    el = OxmlElement("w:shd")
    el.set(qn("w:fill"), fill)
    cell._tc.get_or_add_tcPr().append(el)


def prevent_row_split(row) -> None:
    row._tr.get_or_add_trPr().append(OxmlElement("w:cantSplit"))


def keep_table_on_one_page(table) -> None:
    for row in table.rows:
        prevent_row_split(row)


def set_cell_padding(cell, top=80, bottom=80, left=100, right=100) -> None:
    tc_pr = cell._tc.get_or_add_tcPr()
    mar = OxmlElement("w:tcMar")
    for side, val in (("top", top), ("bottom", bottom), ("start", left), ("end", right)):
        el = OxmlElement(f"w:{side}")
        el.set(qn("w:w"), str(val))
        el.set(qn("w:type"), "dxa")
        mar.append(el)
    tc_pr.append(mar)


def fill_box_cell(
    cell,
    title: str,
    body: str = "",
    *,
    fill: str = FILL_APP,
    title_size: float = 9,
    body_size: float = 7.5,
    center: bool = True,
) -> None:
    cell.text = ""
    set_cell_padding(cell)
    shade_cell(cell, fill)
    align = WD_ALIGN_PARAGRAPH.CENTER if center else WD_ALIGN_PARAGRAPH.LEFT
    p_title = cell.paragraphs[0]
    p_title.alignment = align
    run = p_title.add_run(title)
    run.bold = True
    run.font.size = Pt(title_size)
    if body:
        p_body = cell.add_paragraph()
        p_body.alignment = align
        run_b = p_body.add_run(body)
        run_b.font.size = Pt(body_size)


def fill_connector_row(cell, text: str) -> None:
    fill_box_cell(cell, text, fill=FILL_CONN, title_size=8, body_size=8)


def start_landscape_diagram_pages(doc: Document) -> None:
    section = doc.add_section()
    section.orientation = WD_ORIENT.LANDSCAPE
    section.page_width, section.page_height = section.page_height, section.page_width
    section.top_margin = Inches(0.45)
    section.bottom_margin = Inches(0.45)
    section.left_margin = Inches(0.5)
    section.right_margin = Inches(0.5)


def end_landscape_diagram_pages(doc: Document) -> None:
    doc.add_page_break()
    section = doc.add_section()
    section.orientation = WD_ORIENT.PORTRAIT
    section.page_width, section.page_height = section.page_height, section.page_width
    section.top_margin = Inches(0.85)
    section.bottom_margin = Inches(0.85)
    section.left_margin = Inches(1)
    section.right_margin = Inches(1)


def begin_diagram_page(
    doc: Document,
    heading: str,
    level: int = 2,
    intro: str = "",
    *,
    page_break: bool = True,
) -> None:
    if page_break:
        doc.add_page_break()
    doc.add_heading(heading, level=level)
    if intro:
        doc.add_paragraph(intro)


def add_layer_a_boxes(doc: Document) -> None:
    begin_diagram_page(
        doc,
        "2.2 Layer A — Users, clients, and shared packages",
        intro="Each box is an independent component. Grey rows show flow direction (top → bottom).",
        page_break=False,
    )
    t = doc.add_table(rows=7, cols=6)
    t.style = "Table Grid"
    actors = [
        ("Homeowner", "Books visits & AMC"),
        ("Technician", "Executes field jobs"),
        ("Vendor", "Manages partner ops"),
        ("Admin", "Platform operations"),
        ("Support", "Desk agent"),
        ("Visitor", "Public web user"),
    ]
    apps = [
        ("customer-app", "Expo 56 · Metro 8081\nBook · AMC · photos · pay"),
        ("technician-app", "Expo 56 · Partner app\nJobs · evidence · GPS"),
        ("vendor-web", "Vite :5174\nBookings · team · payouts"),
        ("admin-web", "Vite :5173\nOps · pricing · finance"),
        ("support-web", "Vite :5175\nInbox · chat dock"),
        ("oorjaman-web", "Next.js :3000\nMarketing · legal"),
    ]
    for i, (title, body) in enumerate(actors):
        fill_box_cell(t.rows[0].cells[i], title, body, fill=FILL_ACTOR)
    fill_connector_row(t.rows[1].cells[0].merge(t.rows[1].cells[5]), "▼  uses mobile / web client  ▼")
    for i, (title, body) in enumerate(apps):
        fill_box_cell(t.rows[2].cells[i], title, body, fill=FILL_APP)
    fill_connector_row(t.rows[3].cells[0].merge(t.rows[3].cells[5]), "▼  shared packages  ▼")
    fill_box_cell(
        t.rows[4].cells[0].merge(t.rows[4].cells[1]),
        "@oorjaman/mobile-deps + ui + mobile-config",
        "Expo/RN shared stack",
        fill=FILL_PKG,
    )
    fill_box_cell(
        t.rows[4].cells[2].merge(t.rows[4].cells[3]),
        "@oorjaman/api",
        "auth · bookings · AMC · payments\nfinance · support · notifications",
        fill=FILL_API,
    )
    fill_box_cell(
        t.rows[4].cells[4].merge(t.rows[4].cells[5]),
        "@oorjaman/portal-deps + web-ui",
        "Vite portal shell",
        fill=FILL_PKG,
    )
    fill_connector_row(
        t.rows[5].cells[0].merge(t.rows[5].cells[5]),
        "▼  supabase-js [JWT] — anon key + user session  ▼",
    )
    fill_box_cell(
        t.rows[6].cells[0].merge(t.rows[6].cells[5]),
        "@oorjaman/config + @oorjaman/utils",
        "Design tokens · IST dates · brand-print",
        fill=FILL_PKG,
    )
    keep_table_on_one_page(t)
    doc.add_paragraph()


def add_layer_b_boxes(doc: Document) -> None:
    begin_diagram_page(
        doc,
        "2.3 Layer B — Supabase platform",
        intro="UAT: dev + Vercel + UAT mobile. Prod: GoDaddy + store apps. Same schema, isolated data.",
    )
    outer = doc.add_table(rows=3, cols=1)
    outer.style = "Table Grid"
    fill_box_cell(
        outer.rows[0].cells[0],
        "SUPABASE — OorjaMan UAT  ||  OorjaMan Prod",
        "",
        fill=FILL_SB,
        title_size=11,
    )
    inner = outer.rows[0].cells[0].add_table(rows=3, cols=2)
    inner.style = "Table Grid"
    blocks = [
        ("AUTH", "OTP → JWT · auth.users → public.users\nRPC sync_my_user_from_auth()"),
        ("POSTGRES + RLS", "bookings · subscriptions · payments\nfinance · catalog · support"),
        ("REALTIME", "bookings · notifications · support\nsettlements · activity feeds"),
        ("STORAGE", "site-photos · job-photos · vendor-docs\nintake · support-attachments"),
        ("EDGE × 5", "intake approve · notifications\noverdue scan · expo-push ×2"),
        ("SCHEDULED", "pg_cron overdue vendor (5 min)\npg_net push outbox (~1 min)"),
    ]
    for idx, (title, body) in enumerate(blocks):
        r, c = divmod(idx, 2)
        fill_box_cell(inner.rows[r].cells[c], title, body, fill="E8F4F8", title_size=8, body_size=7)
    fill_connector_row(outer.rows[1].cells[0], "All six apps read/write here — no direct app-to-app API")
    fill_box_cell(
        outer.rows[2].cells[0],
        "PostgREST + Storage API + Auth API + Realtime websocket",
        "Every client arrow terminates in this layer",
        fill=FILL_NOTE,
        title_size=8,
    )
    keep_table_on_one_page(outer)
    doc.add_paragraph()


def add_layer_c_boxes(doc: Document) -> None:
    begin_diagram_page(
        doc,
        "2.4 Layer C — Cross-app coordination flows",
        intro="Coordination via shared database state — never direct HTTP between clients.",
    )
    flows = [
        ("FLOW 1 — Booking", "customer → bookings → payments → confirmed\n→ notifications → vendor accept\n→ Realtime → technician → settlement"),
        ("FLOW 2 — AMC", "subscriptions → amc_wallets → admin assigns vendor\n→ visit slots → AMC bookings → wallet release"),
        ("FLOW 3 — Vendor intake", "vendor signup [PUB] → intake + storage\n→ admin edge approve → technicians invited"),
        ("FLOW 4 — Support", "mobile ↔ support_messages ↔ support-web\n→ push_outbox → Expo push"),
        ("FLOW 5 — Marketplace", "admin floats → vendor claims → standard flow"),
        ("FLOW 6 — Ops cron", "pg_cron → overdue scan → admin notifications"),
    ]
    t = doc.add_table(rows=2, cols=3)
    t.style = "Table Grid"
    for i, (title, body) in enumerate(flows):
        r, c = divmod(i, 3)
        fill_box_cell(t.rows[r].cells[c], title, body, fill=FILL_APP, title_size=8, body_size=7, center=False)
    keep_table_on_one_page(t)
    doc.add_paragraph()


def add_layer_d_boxes(doc: Document) -> None:
    begin_diagram_page(doc, "2.5 Layer D — External services and hosting")
    services = [
        ("Vercel", "UAT portals\nadmin · vendor · support"),
        ("GoDaddy", "Prod hosts\noorjaman.com + portals"),
        ("EAS / Expo", "Mobile builds\nAPK · IPA · stores"),
        ("Expo Push", "Remote notifications"),
        ("Google Maps", "Customer maps"),
        ("Auth SMS/Email", "Prod OTP"),
    ]
    t = doc.add_table(rows=2, cols=3)
    t.style = "Table Grid"
    for i, (title, body) in enumerate(services):
        r, c = divmod(i, 3)
        fill_box_cell(t.rows[r].cells[c], title, body, fill=FILL_EXT, title_size=8, body_size=7)
    conn = doc.add_table(rows=1, cols=1)
    conn.style = "Table Grid"
    fill_connector_row(conn.rows[0].cells[0], "▼  clients connect to UAT or Prod Supabase  ▼")
    projects = doc.add_table(rows=1, cols=2)
    projects.style = "Table Grid"
    fill_box_cell(projects.rows[0].cells[0], "OorjaMan UAT", "Dev · Vercel · UAT mobile", fill=FILL_SB)
    fill_box_cell(projects.rows[0].cells[1], "OorjaMan Prod", "GoDaddy · stores", fill=FILL_SB)
    keep_table_on_one_page(t)
    keep_table_on_one_page(conn)
    keep_table_on_one_page(projects)
    doc.add_paragraph()


def add_complete_system_interaction_map_boxes(doc: Document) -> None:
    begin_diagram_page(
        doc,
        "2.6 Master diagram — Complete system interaction map",
        intro="Every system as an individual bordered box. Read top → bottom. Kept on one landscape page.",
    )
    t = doc.add_table(rows=11, cols=6)
    t.style = "Table Grid"

    actor_data = [
        ("Homeowner", "Customer"),
        ("Technician", "Field partner"),
        ("Vendor", "Partner org"),
        ("Admin", "Platform ops"),
        ("Support", "Desk"),
        ("Visitor", "Public web"),
    ]
    app_data = [
        ("customer-app", "Mobile · book · AMC"),
        ("technician-app", "Mobile · jobs · GPS"),
        ("vendor-web", "Portal · payouts"),
        ("admin-web", "Portal · ops"),
        ("support-web", "Portal · chat"),
        ("oorjaman-web", "Marketing [PUB]"),
    ]
    ext_data = [
        ("Vercel / GoDaddy", "Web hosting"),
        ("EAS + Stores", "Mobile binaries"),
        ("Expo Push", "APNs / FCM"),
        ("Google Maps", "Customer maps"),
        ("Auth SMS", "Prod OTP"),
        ("Email", "Notifications"),
    ]

    for i, (a, b) in enumerate(actor_data):
        fill_box_cell(t.rows[0].cells[i], a, b, fill=FILL_ACTOR, title_size=8, body_size=7)
    fill_connector_row(t.rows[1].cells[0].merge(t.rows[1].cells[5]), "▼")
    for i, (a, b) in enumerate(app_data):
        fill_box_cell(t.rows[2].cells[i], a, b, fill=FILL_APP, title_size=8, body_size=7)
    fill_connector_row(
        t.rows[3].cells[0].merge(t.rows[3].cells[5]),
        "▼  @oorjaman/ui · mobile-config · web-ui · portal-deps  ▼",
    )
    fill_box_cell(
        t.rows[4].cells[0].merge(t.rows[4].cells[5]),
        "@oorjaman/api",
        "bookings · subscriptions · payments · AMC · vendors · support · notifications",
        fill=FILL_API,
        title_size=10,
        body_size=7.5,
    )
    fill_connector_row(t.rows[5].cells[0].merge(t.rows[5].cells[5]), "▼  supabase-js [JWT]  ▼")

    sb_cell = t.rows[6].cells[0].merge(t.rows[6].cells[5])
    fill_box_cell(sb_cell, "SUPABASE (UAT || PROD)", "", fill=FILL_SB, title_size=11)
    sb = sb_cell.add_table(rows=2, cols=3)
    sb.style = "Table Grid"
    sb_parts = [
        ("Auth + users", "OTP · JWT · roles"),
        ("Postgres + RLS", "all business tables"),
        ("Realtime", "live sync"),
        ("Storage", "photos · docs"),
        ("Edge × 5", "push · cron · intake"),
        ("pg_cron / pg_net", "scheduled jobs"),
    ]
    for i, (title, body) in enumerate(sb_parts):
        r, c = divmod(i, 3)
        fill_box_cell(sb.rows[r].cells[c], title, body, fill="E8F4F8", title_size=7.5, body_size=6.5)

    fill_connector_row(t.rows[7].cells[0].merge(t.rows[7].cells[5]), "▼  external cloud  ▼")
    for i, (a, b) in enumerate(ext_data):
        fill_box_cell(t.rows[8].cells[i], a, b, fill=FILL_EXT, title_size=7.5, body_size=6.5)
    fill_box_cell(
        t.rows[9].cells[0].merge(t.rows[9].cells[2]),
        "OorjaMan UAT Supabase",
        "Dev · Vercel · UAT APK",
        fill=FILL_SB,
        title_size=8,
    )
    fill_box_cell(
        t.rows[9].cells[3].merge(t.rows[9].cells[5]),
        "OorjaMan Prod Supabase",
        "GoDaddy · App Store · Play",
        fill=FILL_SB,
        title_size=8,
    )
    fill_box_cell(
        t.rows[10].cells[0].merge(t.rows[10].cells[5]),
        "KEY: Apps NEVER call each other directly",
        "Shared Postgres + Realtime + notification_events + edge functions coordinate all workflows.",
        fill=FILL_NOTE,
        title_size=8,
        body_size=7.5,
    )
    keep_table_on_one_page(t)
    doc.add_paragraph()


def render_master_diagram_section(doc: Document, add_table_fn) -> None:
    """Section 2 — legend, box diagrams, interaction catalog."""
    doc.add_heading("2. Master system architecture diagram (full detail)", level=1)
    doc.add_paragraph(
        "Diagrams 2.2–2.6 use bordered Word boxes (one component per box), each on its own "
        "landscape page with row-split prevention so diagrams stay on a single sheet."
    )

    doc.add_heading("2.1 Legend", level=2)
    add_table_fn(
        doc,
        ["Symbol", "Meaning"],
        [
            ["──►", "Synchronous request/response (HTTPS, supabase-js, REST)"],
            ["⇢⇢⇢", "Async / queued (notification_events, push outbox, cron)"],
            ["◄──►", "Bidirectional Realtime (postgres_changes)"],
            ["[JWT]", "Authenticated Supabase user session"],
            ["[SRV]", "service_role or dispatch secret (server-only)"],
            ["[PUB]", "Public / unauthenticated access"],
            ["Coloured box", "Independent deployable or logical component"],
            ["Grey connector row", "Flow direction (top → bottom)"],
        ],
    )

    start_landscape_diagram_pages(doc)
    add_layer_a_boxes(doc)
    add_layer_b_boxes(doc)
    add_layer_c_boxes(doc)
    add_layer_d_boxes(doc)
    add_complete_system_interaction_map_boxes(doc)
    end_landscape_diagram_pages(doc)

    doc.add_heading("2.7 Interaction catalog (every major connection)", level=2)
    add_table_fn(
        doc,
        ["From", "To", "Mechanism", "Purpose"],
        [
            ["customer-app", "bookings, payments, subscriptions", "PostgREST [JWT]", "Book visits, pay, subscribe AMC"],
            ["customer-app", "customer-site-photos bucket", "Storage API [JWT]", "Upload rooftop/site images"],
            ["customer-app", "bookings, subscriptions", "Realtime ◄──►", "Live job status + AMC partner assignment"],
            ["customer-app", "support_messages", "Realtime ◄──►", "Support chat threads"],
            ["customer-app", "customer_push_outbox", "DB trigger → edge [SRV]", "Remote push when support replies"],
            ["technician-app", "bookings, job_reports", "PostgREST [JWT]", "Execute visits, upload evidence"],
            ["technician-app", "job-photos bucket", "Storage API [JWT]", "Visit photo evidence"],
            ["technician-app", "technician_locations", "PostgREST [JWT]", "GPS trail during active job"],
            ["technician-app", "bookings", "Realtime ◄──►", "New assignments + status changes"],
            ["technician-app", "technician_push_outbox", "DB trigger → edge [SRV]", "Remote support push"],
            ["vendor-web", "bookings, vendor_settlements", "PostgREST [JWT]", "Accept jobs, view payouts"],
            ["vendor-web", "bookings, vendor_settlements", "Realtime ◄──►", "Live booking queue + settlements"],
            ["vendor-web", "notification_events", "Realtime ◄──►", "In-app vendor notification bell"],
            ["vendor-web", "vendor_registration_intake", "PostgREST [PUB/JWT]", "Partner signup wizard"],
            ["vendor-web", "vendor-intake bucket", "Storage [PUB]", "Signup document uploads"],
            ["admin-web", "All ops tables + views", "PostgREST [JWT]", "Full platform operations"],
            ["admin-web", "notification_events", "Realtime ◄──►", "Admin notification bell"],
            ["admin-web", "approve-vendor-intake", "Edge Function [JWT]", "Approve partner signup"],
            ["admin-web", "process-notification-events", "Edge Function [JWT]", "Drain notification queue"],
            ["support-web", "support_* tables", "PostgREST [JWT]", "Desk inbox, macros, insights"],
            ["support-web", "support_messages", "Realtime ◄──►", "Live chat with mobile users"],
            ["oorjaman-web", "—", "Static HTML", "Marketing; portal/legal links"],
            ["All apps", "auth.users / public.users", "Supabase Auth [JWT]", "OTP login, session, role"],
            ["pg_cron", "scan-vendor-response-overdue", "HTTP [SRV]", "1h vendor accept window"],
            ["pg_cron/pg_net", "send-*-expo-push", "HTTP [SRV]", "Drain mobile push outboxes"],
            ["EAS build", "customer/technician-app", "Native binary", "UAT APK / store IPAs"],
            ["Vercel", "admin/vendor/support-web", "HTTPS CDN", "Host UAT portal SPAs"],
        ],
    )
    doc.add_page_break()
