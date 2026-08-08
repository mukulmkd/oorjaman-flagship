#!/usr/bin/env python3
"""
Generate OorjaMan end-to-end project costing (Word) in project-docs/.

Run: .venv-docgen/bin/python scripts/generate-costing-doc.py
     or: npm run docs:costing

Prices are approximate USD as of mid-2026. Always verify on vendor pricing pages
before purchasing. INR notes are approximate at ~₹85 / USD for planning only.
"""

from __future__ import annotations

from datetime import date
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor

REPO_ROOT = Path(__file__).resolve().parents[1]
OUTPUT = REPO_ROOT / "project-docs" / "OorjaMan-Costing.docx"

# Approx fx for illustrative INR columns (update when reviewing)
INR_PER_USD = 85


def inr(usd: float | int) -> str:
    return f"≈ ₹{int(round(float(usd) * INR_PER_USD)):,}"


def shade_cell(cell, fill: str = "E8F0FE") -> None:
    el = OxmlElement("w:shd")
    el.set(qn("w:fill"), fill)
    cell._tc.get_or_add_tcPr().append(el)


def add_table(doc: Document, headers: list[str], rows: list[list[str]], header_fill: str = "E8F0FE") -> None:
    table = doc.add_table(rows=1 + len(rows), cols=len(headers))
    table.style = "Table Grid"
    for i, h in enumerate(headers):
        table.rows[0].cells[i].text = h
        shade_cell(table.rows[0].cells[i], header_fill)
    for r, row in enumerate(rows):
        for c, val in enumerate(row):
            table.rows[r + 1].cells[c].text = val
    doc.add_paragraph()


def add_bullets(doc: Document, items: list[str]) -> None:
    for item in items:
        doc.add_paragraph(item, style="List Bullet")


def setup_document() -> Document:
    doc = Document()
    sec = doc.sections[0]
    sec.top_margin = Inches(0.85)
    sec.bottom_margin = Inches(0.85)
    sec.left_margin = Inches(1)
    sec.right_margin = Inches(1)
    return doc


def add_cover(doc: Document) -> None:
    t = doc.add_paragraph()
    t.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = t.add_run("OorjaMan Flagship\nEnd-to-End Project Costing")
    run.bold = True
    run.font.size = Pt(26)

    sub = doc.add_paragraph()
    sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    sub.add_run(
        f"All third-party & platform costs · Supabase scale-up · {date.today().strftime('%d %B %Y')}"
    )

    doc.add_paragraph()
    doc.add_paragraph(
        "This document lists every paid (or soon-to-be-paid) service used to build, host, "
        "distribute, and operate OorjaMan — mobile apps, web portals, marketing site, "
        "Supabase backend, maps, OTP/SMS, stores, and CI. It includes Supabase plan "
        "comparison and scale-up scenarios for production growth."
    )
    p = doc.add_paragraph()
    run = p.add_run("Important: ")
    run.bold = True
    p.add_run(
        "Figures are planning estimates in USD (with approximate INR at "
        f"₹{INR_PER_USD}/USD). Vendor list prices change; confirm on each provider’s "
        "pricing page before committing budget. Taxes (GST/VAT), FX fees, and promotions "
        "are not included."
    )
    doc.add_page_break()


def add_toc(doc: Document) -> None:
    doc.add_heading("Table of contents", level=1)
    add_bullets(
        doc,
        [
            "1. Executive cost summary",
            "2. What we pay for today vs later",
            "3. Supabase — plans, meters, and scale-up",
            "4. Hosting — Vercel & GoDaddy",
            "5. Mobile — Expo EAS, Apple, Google Play",
            "6. Auth OTP / SMS & messaging",
            "7. Google Maps Platform",
            "8. Payments gateway (future)",
            "9. Domains, email & misc ops",
            "10. One-time setup costs",
            "11. Monthly run-rate by phase (scenarios)",
            "12. Annual budget roll-up",
            "13. Cost drivers & optimisation tips",
            "14. Appendix — env vars & source links",
        ],
    )
    doc.add_page_break()


def add_executive(doc: Document) -> None:
    doc.add_heading("1. Executive cost summary", level=1)
    doc.add_paragraph(
        "OorjaMan is a Supabase-centric product. Backend costs grow with MAUs, database size, "
        "egress, storage photos, Edge Function invocations, and Realtime. Client hosting "
        "(Vercel/GoDaddy) and store accounts are comparatively fixed; mobile cloud builds "
        "(EAS) and SMS/OTP are usage-sensitive."
    )
    add_table(
        doc,
        ["Phase", "USD / month (approx)", "INR / month (approx)", "What it covers"],
        [
            [
                "Today — UAT / internal QA",
                "$0 – $30",
                inr(0) + " – " + inr(30),
                "Supabase Free/UAT, Vercel Hobby, free EAS, dummy auth, optional Maps",
            ],
            [
                "Launch — Prod soft live",
                "$80 – $200",
                inr(80) + " – " + inr(200),
                "Supabase Pro (×1–2 projects), Domain/hosting, Apple annual prorate, EAS Starter, light SMS",
            ],
            [
                "Scale — growth",
                "$250 – $800+",
                inr(250) + " – " + inr(800) + "+",
                "Larger Supabase compute + overages, EAS Production, OTP volume, Maps, payment fees",
            ],
            [
                "Compliance / enterprise",
                "$600 – custom",
                inr(600) + "+",
                "Supabase Team ($599) or Enterprise; dedicated support/SLAs",
            ],
        ],
        header_fill="D9EAD3",
    )
    doc.add_paragraph(
        "Two Supabase projects (UAT + Prod) means two compute bills when both are on Pro. "
        "See Section 3 for detailed meters."
    )


def add_today_vs_later(doc: Document) -> None:
    doc.add_heading("2. What we pay for today vs later", level=1)
    add_table(
        doc,
        ["Service", "Status now", "Billed today?", "When cost starts"],
        [
            ["Supabase UAT", "Active", "Usually Free tier", "Upgrade to Pro before prod-like load or to avoid pause"],
            ["Supabase Prod", "Planned", "No", "Create project + Pro (recommended) at GoDaddy/store launch"],
            ["Vercel (3 portals)", "Active UAT", "Hobby / free typical", "Pro if team/limits needed; or move to GoDaddy"],
            ["GoDaddy web", "Planned", "Domain + hosting when bought", "Marketing + prod portal hosts"],
            ["Expo EAS", "UAT builds", "Free tier often enough", "Starter/Production when build volume grows"],
            ["Apple Developer", "Not started", "No", "$99/yr before TestFlight/App Store"],
            ["Google Play", "Not started", "No", "$25 one-time before Play Store"],
            ["Google Maps", "Optional", "No until key enabled", "When customer-app native maps ship"],
            ["Auth SMS (Twilio etc.)", "Dummy auth on UAT", "No", "When real phone OTP enabled in prod"],
            ["Payment gateway", "Dummy payments", "No", "When Razorpay/Stripe (or similar) integrated"],
            ["Business email / DNS", "Varies", "Per provider", "Anytime for ops@ / support@ mailboxes"],
        ],
    )


def add_supabase(doc: Document) -> None:
    doc.add_heading("3. Supabase — plans, meters, and scale-up", level=1)
    doc.add_paragraph(
        "Source of truth for live numbers: https://supabase.com/pricing and "
        "https://supabase.com/docs/guides/platform/billing-on-supabase. "
        "OorjaMan uses Auth, Postgres + RLS, Realtime, Storage, Edge Functions, and "
        "(optionally) cron/pg_net. Quotas below are organisation-shared for many meters; "
        "database disk and compute are per project."
    )

    doc.add_heading("3.1 Plan comparison", level=2)
    add_table(
        doc,
        ["Plan", "Base / month", "Best for OorjaMan", "Key limits included"],
        [
            [
                "Free",
                "$0",
                "UAT / prototyping only",
                "2 active projects, 500 MB DB/project, 50k MAU, 5 GB egress, 1 GB file storage, "
                "500k Edge invocations, 200 Realtime peak connections — projects pause after ~1 week idle",
            ],
            [
                "Pro",
                "$25 / org",
                "Production (recommended at launch)",
                "100k MAU, 8 GB disk/project, 250 GB egress, 100 GB file storage, "
                "2M Edge invocations, 5M Realtime messages, 500 peak connections; "
                "~$10 compute credit (covers 1 Micro instance); daily backups (7 days)",
            ],
            [
                "Team",
                "$599 / org",
                "SOC2 / SSO / priority support",
                "Same usage model as Pro + compliance & team features",
            ],
            [
                "Enterprise",
                "Custom",
                "High traffic / custom SLA",
                "Negotiated quotas, dedicated support",
            ],
        ],
        header_fill="D0E0E3",
    )

    doc.add_heading("3.2 Usage meters & overage rates (Pro / Team)", level=2)
    add_table(
        doc,
        ["Meter", "Included (Pro/Team)", "Overage (approx)", "OorjaMan impact"],
        [
            ["Monthly Active Users (Auth)", "100,000", "$0.00325 / MAU", "Customers + partners + vendors + admins who log in"],
            ["Database disk (per project)", "8 GB", "$0.125 / GB-mo", "bookings, photos metadata, notifications, support chat"],
            ["Egress (uncached)", "250 GB", "$0.09 / GB", "API + Realtime + Storage downloads"],
            ["Cached egress", "250 GB", "$0.03 / GB", "CDN / Smart CDN storage traffic"],
            ["File storage", "100 GB", "$0.0213 / GB-mo", "site photos, job-photos, vendor docs, support attachments"],
            ["Edge Function invocations", "2 million", "$2 / million", "push drain, notification queue, vendor intake, overdue scan"],
            ["Realtime messages", "5 million", "$2.50 / million", "booking live updates, chat, notification bells"],
            ["Realtime peak connections", "500", "$10 / 1,000", "Concurrent open apps/browsers"],
            ["Image transforms (optional)", "100 origins", "$5 / 1,000", "Only if we enable Storage image transforms"],
            ["Extra compute (Small+)", "Credit ≈ Micro", "From ~$15–$60+/mo/instance", "CPU for heavier queries & concurrent jobs"],
            ["PITR / log drains (optional)", "—", "e.g. ~$100/mo PITR tier; ~$60/drain", "Stronger disaster recovery / observability"],
        ],
        header_fill="D0E0E3",
    )

    doc.add_heading("3.3 Two-project model (UAT + Prod)", level=2)
    add_bullets(
        doc,
        [
            "Today: one UAT project serves local, Vercel portals, and UAT mobile.",
            "Target: separate Prod project — same migrations, isolated data (see SUPABASE-UAT-PROD.md).",
            "If both are on Pro under one org: base subscription is per organisation ($25), "
            "but each project’s Micro compute after free credit and disk usage are billed separately.",
            "Practical launch budget: keep UAT on Free (accept pause risk) OR Pro; Prod always on Pro minimum.",
            "Rough dual-project Pro baseline: ~$25 org + ~$10 second Micro (after one credit used) ≈ $35–$50 / month before overages.",
        ],
    )

    doc.add_heading("3.4 Scale-up scenarios (production project)", level=2)
    doc.add_paragraph(
        "Illustrative monthly Supabase spend for the Prod project only. Assumes Pro org base "
        "allocated to Prod; overages as listed. Not a quote — for planning conversations."
    )
    add_table(
        doc,
        ["Stage", "Approx users / activity", "Example usage assumptions", "Est. USD / mo", "Est. INR / mo"],
        [
            [
                "S0 Soft launch",
                "< 5k MAU",
                "Micro compute, <8 GB DB, <50 GB egress, <20 GB photos",
                "$25 – $40",
                inr(25) + " – " + inr(40),
            ],
            [
                "S1 City launch",
                "10–30k MAU",
                "Micro/Small compute, 8–15 GB DB, 100–200 GB egress, 40–80 GB storage",
                "$40 – $90",
                inr(40) + " – " + inr(90),
            ],
            [
                "S2 Multi-city",
                "50–100k MAU",
                "Small compute, 15–30 GB DB, near MAU included limit, 250–400 GB egress, "
                "100–150 GB photos, Edge + Realtime near included",
                "$90 – $200",
                inr(90) + " – " + inr(200),
            ],
            [
                "S3 Growth",
                "150–300k MAU",
                "MAU overage (e.g. 200k → ~$325 overage), larger disk, egress overages, "
                "Medium compute, heavy Realtime (job tracking + chat)",
                "$400 – $900+",
                inr(400) + " – " + inr(900) + "+",
            ],
            [
                "S4 Enterprise ops",
                "500k+ / compliance",
                "Team plan or Enterprise, dedicated compute, PITR, log drains, negotiated egress",
                "$600 – custom",
                inr(600) + "+",
            ],
        ],
        header_fill="D0E0E3",
    )

    doc.add_heading("3.5 Worked MAU overage example", level=2)
    add_bullets(
        doc,
        [
            "Included on Pro: 100,000 MAU.",
            "At 200,000 MAU: overage = 100,000 × $0.00325 = $325 / month on Auth alone.",
            "Add compute upgrade + photo storage growth + egress for map/photo downloads "
            "to estimate total backend bill.",
        ],
    )

    doc.add_heading("3.6 OorjaMan-specific cost drivers on Supabase", level=2)
    add_table(
        doc,
        ["Feature area", "What grows cost", "Mitigation"],
        [
            ["Customer site photos + job photos", "Storage GB + egress downloads", "Compress images; prefer signed URLs; avoid public listing"],
            ["Booking Realtime + chat", "Realtime messages & connections", "Narrow channel filters; disconnect on background"],
            ["Push outbox edge drains", "Edge invocations (cron ~1–5 min)", "Batch drain; backoff when empty"],
            ["process-notification-events", "Edge invocations + external SMS/email", "Demo mode off only when providers live"],
            ["Vendor intake documents", "Storage + admin download egress", "Size limits on uploads"],
            ["Analytics views (admin)", "DB CPU / compute size", "Cache dashboards; avoid polling every second"],
            ["Seed / QA scripts", "Needless MAU & storage on UAT", "Keep UAT data modest; purge regularly"],
        ],
    )


def add_hosting(doc: Document) -> None:
    doc.add_heading("4. Hosting — Vercel & GoDaddy", level=1)

    doc.add_heading("4.1 Vercel (UAT portals today)", level=2)
    add_table(
        doc,
        ["Item", "Typical cost", "Notes"],
        [
            ["Hobby (personal)", "$0", "Fine for internal QA; limited collaboration / commercial use rules"],
            ["Pro", "~$20 / user / month", "If team seats or commercial Hobby limits apply"],
            ["Three projects (admin/vendor/support)", "Included in plan", "Static Vite SPAs — bandwidth usually low vs Supabase"],
            ["Build minutes", "Plan quota", "Redeploys on every env change — keep preview deploys intentional"],
        ],
    )

    doc.add_heading("4.2 GoDaddy (target web hosting)", level=2)
    add_table(
        doc,
        ["Item", "Typical cost (indicative)", "Notes"],
        [
            ["Domain oorjaman.com", "$10 – $20 / year (+ renewals)", "Registrar dependent"],
            ["Hosting plan (cPanel / Wordpress-class)", "$5 – $30 / month", "Static file hosting for Next out/ + Vite dist/"],
            ["SSL", "Often included", "HTTPS required on all 8 hostnames (prod + UAT)"],
            ["8 document roots (4 prod + 4 UAT)", "Usually same plan", "See DEPLOYMENT.md host matrix"],
        ],
    )
    doc.add_paragraph(
        "Path: keep Vercel for UAT until GoDaddy DNS + hosts are ready, then migrate to reduce "
        "overlapping hosting spend."
    )


def add_mobile(doc: Document) -> None:
    doc.add_heading("5. Mobile — Expo EAS, Apple, Google Play", level=1)

    doc.add_heading("5.1 Expo Application Services (EAS)", level=2)
    add_table(
        doc,
        ["Plan", "USD / month", "Build credit (approx)", "When to use"],
        [
            ["Free", "$0", "Limited free Android + iOS builds", "UAT occasional builds"],
            ["Starter", "~$19 + usage", "~$45 credit", "Regular UAT/prod builds"],
            ["Production", "~$199 + usage", "~$225 credit", "High build volume / more concurrency"],
            ["Enterprise", "Custom", "From ~$1,000 credit", "Large org / SLA"],
        ],
        header_fill="FCE5CD",
    )
    add_table(
        doc,
        ["Build type (beyond credit)", "Approx fee", "OorjaMan note"],
        [
            ["Android medium", "~$1", "customer + technician UAT/prod APK/AAB"],
            ["Android large", "~$2", "When profile uses large worker"],
            ["iOS medium", "~$2", "Requires Apple Developer account"],
            ["iOS large", "~$4", "Heavier native builds"],
        ],
    )
    add_bullets(
        doc,
        [
            "Two apps × (UAT + Prod) = up to 4 bundle IDs → more credentials & rebuilds.",
            "Local UAT APK (`android:apk:uat:*`) avoids EAS build charges for Android QA.",
            "EAS Update (OTA) has separate MAU/bandwidth quotas if used — optional today.",
        ],
    )

    doc.add_heading("5.2 Apple Developer Program", level=2)
    add_table(
        doc,
        ["Item", "Cost", "Cadence"],
        [
            ["Apple Developer Program", "$99 USD", "Per year (individual or org)"],
            ["TestFlight", "Included", "After enrollment"],
            ["APNs push credentials", "Included", "Wired via EAS credentials"],
        ],
    )

    doc.add_heading("5.3 Google Play Console", level=2)
    add_table(
        doc,
        ["Item", "Cost", "Cadence"],
        [
            ["Play Console registration", "$25 USD", "One-time"],
            ["Store listing / updates", "$0", "Per app (customer + partner)"],
        ],
    )


def add_sms(doc: Document) -> None:
    doc.add_heading("6. Auth OTP / SMS & messaging", level=1)
    doc.add_paragraph(
        "UAT uses dummy auth (OTP 123456) — $0 SMS. Production needs real Phone and/or Email "
        "OTP via Supabase Auth providers (e.g. Twilio)."
    )
    add_table(
        doc,
        ["Channel", "Typical unit cost", "Planning note"],
        [
            ["SMS OTP (India-bound, Twilio-class)", "~$0.02 – $0.09 / segment", "Confirm current India rates; DLT registration may apply"],
            ["WhatsApp Business API (future notify)", "Per conversation / template", "If notification_events sends WhatsApp live"],
            ["Transactional email (SendGrid/Resend/etc.)", "$0 – $20+/mo starter", "process-notification-events when leaving demo mode"],
            ["Supabase bundled Auth SMS (if available)", "Per plan/docs", "Check dashboard quotas before choosing BYO Twilio"],
        ],
    )
    add_bullets(
        doc,
        [
            "Example: 10,000 OTP SMS / month × $0.05 ≈ $500 / month — often the largest variable after Supabase at scale.",
            "Prefer email OTP for vendors/admins where acceptable to cut SMS spend.",
            "Rate-limit OTP requests in app + Auth settings to block abuse.",
        ],
    )


def add_maps(doc: Document) -> None:
    doc.add_heading("7. Google Maps Platform", level=1)
    add_table(
        doc,
        ["Item", "Notes"],
        [
            ["APIs used", "Maps SDK Android, Maps SDK iOS, Maps Static API (site photo stamp fallback)"],
            ["Billing", "Google Cloud billing account required; free monthly thresholds vary by SKU/tier"],
            ["Without a key", "OSM fallback stamps + browser links — $0 for QA"],
            ["UAT vs Prod", "Separate restricted API keys per package (*.uat vs prod)"],
            ["Budget alert", "Set Cloud Console budget alerts before enabling in store builds"],
        ],
    )
    doc.add_paragraph(
        "Early launch expectation: low tens of USD/month if map loads stay modest; spikes come "
        "from high booking-track map usage and static map stamp generation."
    )


def add_payments(doc: Document) -> None:
    doc.add_heading("8. Payments gateway (future)", level=1)
    doc.add_paragraph(
        "Today: simulated/dummy payments in @oorjaman/api — $0 gateway fees. "
        "When integrating (e.g. Razorpay for India):"
    )
    add_table(
        doc,
        ["Cost type", "Typical model", "Planning note"],
        [
            ["Payment gateway MDR", "~1–2% + fixed fee / success", "Dominant take rate on GMV"],
            ["Failed / refund ops", "Gateway + ops time", "Model partial refunds for AMC wallets"],
            ["Settlement float", "T+N banking", "Cashflow, not SaaS bill"],
            ["PCI / compliance", "Usually handled by gateway", "Avoid storing card data in Supabase"],
        ],
    )


def add_misc(doc: Document) -> None:
    doc.add_heading("9. Domains, email & misc ops", level=1)
    add_table(
        doc,
        ["Item", "Typical cost", "Notes"],
        [
            ["Business email (Google Workspace / Microsoft 365)", "$6 – $12 / user / month", "ops@, support@, finance@"],
            ["DNS / CDN extras", "$0 – $20 / month", "Usually with GoDaddy/Vercel"],
            ["GitHub (private repos)", "$0 – $4+ / user", "Org need-dependent"],
            ["CI overage (GitHub Actions)", "Usually free quota fine", "typecheck + knip today"],
            ["Monitoring / error tracking (optional Sentry)", "$0 – $26+ / month", "Add when store traffic lives"],
            ["Design / brand print tools", "Sunk / existing", "brand:print uses local scripts"],
        ],
    )


def add_onetime(doc: Document) -> None:
    doc.add_heading("10. One-time setup costs", level=1)
    add_table(
        doc,
        ["Item", "USD", "INR (approx)", "When"],
        [
            ["Google Play Console", "$25", inr(25), "Before Play store listing"],
            ["Apple Developer (first year)", "$99", inr(99), "Before TestFlight / App Store"],
            ["Domain registration (first year)", "~$15", inr(15), "If not already owned"],
            ["Legal / privacy policy drafting", "Variable", "Variable", "Store listing requirements"],
            ["DLT / SMS sender registration (India)", "Variable", "Variable", "Before production OTP SMS"],
            ["Payment gateway KYC / activation", "$0 typical", "—", "Before live collections"],
        ],
        header_fill="FFF2CC",
    )


def add_scenarios(doc: Document) -> None:
    doc.add_heading("11. Monthly run-rate by phase (scenarios)", level=1)
    doc.add_paragraph(
        "Bundled illustrative totals (ex-GST). Use as budget bands, not invoices."
    )

    doc.add_heading("11.1 Phase A — Current UAT (as of this doc)", level=2)
    add_table(
        doc,
        ["Line item", "USD / mo", "Notes"],
        [
            ["Supabase UAT", "$0", "Free tier (watch pause + limits)"],
            ["Vercel Hobby × 3 portals", "$0", "Internal QA"],
            ["EAS Free", "$0", "Or local APK scripts"],
            ["Dummy auth / no Maps key", "$0", ""],
            ["Total", "$0 – $25", "Room for accidental Pro upgrade or Maps trial"],
        ],
        header_fill="D9EAD3",
    )

    doc.add_heading("11.2 Phase B — Production launch (first cities)", level=2)
    add_table(
        doc,
        ["Line item", "USD / mo", "Notes"],
        [
            ["Supabase Pro (Prod) + light overages", "$25 – $60", "Keep UAT Free or cheap"],
            ["GoDaddy hosting + domain (amortised)", "$10 – $25", "Or keep Vercel Pro briefly"],
            ["EAS Starter", "$19 – $45", "Depending on rebuild frequency"],
            ["Apple (amortised $99/12)", "~$8", "Plus Play one-time already paid"],
            ["Maps", "$0 – $30", "If enabled"],
            ["OTP SMS (low volume)", "$20 – $100", "Biggest uncertainty"],
            ["Email / Workspace (2–3 seats)", "$12 – $36", ""],
            ["Total", "~$95 – $300", "Aim to trim SMS + EAS early"],
        ],
        header_fill="CFE2F3",
    )

    doc.add_heading("11.3 Phase C — Scale (multi-city / high MAU)", level=2)
    add_table(
        doc,
        ["Line item", "USD / mo", "Notes"],
        [
            ["Supabase (see S2–S3)", "$150 – $700+", "MAU + compute + egress + photos"],
            ["EAS Production", "$199+", "If many CI builds"],
            ["OTP / messaging", "$200 – $2,000+", "Volume-driven"],
            ["Maps", "$50 – $200", "Map-heavy booking UX"],
            ["Hosting + email + tools", "$50 – $150", ""],
            ["Payment gateway MDR", "% of GMV", "Not a flat SaaS fee"],
            ["Total (ex-MDR)", "~$650 – $3,000+", "Revisit Supabase Team if compliance needed"],
        ],
        header_fill="FCE5CD",
    )


def add_annual(doc: Document) -> None:
    doc.add_heading("12. Annual budget roll-up", level=1)
    add_table(
        doc,
        ["Phase", "Low annual USD", "High annual USD", "Low INR", "High INR"],
        [
            ["A — UAT year", "$0", "$500", inr(0), inr(500)],
            ["B — Launch year", "$1,500", "$5,000", inr(1500), inr(5000)],
            ["C — Scale year", "$8,000", "$40,000+", inr(8000), inr(40000) + "+"],
        ],
        header_fill="EAD1DC",
    )
    doc.add_paragraph(
        "Add Apple $99 renewals, domain renewals, and any one-time legal/SMS registration "
        "into the first launch year. MDR on payments sits on top of GMV and is excluded here."
    )


def add_optimisation(doc: Document) -> None:
    doc.add_heading("13. Cost drivers & optimisation tips", level=1)
    add_bullets(
        doc,
        [
            "Prefer local Android UAT APKs to save EAS minutes during QA.",
            "Keep dummy auth on UAT forever; never burn SMS on seed users.",
            "Compress and resize site/job photos before upload.",
            "Monitor Supabase Dashboard → Reports weekly in the first prod month.",
            "Set spend caps / budget alerts on Google Cloud and Supabase.",
            "Delay Supabase Team ($599) until compliance actually requires it.",
            "Consolidate portals on GoDaddy when ready to drop Vercel spend.",
            "Email OTP for admin/vendor/support reduces SMS cost vs phone for staff roles.",
            "Avoid enabling Storage image transforms or PITR until there is a clear need.",
            "Two apps (customer + partner) roughly doubles store & build effort — batch releases.",
        ],
    )


def add_appendix(doc: Document) -> None:
    doc.add_heading("14. Appendix — env vars & source links", level=1)

    doc.add_heading("14.1 Related project docs", level=2)
    add_bullets(
        doc,
        [
            "project-docs/BILLING.md — service onboarding checklist",
            "project-docs/DEPLOYMENT.md — PROD vs UAT matrix",
            "project-docs/ENVIRONMENT.md — env var placement",
            "project-docs/SUPABASE-UAT-PROD.md — dual project workflow",
            "project-docs/VERCEL.md — portal hosting",
            "project-docs/OorjaMan-Architecture.docx — system architecture",
        ],
    )

    doc.add_heading("14.2 Pricing pages to re-check", level=2)
    add_bullets(
        doc,
        [
            "https://supabase.com/pricing",
            "https://expo.dev/pricing",
            "https://vercel.com/pricing",
            "https://cloud.google.com/maps-platform/pricing",
            "https://www.twilio.com/en-us/sms/pricing",
            "https://developer.apple.com/support/compare-memberships/",
            "https://play.google.com/console/about/",
        ],
    )

    doc.add_heading("14.3 Document maintenance", level=2)
    doc.add_paragraph(
        f"Generated on {date.today().isoformat()} by scripts/generate-costing-doc.py. "
        f"INR column uses ≈ ₹{INR_PER_USD} per USD for illustration. "
        "Regenerate with: npm run docs:costing"
    )


def build() -> None:
    doc = setup_document()
    add_cover(doc)
    add_toc(doc)
    add_executive(doc)
    add_today_vs_later(doc)
    add_supabase(doc)
    add_hosting(doc)
    add_mobile(doc)
    add_sms(doc)
    add_maps(doc)
    add_payments(doc)
    add_misc(doc)
    add_onetime(doc)
    add_scenarios(doc)
    add_annual(doc)
    add_optimisation(doc)
    add_appendix(doc)

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc.save(str(OUTPUT))
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    build()
