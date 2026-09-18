# OorjaMan presentation design system

**Audience:** PowerPoint / Google Slides / Keynote designers.  
**Colours and type come from the product.** Layout grid and slide templates are a **NEW DESIGN-SYSTEM STANDARD** — no `.pptx` existed in the repo.

Product UI was not changed.

Companion: [Oorjaman-PPT-Quick-Reference.md](Oorjaman-PPT-Quick-Reference.md)

---

## Slide size

**16:9** — 13.333 × 7.5 in · 1920 × 1080 px · 1219.2 × 685.8 pt

Do not use 4:3.

---

## Background colours

| Fill | HEX | Use |
| --- | --- | --- |
| Canvas | `#f6faf9` | Default body slides |
| White | `#ffffff` | Dense tables, screenshots |
| Ink | `#0f2938` | Section dividers, closing (sparingly) |
| Primary wash | `#d8eee4` | Optional callout band |

**EXTRACTED** from product. Dark heroes exist on the marketing site; decks should not default to them.

---

## Typography (slides)

Install **Plus Jakarta Sans** (Google Fonts). If unavailable:

| Surface | Fallback |
| --- | --- |
| Windows PPT | Calibri |
| Print-like | Arial (already used in `brand-print`) |

| Role | Font | Weight | Size (pt) | Size (px @1920) | Line | Tracking |
| --- | --- | --- | --- | --- | --- | --- |
| Cover title | Plus Jakarta | 700 | 40–48 | 53–64 | 1.15 | −2% |
| Section title | Plus Jakarta | 700 | 32–36 | 43–48 | 1.15 | −2% |
| Slide title | Plus Jakarta | 600 | 24–28 | 32–37 | 1.2 | −1% |
| Body | Plus Jakarta | 400 | 16–18 | 21–24 | 1.4 | 0 |
| Caption / footnote | Plus Jakarta | 500 | 10–12 | 13–16 | 1.3 | 0 |
| KPI number | Plus Jakarta | 700 | 36–44 | 48–59 | 1.1 | −3% |
| KPI label | Plus Jakarta | 600 | 11 | 15 | 1.2 | +6%, uppercase |
| Tagline | Plus Jakarta | 600 | 10–12 | 13–16 | 1.2 | +18%, uppercase |

**Wordmark on slides:** type **Oorja** `#549048` + **Man** `#1C4276`. Never one colour.

---

## Colour rules (practical)

### Primary `#1f8660`

Use for: one key metric, one CTA bar, active tab in a diagram, chart series 1.

### Secondary / Man `#1C4276`

Use for: “Man” in the name, support/ops identity, chart series 3, dark text on lime.

### Oorja `#549048`

Use for: “Oorja” in the name, partner persona, chart series 4. **Not** buttons.

### Accent `#9fc93c`

Sparingly: one spark on a dark divider, chart series 5. Never body text.

### Neutrals

Backgrounds, text, rules, tables. Most of the slide should be neutral.

### Semantic

Success / warning / error / info **only for meaning** (on-time vs SLA miss). Do not colour every bullet.

Avoid rainbow palettes. Max **two** series colours plus grey on a chart unless a dashboard slide explicitly needs five.

---

## Slide grid

**NEW STANDARD** (16:9, 1920×1080).

| | px | pt | % of width |
| --- | --- | --- | --- |
| Margin L/R | 72 | 54 | 3.75% |
| Margin top | 64 | 48 | — |
| Margin bottom (footer band) | 56 | 42 | — |
| Content width | 1776 | 1332 | 92.5% |
| Gutter | 24 | 18 | 1.25% |
| 2 columns | 876 + 24 + 876 | — | — |
| 3 columns | 576 + 24 + 576 + 24 + 576 | — | — |
| Title block | x=72, y=64, h≈72 | — | — |
| Footer | y=1024–1080, h=56 | — | — |
| Logo | footer left, height 28–32 px | — | — |
| Page number | footer right | — | — |

Safe content box: **72, 148, 1776×860** (below title, above footer).

---

## Chrome

| Element | Spec |
| --- | --- |
| Header | Optional kicker 11pt `#1f8660` uppercase tracking 0.6px, then title |
| Footer | Hairline `#c5d9d4`, canvas or white fill |
| Logo | Transparent 1024 O, or split wordmark text. **Not** the white lockup PNG on mint. |
| Confidentiality | 10pt `#516a7b` “Confidential — OorjaMan” |
| Page numbers | 10pt `#516a7b` |
| Icons | Outline, 24–32px, primary or ink |
| Photography | Full-bleed with 40% ink gradient from bottom if type sits on photo. Radius 14 if inset. |
| Callouts | Left 4px primary bar, `#d8eee4` fill, radius 12, pad 16 |
| Quotes | 22–24pt ink, 4px Man-navy left rule |
| Footnotes | 10pt muted, bottom of content box |
| Charts | Title 16pt semibold; axis 11pt muted; legend 11pt; series from chart tokens |
| Tables | Header `#e9f1ef`, hairline `#c5d9d4`, 14pt body, 12pt header uppercase muted |
| Diagrams | Radius 12 nodes, 1.5pt `#c5d9d4` connectors, primary for the active node |

---

## Recommended sizes

| Element | pt | Notes |
| --- | --- | --- |
| Slide title | 24–28 | One line if possible |
| Body | 16–18 | 1.4 line spacing |
| Chart area | ~1100×520 px | Leave legend |
| Screenshot | max height 720 px | Radius 14, hairline |
| Cover logo O | 160–196 px | Matches splash O size language |

---

## 18 layouts

Measurements assume 1920×1080. Colour = product tokens. Imagery = rooftop/PPE only if needed; product screenshots preferred for product slides.

### 1. Cover

- Background `#f6faf9`
- O 160px left of split wordmark + tagline (uppercase grey)
- Title 44pt Bold ink, subtitle 18pt muted
- Footer: date, confidential
- No photography required

### 2. Executive summary

- Title “At a glance”
- 3–4 KPI tiles (radius 14, white, hairline) — number 36pt Bold, label uppercase 11pt muted
- One sentence body under tiles
- Primary used on **one** KPI only

### 3. Section divider

- Full `#0f2938`
- Lime or white “Oorja” + white “Man” (**EXTRACTED** marketing on-dark: lime + white)
- Section name 36pt white
- Keep sunburst off unless you are echoing splash

### 4. Problem

- Title + 3 stacked rows: muted number 01–03, 18pt body
- Optional one muted icon outline 32px
- No red except a single “loss / dirt / downtime” word if truly semantic

### 5. Solution

- Two columns: left copy, right product screenshot (radius 14)
- One primary check-list (outline icons `#1f8660`)

### 6. Product screenshot

- Title + one phone frame (Play screenshots are 1344×2992 — scale height to ~780)
- Caption 12pt muted
- Mint background so white UI still reads

### 7. Two-column

- Equal 876px columns, gutter 24
- Left title+body; right diagram or shot
- Align tops to y=148

### 8. KPI dashboard

- 4 tiles 2×2 or 4-across (match admin KPI: 14 radius, uppercase labels)
- Optional small area chart using chart-1 / chart-2 only

### 9. Comparison

- Two cards radius 14
- Left muted “Today / Other”; right primary-border “OorjaMan”
- Check vs hairline dash — not red/green rainbow

### 10. Timeline

- Horizontal line `#c5d9d4`
- Dots `#1f8660`
- Dates 12pt muted, events 16pt

### 11. Process

- 4 equal steps, numbered in primary light circles
- Short verbs: Book → Assign → Clean → Verify

### 12. Ecosystem

- Centre O (96px)
- Nodes: Customer, Partner, Technician, Admin, Support
- Persona colours: operations `#1f8660`, support `#1C4276`, partner `#549048` (**EXTRACTED**)

### 13. Architecture

- Horizontal swimlanes on white
- Apps / API / Supabase
- 12pt labels, no neon

### 14. Market map

- 2×2 or 3-across cards
- OorjaMan cell: primary light fill + primary border
- Others: white hairline

### 15. Financial

- KPI row + one bar/area chart
- Series: `#1f8660` and `#246488` only
- INR `en-IN`, no paise on slides unless asked
- Footnote: source and period

### 16. Case study

- Photo left (radius 14) or skip if yellow wardrobe fights the mint
- Right: site kW, visits, outcome KPI
- Quote optional

### 17. Quote

- 24pt ink, Man-navy 4px rule
- Attribution 14pt muted
- Empty mint field — no stock textures

### 18. Closing

- Mint or ink (pick one and stay)
- Split wordmark + tagline
- One contact line 16pt
- No new chart

---

## Photography on slides

If used: rooftop, PPE, Indian context. Do not flood with yellow. Prefer product UI captures from `apps/customer-app/store-listing/`.

Illustration: not established — use outline icons + O, not a new mascot.
