# OorjaMan — Top 10 design improvements

**Product was not changed.** Priorities are for a later implementation pass.  
Each item: problem, impact, recommendation, P0 / P1 / P2.

Classification: **RECOMMENDED IMPROVEMENT** unless noted as a **NEW DESIGN-SYSTEM STANDARD**.

---

## 1. Govern the two palettes (identity vs product)

**Problem:** Logo green/navy and CTA green/ink are both “brand” in people’s heads. Play graphic already flattened the wordmark.

**Impact:** Decks, ads, and new screens will keep mixing them. OorjaMan will look like two companies.

**Recommendation:** Freeze the naming in this design system. Identity colours only on the mark and wordmark. Product primary `#1f8660` for all interactive UI. Rebuild the Play feature graphic.

**Priority:** P0

---

## 2. Replace Tailwind fallback hex on web

**Problem:** Support inbox, admin CSS, and portal-login fallbacks are slate/stone/`#2563eb`/`#0f766e`/`#16a34a`.

**Impact:** Highest visual drift in the repo. Portals can look unbranded even when mobile is tight.

**Recommendation:** `--wb-*` fallbacks = `@oorjaman/config`. Rewrite `support-inbox.css` onto tokens. Add warning/info tokens so badges stop inventing hex.

**Priority:** P0

---

## 3. Ship a vector O and a usable lockup

**Problem:** Raster-only mark; lockup PNG has an opaque white field.

**Impact:** Cannot place the logo on mint, photography, or dark slides without a box. Print and PPT quality suffer.

**Recommendation:** Trace `brand/source/logo-icon.png` to SVG (geometry from the master, not a new mark). Export a transparent lockup and a reverse (on-dark) lockup.

**Priority:** P0

---

## 4. Fix contrast on tagline and lime-as-text

**Problem:** Tagline `#9B9B9B` on white is 2.78:1. Lime `#9fc93c` on white is 1.93:1. CTA `#1f8660` on white is only 4.53:1.

**Impact:** Tagline fails WCAG AA. Lime used as type would fail. CTA is on the AA edge.

**Recommendation:** Keep extracted hexes in the product for now. For new work: tagline at display sizes only, or use `#516a7b`. Never lime text. Optional later: slightly darker primary for AAA.

**Priority:** P0 (tagline/lime rules) / P1 (CTA darkening)

---

## 5. One status / semantic colour set

**Problem:** Mobile mint chips vs web Tailwind pastels. Success ≈ primary.

**Impact:** Ops dashboards and apps disagree on “warning” and “done”.

**Recommendation:** Adopt tokens in `design-tokens.json` (`warning`, `info`, `chart-2`). Pair success with a label. Do not recolour mobile chips to rainbow.

**Priority:** P1

---

## 6. Tokenise radius, elevation, motion

**Problem:** Button radius 10/11/12, cards 14, fields 12, pills 999 — hardcoded. Splash docs ≠ code.

**Impact:** Every new screen invents 11 or 18. Motion feels shared but is not specified.

**Recommendation:** Use the extracted scale in tokens. Snap button md from 11 → 12 when product work is allowed. Align splash README to ~3.4s or shorten the animation.

**Priority:** P1

---

## 7. One button silhouette across product surfaces

**Problem:** Apps = rounded rect; marketing = pill; portals = short 10px rect.

**Impact:** Marketing already looks like a different product than the apps people download.

**Recommendation:** **NEW STANDARD:** rounded rect for product/portals; pill only for chips and an explicit marketing hero CTA.

**Priority:** P1

---

## 8. Iconography for web and slides

**Problem:** Ionicons on mobile; random strokes on web; nothing for PowerPoint.

**Impact:** Decks will pick Lucide/Flaticon and break the outline language.

**Recommendation:** Keep Ionicons on apps. Document 24px outline, ~1.75–2px stroke, round cap, primary/muted tints. For PPT, use a simple outline set with the same optical weight (or PNG exports from Ionicons). Do not mix filled Material icons.

**Priority:** P1

---

## 9. Photography colour alignment

**Problem:** Yellow uniforms vs mint product. Mixkit stock video still in the marketing folder.

**Impact:** Website hero and app store listing feel unrelated.

**Recommendation:** Keep rooftop/PPE subjects. Do not invent a stock “Apple clean-tech” photo style. Future shoots: navy/white/green wardrobe; replace Mixkit before treating video as brand truth. Yellow = PPE, not brand colour.

**Priority:** P1 (wardrobe/grade) / P0 if Mixkit ships on the public homepage at launch

---

## 10. Presentation system (none exists)

**Problem:** No PPT, no slide grid, Plus Jakarta not in Office by default, print already on Arial.

**Impact:** Investor and partner decks will be built from scratch and will not match the apps.

**Recommendation:** Use [Oorjaman-Presentation-Style-Guide.md](../Oorjaman-Presentation-Style-Guide.md) and the PPT quick reference. Install Plus Jakarta or accept Arial/Calibri with split wordmark colours. 16:9, mint or white, primary for emphasis only.

**Priority:** P1 (templates) / P2 (full template .pptx file)

---

## Out of the top 10 but noted

| Item | Priority |
| --- | --- |
| Dark theme (design or turn the flag off) | P2 |
| Numeric/tabular figures for KPIs | P2 |
| Illustration system (empty states) | P2 |
| Unify Inter leftover on vendor signup | P2 |
| Remove unused `adaptive-icon.png` | P2 |
