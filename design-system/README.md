# OorjaMan design system

Documentation extracted from the shipping product on 14 September 2026. **No application UI was changed.**

Start here:

| File | Purpose |
| --- | --- |
| [Oorjaman-Visual-Reference.html](Oorjaman-Visual-Reference.html) | Open in a browser — 2-minute board |
| [Oorjaman-Visual-Reference.pdf](Oorjaman-Visual-Reference.pdf) | Same board as a shareable 3-page PDF |
| [Oorjaman-Brand-Design-System.md](Oorjaman-Brand-Design-System.md) | Full brand book |
| [Oorjaman-Presentation-Style-Guide.md](Oorjaman-Presentation-Style-Guide.md) | PowerPoint / Slides |
| [Oorjaman-PPT-Quick-Reference.md](Oorjaman-PPT-Quick-Reference.md) | One-page cheat sheet |
| [design-tokens.json](design-tokens.json) | Machine-readable tokens |
| [oorjaman-design-tokens.css](oorjaman-design-tokens.css) | CSS variables |
| [audit/CURRENT-DESIGN-AUDIT.md](audit/CURRENT-DESIGN-AUDIT.md) | Evidence |
| [audit/DESIGN-INCONSISTENCIES.md](audit/DESIGN-INCONSISTENCIES.md) | Conflicts |
| [audit/PRIORITY-IMPROVEMENTS.md](audit/PRIORITY-IMPROVEMENTS.md) | P0–P2 |

Live code tokens remain in `packages/config`. Raster masters remain in `brand/source/` (`npm run brand:sync`).

Every rule is tagged **extracted** / **recommended** / **new standard**. Do not treat recommendations as product law until they are implemented.

---

## What was found

OorjaMan already has a real identity: a dimensional green→blue **O**, a **split wordmark**, tagline **WE CLEAN. YOU GENERATE.**, mint canvas `#f6faf9`, CTA `#1f8660`, ink `#0f2938`, **Plus Jakarta Sans**, and **Ionicons outline** on both mobile apps. Customer and technician share one kit; partner is a badge, not a second brand. `brand:sync` and `@oorjaman/config` are the operational spine.

It is **not** a native Android XML/Compose design system. Expo + web.

## What is already strong

- Recognisable mark and lockup logic  
- Calm, premium product UI (Play screenshots)  
- Shared mobile components (`Button`, `Card`, `Screen`)  
- Marketing site CSS vars largely match tokens  
- Deprecated old hexes (`#6FB53E`, `#0F4D92`, …) are gone  

## What is inconsistent

- Two greens (`#549048` vs `#1f8660`) and two navies (`#1C4276` vs `#0f2938`) without always naming them  
- Play feature graphic flattens the wordmark  
- Photography is yellow-PPE; UI is mint  
- Web CSS fallbacks are Tailwind slate / `#2563eb` (especially support inbox)  
- Marketing pills vs app rounded-rect buttons  
- No SVG logo; lockup PNG is a white box  
- Radius / warning / chart-2 not in `packages/config`  

## What should become the official standard

- Identity colours = wordmark only  
- Product primary `#1f8660` = all interactive UI  
- Plus Jakarta + Arial/Calibri fallbacks for Office  
- Spacing 4-based; radius 10 / 12 / 14 / 999  
- Ionicons outline on apps; matching strokes on web/slides  
- Presentation: 16:9 mint or white, split wordmark, two chart colours max by default  

## What should change (later, in product)

See [PRIORITY-IMPROVEMENTS.md](audit/PRIORITY-IMPROVEMENTS.md): govern palettes, kill Tailwind leftovers, vector the O, tagline contrast, semantic tokens, snap radius 11→12, align splash timing docs.

## How to use this system

1. Designers: open the HTML board, then the brand book.  
2. Deck builders: PPT quick reference first, then the 18 layouts.  
3. Engineers: keep using `@oorjaman/config` until a ticket lands; new CSS fallbacks must equal these tokens.  
4. Do not redraw the O. Do not introduce Poppins or Lucide on mobile.

---

## OorjaMan design system — one page summary

| | |
| --- | --- |
| **Primary brand colour (product CTA)** | `#1f8660` |
| **Secondary (Man navy / identity)** | `#1C4276` |
| **Accent (lime spark)** | `#9fc93c` |
| **Identity green (Oorja)** | `#549048` |
| **Background** | `#f6faf9` |
| **Ink** | `#0f2938` |
| **Primary font** | Plus Jakarta Sans |
| **Secondary / fallback font** | Inter (web stack) · Arial / Calibri (Office / print) |
| **Icon family** | Ionicons outline |
| **Spacing base** | 4px (8 / 12 / 16 / 24 / 32) |
| **Corner radius** | 12 fields · 14 cards · 999 chips |
| **Visual personality** | Calm mint operations; quiet energy in the O; trustworthy, not loud |
| **Presentation style** | 16:9, mint or white, split wordmark, one green emphasis, hairline cards, no rainbow |

**Tagline:** WE CLEAN. YOU GENERATE.
