# OorjaMan — Design inconsistencies

**Source:** [CURRENT-DESIGN-AUDIT.md](./CURRENT-DESIGN-AUDIT.md)  
**Date:** 14 September 2026  
**Product was not changed.** This list is documentation only.

Legend: **EXTRACTED** = conflict already in the product. **RECOMMENDED** = how to resolve it later.

---

## 1. Two greens, two navies

| Role | HEX | Where it lives |
| --- | --- | --- |
| Wordmark “Oorja” | `#549048` | Logo, splash, composed lockups |
| Product CTA | `#1f8660` | Buttons, tabs, links |
| Wordmark “Man” | `#1C4276` | Logo type, partner badge glyph |
| Product ink | `#0f2938` | Headings, body |

**EXTRACTED.** This split is intentional in `packages/config` (logo vs UI). It becomes a problem when decks, Play graphics, or print use one green as if it were the other.

**RECOMMENDED.** Name them in every file: **Identity green / Identity navy** vs **Product primary / Product ink**. Never use `#549048` as a button. Never set “OorjaMan” in a single navy.

---

## 2. Play feature graphic vs lockup rule

**EXTRACTED.** `apps/customer-app/store-listing/graphics/feature-graphic-1024x500.png` sets the wordmark in one dark navy and puts the O on a white tile. `brand/README.md` already forbids flattening the split wordmark and warns against the raster lockup’s white box on white screens.

**RECOMMENDED.** Rebuild the graphic with live split type (Oorja `#549048` / Man `#1C4276`) and the transparent 1024 O, no white plate.

---

## 3. Photography yellow vs product mint

**EXTRACTED.** Marketing stills use yellow polos and hard hats. Product UI has no yellow token. The apps are mint/teal; the website photos are construction-safety yellow + blue sky.

**RECOMMENDED.** Keep the rooftop/PPE truth. Grade or wardrobe future shoots toward navy/white/primary green, or treat yellow as **field PPE only**, never as a UI or slide accent.

---

## 4. Tailwind leftovers on web

**EXTRACTED.** CSS fallbacks and support/admin pages use slate/stone/blue: `#0f172a`, `#64748b`, `#e7e5e4`, `#f5f5f4`, `#2563eb`, plus wrong primaries `#0f766e` and `#16a34a`. Worst file: `apps/support-web/src/pages/support-inbox.css` (~126 hex hits).

If `--wb-*` variables fail, portals look like a generic dashboard, not OorjaMan.

**RECOMMENDED.** Fallbacks must equal `@oorjaman/config`. Ban `#2563eb` links.

---

## 5. Status language split

**EXTRACTED.**

- Mobile chips: mint fills, **navy uppercase type**, hairline borders.
- Web badges: Tailwind pastel amber / emerald / rose with coloured type.

Same words (“warning”, “success”) do not look related.

**RECOMMENDED.** One semantic set (see tokens). Mobile can keep navy-on-mint chips; web badges should use the same fills, not a second palette.

---

## 6. Button shape split

**EXTRACTED.** App buttons are rounded rectangles (10–12px). Marketing `.om-btn` is a pill (999px). Web portal buttons are 10px and visually shorter.

**RECOMMENDED (NEW STANDARD).** Product + portals = rounded rect (`radius.md` / 12). Pills reserved for chips, badges, marketing hero CTA only — and that exception should be written, not accidental.

---

## 7. Raster-only logo

**EXTRACTED.** No SVG of the O. Lockup PNG is opaque white. Partner badge is a runtime overlay or baked raster, not a vector.

**RECOMMENDED.** Export SVG O (not a redraw of geometry — trace the master). Add reverse lockup and a no-tagline horizontal lockup.

---

## 8. Type stack drift

**EXTRACTED.** Apps and most web load **Plus Jakarta Sans**. `vendor-signup.css` hardcodes Inter. Print/email use Arial/Helvetica. Cursor rules still mention Poppins / DM Sans / Montserrat.

**RECOMMENDED.** Plus Jakarta everywhere UI can load it. Inter or Arial only as fallback. Update internal rules.

---

## 9. Token gaps vs magic numbers

**EXTRACTED.** Colour/type/spacing tokens exist. Radius, elevation, motion, warning, info, and chart-2 do not. `book.tsx` and similar screens use 5, 6, 10, 11, 14, 16, 20. Button md radius is **11** (off-grid). Job cards use 18.

**RECOMMENDED.** Adopt the named scales in `design-tokens.json`. Do not invent a second spacing grid.

---

## 10. Lime accent is documented, almost unused

**EXTRACTED.** `#9fc93c` is in `colors.ts` and sampled from the O. Home / bookings / AMC / profile screenshots barely use it.

**RECOMMENDED.** Treat lime as **spark only** (focus-adjacent, charts, on-dark wordmark “Oorja”). Never body text (1.93:1 on white).

---

## 11. Success ≈ primary

**EXTRACTED.** Success `#1a7d52` vs primary `#1f8660` — too close for colour-only status.

**RECOMMENDED.** Keep the hex (extracted). Pair success with a label or icon. Do not rely on hue alone.

---

## 12. Dark mode flag without a theme

**EXTRACTED.** Expo `userInterfaceStyle: "automatic"`; web `color-scheme: light`. No dark tokens.

**RECOMMENDED.** Either ship a dark palette later or set `userInterfaceStyle: "light"` until one exists.

---

## 13. Splash timing docs vs code

**EXTRACTED.** `brand/README.md` ≈ 2.4s. Constants ≈ 3.4s fill + 360ms fade.

**RECOMMENDED.** Align the README to the constants, or shorten the animation. Do not treat 2.4s as a motion token.

---

## 14. Iconography does not travel

**EXTRACTED.** Mobile = Ionicons outline. Web = ad hoc strokes (2px admin, 1.75px marketing). PowerPoint has no icon pack.

**RECOMMENDED.** Keep Ionicons on mobile. For web/slides use a **matching outline stroke** (round cap, ~1.75–2px at 24px). Do not introduce Lucide on mobile while Ionicons remains the product language.

---

## 15. Print letterhead extra greens

**EXTRACTED.** `brand-print` letterhead helpers use `#D4ED9A`, `#A8D65A`, `#6FAF52`, `#457A3A`, `#3d7a6e` — not in `packages/config`.

**RECOMMENDED.** Rebuild print ornaments from identity + product tokens only.

---

## Customer vs technician

Not an inconsistency of identity. Same kit; partner is a **badge + IA** skin. Do not create a second colour system for the technician app.
