#!/usr/bin/env python3
"""
Generate OorjaMan vendor & technician production onboarding prerequisites (Word).

Run: .venv-docgen/bin/python scripts/generate-onboarding-prerequisites-doc.py
     or: npm run docs:onboarding-prerequisites

Source of truth in product:
  - packages/api/src/vendors/vendor-intake-validation.ts
  - apps/technician-app/app/technician-onboarding.tsx
  - Supabase vendor intake submit RPC (required fields)
"""

from __future__ import annotations

from datetime import date
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt

REPO_ROOT = Path(__file__).resolve().parents[1]
OUTPUT = REPO_ROOT / "project-docs" / "OorjaMan-Vendor-Technician-Onboarding-Prerequisites.docx"


def shade_cell(cell, fill: str = "E8F0FE") -> None:
    el = OxmlElement("w:shd")
    el.set(qn("w:fill"), fill)
    cell._tc.get_or_add_tcPr().append(el)


def add_table(doc: Document, headers: list[str], rows: list[list[str]], header_fill: str = "1F8660") -> None:
    table = doc.add_table(rows=1 + len(rows), cols=len(headers))
    table.style = "Table Grid"
    for i, h in enumerate(headers):
        cell = table.rows[0].cells[i]
        cell.text = h
        shade_cell(cell, header_fill)
        for p in cell.paragraphs:
            for run in p.runs:
                run.bold = True
                run.font.color.rgb = None
                # White text on green header
                from docx.shared import RGBColor

                run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
                run.font.size = Pt(10)
    for r, row in enumerate(rows):
        for c, val in enumerate(row):
            table.rows[r + 1].cells[c].text = val
            for p in table.rows[r + 1].cells[c].paragraphs:
                for run in p.runs:
                    run.font.size = Pt(10)
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


def main() -> None:
    doc = setup_document()

    title = doc.add_paragraph()
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = title.add_run("OorjaMan")
    run.bold = True
    run.font.size = Pt(28)

    sub = doc.add_paragraph()
    sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = sub.add_run("Vendor & Technician Onboarding Prerequisites")
    r.bold = True
    r.font.size = Pt(16)

    meta = doc.add_paragraph()
    meta.alignment = WD_ALIGN_PARAGRAPH.CENTER
    meta.add_run(
        f"Production checklist for ops & partner success · {date.today().strftime('%d %B %Y')}"
    )

    doc.add_paragraph()
    p = doc.add_paragraph()
    run = p.add_run("Purpose: ")
    run.bold = True
    p.add_run(
        "Share this with the ops and partner-success teams so everyone knows which fields "
        "and documents are mandatory before a vendor or technician can be onboarded and "
        "approved for production. Rules match what the partner portal, technician app, "
        "and backend currently enforce."
    )

    note = doc.add_paragraph()
    run = note.add_run("Note: ")
    run.bold = True
    note.add_run(
        "Only approved vendors are visible to customers. Technicians must be invited by "
        "their vendor and complete app onboarding before they can be assigned to jobs."
    )

    # ----- Overview -----
    doc.add_heading("1. Onboarding flow (summary)", level=1)
    add_bullets(
        doc,
        [
            "Vendor applies via partner registration (intake) → Admin reviews & approves.",
            "Approved vendor invites technicians by mobile number from the partner portal.",
            "Technician completes onboarding in the technician app → Vendor review → Platform verification (as configured).",
            "Document files are stored in private Supabase Storage buckets: vendor-documents and technician-documents.",
        ],
    )

    # ----- Vendor -----
    doc.add_heading("2. Vendor (partner) — mandatory fields", level=1)

    doc.add_heading("2.1 Account / login", level=2)
    add_table(
        doc,
        ["Field", "Requirement"],
        [
            ["Partner login email", "Mandatory — used after approval"],
            ["Partner login mobile", "Mandatory — OTP / sign-in phone"],
        ],
    )

    doc.add_heading("2.2 Company details", level=2)
    add_table(
        doc,
        ["Field", "Requirement"],
        [
            ["Legal business name", "Mandatory"],
            ["Trade name", "Mandatory"],
            ["Company type", "Mandatory"],
            ["CIN / registration number", "Mandatory"],
            ["GSTIN", "Mandatory — valid 15-character GSTIN"],
            ["PAN", "Mandatory — valid 10-character PAN"],
            ["Website URL", "Mandatory"],
            ["Organisation contact email", "Mandatory"],
            ["Organisation phone", "Mandatory"],
        ],
    )

    doc.add_heading("2.3 Contact person", level=2)
    add_table(
        doc,
        ["Field", "Requirement"],
        [
            ["Name", "Mandatory"],
            ["Designation / role", "Mandatory"],
            ["Phone", "Mandatory"],
            ["Email", "Mandatory"],
        ],
    )

    doc.add_heading("2.4 Address & coverage", level=2)
    add_table(
        doc,
        ["Field", "Requirement"],
        [
            ["Registered address — line 1", "Mandatory"],
            ["City", "Mandatory"],
            ["State", "Mandatory"],
            ["PIN code", "Mandatory — 6 digits"],
            ["Operating regions", "Mandatory — at least one"],
            ["Service areas", "Mandatory — at least one"],
        ],
    )

    doc.add_heading("2.5 Experience & operations", level=2)
    add_table(
        doc,
        ["Field", "Requirement"],
        [
            ["Years in business", "Mandatory — positive number"],
            ["Approx. field workforce", "Mandatory — whole number > 0"],
            ["Experience summary", "Mandatory"],
            ["Equipment available", "Mandatory — at least one item listed"],
        ],
    )

    doc.add_heading("2.6 Safety & compliance flags", level=2)
    doc.add_paragraph(
        "All of the following must be confirmed (true) before submit:"
    )
    add_bullets(
        doc,
        [
            "Safety training completed for crew",
            "PPE available",
            "Insurance coverage in place",
        ],
    )

    doc.add_heading("2.7 Bank details", level=2)
    add_table(
        doc,
        ["Field", "Requirement"],
        [
            ["Bank name", "Mandatory"],
            ["IFSC", "Mandatory — valid 11-character IFSC"],
            ["Account number", "Mandatory — full number, at least 9 digits"],
        ],
    )

    doc.add_heading("2.8 Vendor documents (uploads)", level=2)
    add_table(
        doc,
        ["Document", "Mandatory?", "Notes"],
        [
            ["PAN card / PAN proof", "Yes", "Company / entity PAN"],
            ["Contact person Aadhaar", "Yes", "Identity of authorised contact"],
            ["GST certificate", "Yes", "Matches GSTIN on file"],
            ["Bank proof", "Yes", "Cancelled cheque, passbook, or statement"],
            ["Company logo", "No", "Optional branding asset"],
        ],
        header_fill="1C4276",
    )

    doc.add_heading("2.9 Admin action after vendor submit", level=2)
    add_bullets(
        doc,
        [
            "Review intake in Admin portal.",
            "Approve only when fields and documents are complete and consistent.",
            "Until approved, the vendor is not visible to customers on the marketplace.",
        ],
    )

    # ----- Technician -----
    doc.add_heading("3. Technician (Oorja Man) — mandatory fields", level=1)

    doc.add_heading("3.1 Prerequisite", level=2)
    add_bullets(
        doc,
        [
            "Vendor must invite the technician by mobile number from the partner portal.",
            "Technician signs in with that phone and cannot self-register without an invite.",
        ],
    )

    doc.add_heading("3.2 Identity & profile", level=2)
    add_table(
        doc,
        ["Field", "Requirement"],
        [
            ["Employer vendor", "Mandatory — locked to inviting vendor"],
            ["Name as per Aadhaar", "Mandatory — must match ID"],
            ["Date of birth", "Mandatory"],
            ["Gender", "Mandatory"],
            ["Father / guardian name", "Mandatory"],
            ["Home base address — line 1", "Mandatory"],
            ["Personal phone", "Mandatory — from invite / sign-in (read-only)"],
        ],
    )

    doc.add_heading("3.3 Identity numbers", level=2)
    add_table(
        doc,
        ["Field", "Requirement"],
        [
            ["PAN number", "Mandatory"],
            ["Aadhaar last 4 digits", "Mandatory"],
        ],
    )

    doc.add_heading("3.4 Skills & work readiness", level=2)
    add_table(
        doc,
        ["Field", "Requirement"],
        [
            ["Skills", "Mandatory — at least one"],
            ["Preferred work city", "Mandatory — single city only"],
            ["Solar panel cleaning experience", "Mandatory — must confirm Yes"],
            ["Years of solar cleaning experience", "Mandatory — positive number"],
        ],
    )

    doc.add_heading("3.5 Safety acknowledgements & declarations", level=2)
    add_bullets(
        doc,
        [
            "All onboarding safety awareness checkboxes confirmed",
            "Declaration: information provided is accurate",
            "Declaration: safety commitment",
        ],
    )

    doc.add_heading("3.6 Bank details", level=2)
    add_table(
        doc,
        ["Field", "Requirement"],
        [
            ["Account holder name", "Mandatory"],
            ["Account last 4 digits", "Mandatory"],
            ["IFSC", "Mandatory — 11 characters"],
        ],
    )

    doc.add_heading("3.7 Technician documents (uploads)", level=2)
    add_table(
        doc,
        ["Document", "Mandatory?", "Notes"],
        [
            ["Aadhaar", "Yes", "Scan or PDF"],
            ["PAN", "Yes", "Scan or PDF"],
            ["Passport-size photo", "Yes", "Identity photo"],
            ["Bank proof", "Yes", "Cancelled cheque / passbook / statement"],
            ["Safety certificate", "No", "Optional if available"],
        ],
        header_fill="1C4276",
    )

    doc.add_heading("3.8 Optional (collected, not blocking submit)", level=2)
    add_bullets(
        doc,
        [
            "Home base city, state, PIN code",
            "Emergency contact name / phone",
            "Contact email",
            "Service radius (km)",
            "Height-work / safety-training flags and training organisation",
            "Other skills free text",
        ],
    )

    doc.add_heading("3.9 Review path after technician submit", level=2)
    add_bullets(
        doc,
        [
            "Vendor reviews the submitted profile (approve / reject with reason).",
            "Platform / admin verification as per your production process.",
            "Only verified technicians should be assigned to live jobs.",
        ],
    )

    # ----- Ops checklist -----
    doc.add_heading("4. Ops checklist — production onboarding", level=1)
    add_table(
        doc,
        ["#", "Action", "Owner"],
        [
            ["1", "Collect vendor fields + 4 mandatory documents", "Partner success / Vendor"],
            ["2", "Vendor submits intake via partner registration", "Vendor"],
            ["3", "Admin reviews & approves vendor", "Ops / Admin"],
            ["4", "Vendor invites technician(s) by phone", "Vendor"],
            ["5", "Technician completes app onboarding + 4 mandatory docs", "Technician"],
            ["6", "Vendor approves technician profile", "Vendor"],
            ["7", "Admin / platform verifies technician (if required)", "Ops / Admin"],
            ["8", "Confirm Storage buckets vendor-documents & technician-documents", "Engineering"],
            ["9", "Confirm insurance attestation matches ops policy (no separate upload field today)", "Ops"],
        ],
    )

    # ----- Appendix -----
    doc.add_heading("5. Appendix — product references", level=1)
    add_bullets(
        doc,
        [
            "Vendor validation: packages/api/src/vendors/vendor-intake-validation.ts",
            "Vendor signup UI: apps/vendor-web (partner registration wizard)",
            "Technician onboarding UI: apps/technician-app/app/technician-onboarding.tsx",
            "Technician API submit: packages/api/src/technicians/technician-api.ts",
            "Storage: vendor-documents, technician-documents (private buckets)",
        ],
    )

    footer = doc.add_paragraph()
    footer.add_run(
        "Internal use — regenerate with: npm run docs:onboarding-prerequisites"
    ).italic = True

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc.save(OUTPUT)
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    main()
