# OorjaMan brand & design system

**Version:** 1.0.0 (extracted from product, 14 September 2026)  
**Product UI was not modified.** This document formalises what already ships and names gaps.

Every rule is tagged:

- **EXTRACTED FROM CURRENT PRODUCT** — already in apps, tokens, or assets  
- **RECOMMENDED IMPROVEMENT** — fix a documented inconsistency later  
- **NEW DESIGN-SYSTEM STANDARD** — a name or scale we are freezing now; values still come from the product where possible  

Do not treat recommended or new-standard items as live code.

Related files: [audit](audit/CURRENT-DESIGN-AUDIT.md) · [tokens](design-tokens.json) · [CSS](oorjaman-design-tokens.css) · [presentations](Oorjaman-Presentation-Style-Guide.md) · [visual board](Oorjaman-Visual-Reference.html)

---

## 1. Brand overview

**EXTRACTED.** OorjaMan is a solar rooftop care platform: customers book cleaning and AMC visits; partners and technicians fulfil work; ops runs the network.

| Item | Value |
| --- | --- |
| Name | **OorjaMan** (camelCase — not “Oorjaman” in product copy) |
| Tagline | **WE CLEAN. YOU GENERATE.** |
| Mark | Dimensional O: solar grid + leaf + green→blue ribbon |
| Product feel | Calm, mint, operational, premium — not loud, not yellow-UI |

Customer and technician apps share one visual language. Technician is a **persona skin** (person badge + Jobs/Feedback), not a second brand.

---

## 2. Design philosophy

### Principles (derived from the shipping UI)

#### 1. Clear

**What it means:** One job per screen; sentence-case titles; one primary CTA.  
**How it appears:** Home is greeting + heading + two buttons + a quiet tip. Kickers (`BOOKINGS`) are small green uppercase, not decoration.  
**How to apply:** Do not add a third competing CTA. Do not put the logo on every scroll view.

#### 2. Trustworthy

**What it means:** Evidence, codes, photos, status you can read.  
**How it appears:** Hairline cards, booking IDs (`OM-…`), status chips, photo stamps.  
**How to apply:** Prefer borders over drama shadows. Show status as type + chip, not colour-only.

#### 3. Energetic (quietly)

**What it means:** Energy is in the mark and the green→blue splash bar — not neon screens.  
**How it appears:** The O, lime in the icon, splash sunburst, CTA `#1f8660`.  
**How to apply:** Lime is a spark. Yellow in photos is PPE, not a UI token.

#### 4. Human

**What it means:** Named greetings, partner badge, large tap targets (48–56px).  
**How it appears:** “Hello, Raju”, outline secondary buttons, technician job cards.  
**How to apply:** Keep technician UI simpler and larger, same colours.

#### 5. Connected

**What it means:** One kit across customer, partner, vendor, admin, support.  
**How it appears:** Shared tokens, persona accent strips (3px), same type.  
**How to apply:** Do not invent a portal-only slate theme.

#### 6. Modern / operational

**What it means:** Plus Jakarta, mint canvas, fade not bounce.  
**How it appears:** Flat cards, 320ms fades, cubic easing.  
**How to apply:** No gaming gradients, no Material 3 purple, no `#2563eb` links.

---

## 3. Logo

**EXTRACTED. Do not redraw.**

### Symbol

The O is a **ribbon**: left = solar panel grid + leaf; right = green folding into blue. It is dimensional, not a flat letter.

Master: `brand/source/logo-icon.png` (1536×1024, alpha) → synced 1024 square for apps.

### Wordmark

Live text, not the lockup PNG, on white UI:

- **Oorja** `#549048`  
- **Man** `#1C4276`  
- Tracking slightly tight (−0.4px), Bold  

### Tagline

`WE CLEAN. YOU GENERATE.` — uppercase, wide tracking (≈2.2px / 0.14em), `#9B9B9B`.

**RECOMMENDED:** On slides, if the grey fails contrast, use `#516a7b` at 12px+ or keep 11px tagline only at large display sizes.

### Lockup raster

`brand/source/logo-lockup-tagline.png` is **opaque white**. Use for print/OG on white only.

### Partner

Same O + circular person badge: white fill, `#549048` ring, `#1C4276` glyph. Notification icon is O-only (too small for the badge).

### Clear space / minimums (NEW STANDARD, inferred from splash)

- Icon-only: keep the O optically ~88% of a square icon canvas (existing `brand:sync` behaviour).  
- Do not put the tagline on app icons.  
- Do not flatten the wordmark to one colour (Play feature graphic currently **breaks** this — see inconsistencies).

---

## 4. Colour

### Hierarchy (EXTRACTED)

1. **Neutrals dominate** — mint canvas `#f6faf9`, white cards, ink `#0f2938`.  
2. **Product primary `#1f8660`** — the working brand in the UI.  
3. **Identity `#549048` / `#1C4276`** — lockups, splash bar, persona.  
4. **Lime `#9fc93c`** — rare spark.  
5. **Semantic red / amber** — meaning only.

Light-mode strategy: cool mint field, white surfaces, green interaction.  
Dark-mode strategy: **not established.** Do not fake a dark theme from slate-900.

### Formal palette

Do / don’t sit with each swatch. RGB/HSL in `design-tokens.json`.

#### Brand

| Name | HEX | RGB | HSL | Use | Do | Don’t |
| --- | --- | --- | --- | --- | --- | --- |
| Primary | `#1f8660` | 31,134,96 | 158,62%,32% | CTAs, tabs, links | Interactive UI | Wordmark “Oorja” |
| Primary dark | `#1a734f` | 26,115,79 | 156,63%,28% | Pressed, hover | Darken primary | Body text |
| Primary light | `#d8eee4` | 216,238,228 | 153,39%,89% | Soft fills | Chips, secondary btn | Large backgrounds only as wash |
| Secondary (Man) | `#1C4276` | 28,66,118 | 215,62%,29% | “Man”, partner glyph | Identity | Replace ink in paragraphs |
| Accent | `#9fc93c` | 159,201,60 | 78,57%,51% | Spark | On-dark / charts | Small text on white |
| Oorja | `#549048` | 84,144,72 | 110,33%,42% | “Oorja”, splash start | Identity | Buttons (fails AA as body) |

#### Neutrals

| Name | HEX | Use |
| --- | --- | --- |
| Background | `#f6faf9` | Canvas |
| Background alt | `#edf2f2` | Alt canvas |
| Surface | `#ffffff` | Cards, fields |
| Surface elevated | `#f0f7f5` | Elevated mint |
| Border / divider | `#c5d9d4` | Hairlines |
| Muted surface | `#e9f1ef` | Ghost / empty |

#### Text

| Name | HEX | Use |
| --- | --- | --- |
| Primary | `#0f2938` | Body / headings |
| Secondary / muted | `#516a7b` | Supporting copy |
| Inverse | `#ffffff` | On primary |
| Disabled (inferred) | `#9B9B9B` or 45% opacity | Controls |

#### Semantic

| Name | HEX | Origin |
| --- | --- | --- |
| Success | `#1a7d52` | Extracted (close to primary — always label it) |
| Warning text | `#92400e` | Extracted from web badges |
| Warning surface | `#fef3c7` | Extracted |
| Error | `#dc2626` | Extracted |
| Info | `#1C4276` | **NEW STANDARD** (replace `#2563eb`) |

#### Data visualization

| Name | HEX | Origin |
| --- | --- | --- |
| Chart 1 | `#1f8660` | Extracted |
| Chart 2 | `#246488` | Extracted (admin) |
| Chart 3 | `#1C4276` | New standard |
| Chart 4 | `#549048` | New standard |
| Chart 5 | `#9fc93c` | New standard |
| Positive / negative / neutral | success / error / muted text | Extracted |

**Do not use:** `#0f172a`, `#64748b`, `#e7e5e4`, `#2563eb`, `#0f766e`, `#16a34a`, deprecated `#6FB53E` / `#0F4D92` / `#0B1C3A`.

---

## 5. Typography

### CURRENT (EXTRACTED)

Plus Jakarta Sans 400/500/600/700. Stack: Plus Jakarta → Inter → system-ui → Segoe UI.

### RECOMMENDED OORJAMAN TYPOGRAPHY

Keep Plus Jakarta. It is already Google Fonts, Expo, and Next.js. For PowerPoint: install Plus Jakarta, else **Calibri** (Windows) / **Arial** (print already uses Arial). Do **not** switch the product to Poppins.

Indian market: Plus Jakarta covers Latin well; keep `en-IN` number formatting. Do not require a second Devanagari family until product copy needs it (not observed).

### Hierarchy

| Role | Font | Weight | Size | Line height | Tracking | Case | Use |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Display | Plus Jakarta | 700 | 36 | 44 | −0.03em | Sentence | Marketing |
| H1 | Plus Jakarta | 700 | 28 | 34–38 | −0.4px | Sentence | Splash / major |
| H2 | Plus Jakarta | 600 | 22 | 32 | −0.02em | Sentence | Screen title |
| H3 | Plus Jakarta | 600 | 18 | 28 | 0 | Sentence | Card title |
| H4 | Plus Jakarta | 600 | 16 | 24 | 0 | Sentence | Subsection |
| Body large | Plus Jakarta | 400 | 18 | 28 | 0 | Sentence | Lead |
| Body | Plus Jakarta | 400 | 16 | 24 | 0 | Sentence | Default |
| Body small | Plus Jakarta | 400 | 14 | 20 | 0 | Sentence | Helper |
| Caption | Plus Jakarta | 500 | 12 | 16 | 0.4px | Sentence / upper chips | Meta |
| Label | Plus Jakarta | 500 | 14 | 20 | 0 | Sentence | Inputs |
| Button | Plus Jakarta | 500 | 16 | 24 | 0 | Sentence | Buttons |
| KPI | Plus Jakarta | 700 | 28 | 32 | −0.03em | As data | Metrics, `en-IN` |
| Navigation | Plus Jakarta | 500 | 12 | 16 | 0 | Sentence | Tabs |
| Kicker | Plus Jakarta | 500 | 14 | 20 | 0.6px | Upper | BOOKINGS |
| Tagline | Plus Jakarta | 600 | 11 | 14 | 2.2px | Upper | Lockup |

---

## 6. Iconography

**EXTRACTED primary family:** Ionicons outline.

| Token | Value |
| --- | --- |
| Stroke | ~1.75–2px optical, round |
| Default | 24 |
| Small | 16 |
| Large | 48 |
| Active | `#1f8660` |
| Inactive | `#516a7b` |
| Container | None on tabs; 13% primary wash on onboarding |

Filled only for confirmation / send / partner person.

**NEW STANDARD:** Do not add Lucide to mobile. Web/PPT: same outline weight. Marketing already uses 1.75px strokes.

---

## 7. Spacing

**EXTRACTED** 4px base:

| Name | px |
| --- | --- |
| XS | 4 |
| SM | 8 |
| MD | 12 |
| LG | 16 |
| XL | 24 |
| XXL | 32 |
| XXXL | 48 |

Shared `Screen` pad is **12** horizontal. Prefer tokens over 10/11/14/18.

---

## 8. Radius

**NEW STANDARD names, EXTRACTED values:**

| Name | px | Use |
| --- | --- | --- |
| Small | 10 | Small / web buttons |
| Medium | 12 | Inputs, OTP, lg buttons |
| Large | 14 | Cards, toasts |
| XL | 16 | Sheets |
| Pill | 999 | Chips, badges |

**RECOMMENDED:** Snap button md from 11 → 12 when product work is allowed. Marketing pills are an exception, not the app default.

---

## 9. Elevation

**EXTRACTED.** Default mobile card = hairline, not shadow.

| Level | Treatment |
| --- | --- |
| 0 | Border `#c5d9d4` |
| Card (web) | `0 1px 2px rgb(15 41 56 / 0.06)` |
| Float | Opacity 0.06–0.18, elevation 2–4 |
| Modal | Elevation 8–12 / `0 12px 40px` |

Avoid heavy Material elevation.

---

## 10. Components

States listed where the product actually has them.

### Buttons

Shape: rounded rect 10–12 (apps), 10 (portals), pill (marketing hero only).  
Type: Medium, sentence case.  
Primary: `#1f8660` / white. Outline: white / 1.5px primary. Ghost: muted / border. Destructive: `#dc2626`.  
Default / hover (web brightness 0.96) / pressed 0.88 opacity 90ms / disabled 0.45 / loading spinner.

### Cards

Radius 14, white, hairline, pad 16. Press scale 0.98. Muted variant `#e9f1ef`.

### Inputs

Radius 12, min-height 48. Default border / focus primary / error destructive / disabled muted 0.55.

### Tabs (mobile)

5 items, outline icons, canvas bar, top border, active primary.

### Tabs (web)

Muted track radius 10, selected white thumb radius 8, light shadow.

### Chips / badges

Pill, uppercase. Mobile: navy type on mint fills. Web: currently Tailwind pastels — **RECOMMENDED** align to tokens.

### Navigation

Kickers uppercase primary. Headers no shadow. Portal sidebar 252px, 3px persona strip.

### Alerts / dialogs / progress

Native `Alert` on mobile; brand loading bar green→blue; web 2px primary spinner; skeletons 6–10 radius.

### Tables / KPIs / charts

Admin only. See §11.

---

## 11. Data visualization

**EXTRACTED** from admin analytics only. Not on customer/technician apps.

| Element | Spec |
| --- | --- |
| Chart 1 | `#1f8660` |
| Chart 2 | `#246488` |
| Grid | Dashed 3 3; use `#c5d9d4` not slate |
| Axis | 12–14px muted |
| KPI number | Bold 28, tracking −0.03em |
| KPI label | Uppercase 12, 0.06em, muted |
| Money | `en-IN`, INR, paise stored as integer |
| Energy copy | kW, panel counts, GST — typographic |
| Positive / negative | Success / error + label |

---

## 12. Photography

**EXTRACTED.** Rooftop crews, PPE, Indian residential/commercial arrays, daylight, yellow uniforms, handshake, washer/brush.

**Not established:** crop system, overlay spec, colour grade into mint.

**RECOMMENDED:** Keep real visits. Yellow = PPE. Future wardrobe navy/white/green. Replace Mixkit stock video. No text baked into stills (`marketing/README.md`).

---

## 13. Illustration

**EXTRACTED:** splash sunburst (14 pale-gold rays) only. Empty states = geometric dots.

**RECOMMENDED (separate from extracted truth):** If illustrating later — line + flat, O grid/leaf motifs, mint/navy/lime, no 3D mascots, no cartoon suns competing with the logo.

---

## 14. Motion

**OORJAMAN MOTION PRINCIPLES (EXTRACTED values)**

| Name | ms | Use |
| --- | --- | --- |
| Fast | 90 | Press in |
| Medium | 140 | Press out |
| Slow | 320 | Fade in / page fade |

Easing: cubic out. Splash may overshoot (`back(1.05)`). No bounce loops. Splash fill ≈ 3.4s (README still says 2.4s — inconsistency).

---

## 15. Graphic language

**Genuinely recurring:**

- Dimensional O / solar grid / leaf  
- Green → blue ribbon (logo + splash bar)  
- Split wordmark  
- Cool mint field  
- Hairline cards  
- Pill chips  
- Persona badge / 3px portal strip  

**Local only:** gold sunburst (splash), yellow PPE (photos), marketing dark hero/footer.

These can become a slide language: mint field + O + split type + one primary rule. Do not add energy-wave clipart.

---

## 16. Presentation system

See [Oorjaman-Presentation-Style-Guide.md](Oorjaman-Presentation-Style-Guide.md) and [Oorjaman-PPT-Quick-Reference.md](Oorjaman-PPT-Quick-Reference.md).

**NEW STANDARD** (no PPT existed): 16:9, white or `#f6faf9`, Plus Jakarta or Arial, split wordmark, primary for emphasis, not rainbow charts.

---

## 17. Do / don’t

### Do

- Split **Oorja** / **Man** colours  
- Compose wordmark as text on white  
- Use `#1f8660` for buttons and tabs  
- Plus Jakarta 400–700  
- Ionicons outline on mobile  
- Mint canvas, hairline cards  
- Uppercase green kickers  
- `en-IN` currency  
- Partner badge for technician only  

### Don’t

- Flatten the wordmark to one navy (current Play graphic)  
- Use `#549048` as a CTA  
- Use lime or tagline grey as small body text  
- Tailwind slate / `#2563eb`  
- Poppins / Material filled icon sets on mobile  
- Rainbow dashboards  
- Heavy shadows  
- Put the tagline on the app icon  
- Treat yellow PPE as a UI colour  

### Examples

| Correct | Incorrect |
| --- | --- |
| Colour: mint screen + green button + navy type | Colour: navy button + lime heading + yellow fill |
| Type: Plus Jakarta sentence case H1 | Type: Poppins all-caps hero |
| Icons: `home-outline` primary/muted | Icons: filled Material + Lucide mixed |
| Logo: split wordmark under transparent O | Logo: lockup PNG white box on mint, or “Oorjaman” one colour |

---

## 18. Design tokens

- JSON: [design-tokens.json](design-tokens.json)  
- CSS: [oorjaman-design-tokens.css](oorjaman-design-tokens.css)  
- Live product tokens remain `packages/config` until a later implementation pass.

---

## 19. Accessibility

Report only — **product not changed**.

| Pair | Ratio | AA body |
| --- | --- | --- |
| White on `#1f8660` | 4.53 | Pass (edge) |
| `#549048` on white | 3.85 | Fail (large text only) |
| `#1C4276` on white | 10.05 | Pass |
| `#0f2938` on `#f6faf9` | 14.31 | Pass |
| `#516a7b` on canvas | 5.40 | Pass |
| `#9B9B9B` on white | 2.78 | **Fail** |
| `#9fc93c` on white | 1.93 | **Fail** |
| Disabled 0.45 | — | Risk |

**RECOMMENDED alternatives:** tagline → `#516a7b`; never lime text; optional darker primary later; don’t rely on success vs primary hue alone.

---

## 20. Implementation guidance

1. New UI: import `colors`, `brandColors`, `spacing`, `typography` from `@oorjaman/config`.  
2. Do not add hex that is not in tokens. CSS fallbacks must equal tokens.  
3. Logos: `npm run brand:sync` from `brand/source/`.  
4. Decks: this folder + presentation guide. Install Plus Jakarta or use Arial.  
5. Do not implement these tokens into the apps until a dedicated product ticket — this phase is documentation.  
6. When product work is approved: P0 items in [PRIORITY-IMPROVEMENTS.md](audit/PRIORITY-IMPROVEMENTS.md).
