---
name: interactive-diagram
description: Build a beautiful, interactive technical diagram as a single self-contained HTML file — pure HTML, CSS, and vanilla JS, no frameworks, no build step, no CDN. Use whenever the user wants to create, draw, visualize, or explore a system/architecture, sequence, flow, data-flow, or component diagram in the browser, even if they don't say "interactive" or "HTML." Also covers a static, slide-ready "platform architecture" poster (capability columns + provider bar) exported as PNG/SVG for slides/PPT — trigger on "platform architecture", "平台架構", "platform diagram", "平台圖", "infographic", "投影片/PPT/deck/pitch", or any infographic-style architecture picture. When a request could be either an explorable diagram or a slide poster and gives no clear cue, ask which before building.
---

# Interactive Diagram

Produce a single self-contained `.html` file that renders a beautiful technical diagram. The user opens it by double-clicking — no install, no build, no server.

## Choose the output mode first

This skill ships **two templates**. Pick one based on what the user wants, then copy that template and edit only its config.

| Mode | Template | Use when |
|------|----------|----------|
| **Interactive explorable diagram** | [`assets/skeleton.html`](assets/skeleton.html) | The user wants a diagram they can **pan, zoom, drag, click, and explore** — system/architecture, sequence, or flow. Multi-tab, dark mode, side panels, hover-chain highlight. This is the default for "draw/visualize a diagram of …". |
| **Platform architecture poster** (static) | [`assets/platform-skeleton.html`](assets/platform-skeleton.html) | The user wants a **polished, slide-ready infographic** of a platform/product architecture — a horizontal poster on a white background with a workflow row, capability columns, an API node, and a provider bar, **exported as PNG/SVG to paste into slides/PPT**. Trigger words: "platform architecture", "平台架構", "投影片 / PPT", "infographic", "capability + provider layout", "marketing-style architecture". **No** pan/zoom/dark-mode — it is a static poster by design. |

### Route by intent — and ask when it's genuinely ambiguous

Run this check **first**, before copying any template. Do **not** silently default — a wrong guess means rebuilding the whole diagram, which costs far more than one question.

1. **Platform poster** when the request carries any *slide / marketing / poster* signal:
   `platform architecture`, `平台架構`, **`platform diagram` / `平台圖`**, `poster`, `infographic`, `one-pager`, `投影片 / 簡報 / PPT / slides / deck / pitch / board`, `capability columns`, `provider / vendor bar`, "for my deck/slides", "marketing/sales diagram". The poster is static (no pan/zoom) and exports to PNG/SVG — that is its entire reason to exist.
2. **Interactive diagram** when the request carries any *explore / engineering* signal:
   `interactive`, `explore`, `pan / zoom / drag / clickable`, `click through`, `sequence`, `flow`, `data-flow`, `hover`, or it **names concrete components/services to wire together with edges** (e.g. "API, Kafka, workers, Postgres").
   **Precedence:** an explicit *slide/poster* word (clause 1: poster / infographic / slides / deck / PPT / 投影片) is decisive for the poster even if "diagram" also appears; an explicit *interaction/sequence* word (clause 2: interactive / pan / zoom / click / explore / sequence) is decisive for the interactive mode even if "platform" also appears. Only fall through to step 3 when neither kind of explicit word is present.
3. **If neither is decisive** — bare "draw our architecture", "make a diagram of X", or **"platform diagram" / "平台圖" standing alone** (a domain noun, no slide *and* no interaction word) — **ask with `AskUserQuestion` before building**:
   - header `Diagram type`, question "Which kind of diagram do you want?"
   - **Interactive HTML** — "Pan / zoom / click to explore in the browser; best for engineering docs and walking through a system."
   - **Platform poster** — "Static, slide-ready infographic (capability columns + provider bar), exported as PNG/SVG for a deck/PPT."
   Then build the chosen mode.

> Why this rule exists: "platform diagram" reads as the poster to a human (it *is* the poster's name), but the word "diagram" alone used to fall through to the interactive default — so a poster request silently produced an explorable flowchart. Lean poster when the noun is *platform / poster / infographic / slide*; lean interactive when it's *explore / sequence / components*; otherwise ask.

The rest of this document covers the interactive mode first, then the platform poster ([jump to "Platform architecture poster"](#platform-architecture-poster-static)).

## Hard constraints

- **Pure HTML + CSS + vanilla JS only.** No React, Vue, Svelte, no build step, no npm, no bundler.
- **No CDN dependencies** unless the user explicitly opts in. The skeleton renders everything from inline SVG and DOM events — keep it that way.
  - The one acceptable exception: if the user explicitly says "use Mermaid" or "Mermaid is fine," you may include the Mermaid CDN `<script>` and layer interactivity on top.
- **One file.** All CSS in a single `<style>` tag, all JS in a single `<script>` tag, all markup in one HTML document.

## Starting point: the skeleton

Do **not** hand-write the renderer from a blank file. Start from
[`assets/skeleton.html`](assets/skeleton.html) — a complete, self-contained
baseline (theme + dark mode, toolbar, SVG defs, pan/zoom/drag, hover, side
panel, SVG/PNG export) whose headline feature is a baked-in **layout guard**.

The skeleton is a small **framework**: the AI writes a three-level structure —
**tab → container → block** — and the runtime turns it into HTML/SVG. You never
hand-write elements.

| Framework term | What it is | Renders as |
|----------------|------------|------------|
| **Tab** | a whole diagram / view | a DOM tab in the floating bar; each owns its own `<svg>` + layout-guard instance |
| **Container** | a rectangle grouping blocks (band / lane / box) | dashed SVG group rectangle with a title pill |
| **Block** | a node — one rounded rect (or diamond) inside a container | filled SVG rect, clickable, draggable |

Workflow with the skeleton:

1. Copy `assets/skeleton.html` to the output path.
2. Replace **only the `CONFIG` block** (`app`) with the real system. Each entry
   in `app.tabs` is one independent diagram. Inside a tab, give every block a
   `container` id and define the `containers` array; `x/y/w/h` are starting
   hints, not final coordinates.
3. Open it. `init()` builds the first tab, runs the guard automatically, and
   logs the audit result per tab to the console. Click **⚑ Audit overlap**
   (`⚑ 檢查重疊`) to re-check the active tab at any time; if it finds overlaps it
   offers to **auto-fix** — `autoFix()` restores the tidy built layout (snapshotted
   in `buildTab` as `tab.home`) and redraws, clearing drag-induced overlaps without
   drifting the tuned container/title placement.

> **Note on chrome language.** The built-in UI (toolbar, legend, side-panel
> headings, help modal, audit/auto-fix dialogs) ships in **Traditional Chinese
> (zh-TW)**. Diagram *content* — tab/container labels, block labels, descriptions
> — is whatever you author in the `app` config. To switch the chrome to another
> language, edit the button text in the toolbar markup, `TYPE_LABELS`, the help
> modal, and the `applyTheme`/audit strings.

### Tabs: one diagram or several

- **One system / one view → one tab.** A single-tab `app` renders with the tab
  strip hidden — it looks and behaves exactly like a plain single diagram.
- **Multiple related views → multiple tabs** (e.g. "System", "Sequence",
  "Deployment"). The tab strip appears in the floating bar automatically when
  `app.tabs.length > 1`. Each tab is built lazily on first activation and
  cached; each keeps its own pan/zoom, layout guard, and audit. Theme (light /
  dark) is shared across all tabs.

### The layout guard (`makeLayout(tab)`)

Each tab gets its own guard instance via `makeLayout(tab)`. It checks distance /
non-overlap across the **four element categories** a diagram is built from, and
resolves collisions:

| Category | What it is | Resolver |
|----------|------------|----------|
| `block`     | block rectangles / diamonds | `resolveBlocks()` — BFS pin-settled push-apart **within each zone**, ≥40px clearance |
| `label`     | text riding on arrow (edge) lines | `resolveLabels()` — slides each label along its own curve to a spot the audit accepts |
| `title`     | container captions | `titleBox()` places each in the reserved caption strip of its own zone |
| `container` | **zones** grouping blocks | `packUnits()` — zones (and free blocks) pack as rigid units from the **top-left corner**, never overlapping |

The resolver is **two-level**: blocks settle inside their zone first, then whole
zones — plus every free block — pack as rigid units with ≥48px zone-to-zone
clearance, and the finished layout is normalized so its bounding box starts at
the top-left origin `(60, 60)`. Containers are **optional**: omit the
`containers` array (or leave a block's `container` unset) and those blocks pack
as standalone units alongside the zones. A block naming an unknown container id
logs a `console.warn` and is treated as free.

Two entry points (on each tab's `layout`):

- **`layout.run()`** — call on the *data* before rendering: settles blocks
  inside each zone, packs zones from the top-left, then grows containers around
  their members. (`buildTab()` already does this.)
- **`layout.audit()`** — walks every conflicting category pair and returns
  `{ ok, count, conflicts[] }`, logging a `console.table` tagged with the tab id.
  **Zones must not overlap**: container×container overlap is a `zone-overlap`
  conflict and a block sitting on a foreign zone is a `foreign-block` conflict.
  The one sanctioned crossing is **band×lane** (a grid cell *is* the crossing
  region), which also exempts the crossing band's blocks and title against that
  lane (see `POLICY.isConflict`). A block inside its *own* container and a title
  captioning its *own* container are by design. Blocks that spill *outside*
  their declared container are reported separately as `spill`.

`layout.resolveLabels()` runs on the DOM after render (labels need measured
positions); everything else runs on the in-memory tab data. Geometry primitives
(`measureText`, `penetration`, `overlaps`, `contains`) are exposed for custom
layouts. **Before handing over the file, confirm the console shows
`✓ Layout audit [<tab id>]: no overlaps` for every tab** — if it logs conflicts,
adjust the starting hints or container membership and reload.

## The config you edit

The skeleton's `<script>` is already organized into commented sections — `CONFIG`, `RENDER`, `INTERACTIONS`, `EXPORT`, `INIT`. You touch **only `CONFIG`**; leave the rest alone unless the user asks for a genuinely new capability. Keep `CONFIG` self-contained and first in the script so the user can later edit just that object to change the diagram. The shape:

```js
const app = {
  title: "Diagram",
  tabs: [
    {
      id: "system",                       // unique; used as cache key + svg/png filename
      label: "System",                    // caption shown in the tab strip
      type: "system" | "sequence" | "flow",

      containers: [                        // OPTIONAL — the zone rectangles
        { id, label, orient, color, title },
        // a container is a ZONE grouping the blocks of one layer / system /
        // module; zones never overlap each other (band×lane crossing excepted)
        // orient: "band" (horizontal stripe) | "lane" (vertical column) | "box" (free)
        // title.side: "above" | "left" | "top"
      ],

      blocks: [                            // the nodes
        { id, container, label, type, x, y, w, h, description, tech, responsibilities },
        // container = id of the zone this block belongs to; omit it (or omit
        // `containers` entirely) and the block packs as a FREE unit
        // type drives the color (client / http / worker / infra / queue / db / external)
      ],

      edges: [
        { from, to, label, style, bendDir },
        // style: "sync" | "async" | "dashed"; bendDir: 1 | -1 to bow parallel edges apart
      ],

      // For type: "sequence" tabs, use `actors` + `messages` instead of
      // containers/blocks/edges:
      actors: [
        { id, label, type },               // vertical lifelines, left→right in array order
      ],
      messages: [
        { from, to, label, style, description, tech, responsibilities, activate, deactivate },
        // from === to → self-loop; from !== to → cross arrow
        // activate: true opens an activation bar on the receiver (`to`)
        // deactivate: true closes the activation bar on the sender (`from`)
        // flags are explicit (no auto-inference); re-entrant activations on the
        // same actor merge into one bar; an unclosed bar runs to the bottom box
      ],
    },
    // …add more tabs for additional views; the tab strip appears automatically
  ],
};
```

For a single diagram, use exactly one entry in `tabs` — the tab strip stays
hidden and the file behaves like a plain single diagram.

## What the skeleton already gives you

The renderer, theme, and every interaction below ship in the skeleton — you don't build them. Your job is to author config so each one carries meaning (real chains to highlight, real descriptions in the panel, sensible node types for color). The behaviors, for reference:

- **Hover** a node → highlights its whole connected **chain** (everything upstream that reaches it plus everything downstream it reaches), dimming the rest. `chain()` computes it, `highlight()` applies it.
- **Double-click** → pins that chain so it persists; double-click again (or click another node) to clear. Hover still previews while pinned (`state.pinned`).
- **Click** → a side panel slides in with the node's label, type, description, tech, and responsibilities.
- **Pan** by dragging empty canvas; **zoom** by wheel/pinch with `+`, `−`, and **Fit to screen** in the toolbar.
- **Drag nodes** to reposition (edges follow); nodes are clamped to the viewport.
- **Help** modal documents every interaction; close via X, backdrop, or `Esc`.
- **Sequence step mode** (`type: "sequence"` only) → Prev/Next reveal messages one at a time along the lifelines.
- **Dark mode**, **Download SVG**, and **Download PNG** (2× raster) all from the toolbar.

The diagram renders as **inline SVG** (interactive, scalable, exportable — not Canvas), with rounded nodes, soft shadows, curved/orthogonal edge routing, a per-`type` color legend, and a system font stack. The aesthetic target is clean and modern — think Linear, Vercel, or Stripe docs.

## What you author, and why it matters

The skeleton handles geometry; you handle meaning. Two things are yours to get right:

- **Container membership and starting hints.** A container is a **zone** — an area grouping the blocks of one layer / system / module — and it is **optional**: blocks without a `container` (or a tab with no `containers` at all) pack as free units alongside the zones. `x/y/w/h` are *hints*, not final coordinates — `layout.run()` settles blocks inside their zone, packs zones from the top-left corner so nothing overlaps, and grows containers around their members. Group blocks the way the system actually decomposes (by tier, lane, or stage) so the auto-layout has a sensible starting shape to refine.
- **Node `type` and content.** `type` drives color, so pick the one that reflects each node's role (client / http / worker / infra / queue / db / external). Fill `description`, `tech`, and `responsibilities` — an empty panel is a dead click.

Pick the diagram `type` from what's being described: `system` for services and data stores, `sequence` for time-ordered messages between actors, `flow` for decision/process flows. If the request is ambiguous — missing components, unclear flow direction, unclear sync vs async — ask before inventing components.

For `sequence` tabs, mark `activate`/`deactivate` on messages where an actor is doing active work — the renderer draws a UML-style activation bar on that actor's lifeline spanning the marked rows.

## Before you hand it over

The layout guard does the overlap work; your job is to confirm it succeeded and that the content reads well. Open the file and check:

- The console shows `✓ Layout audit [<tab id>]: no overlaps` for **every** tab. If a tab logs conflicts, adjust that block's container membership or starting hints and reload — don't ship overlaps.
- Every node's panel has real content, the chain highlight follows the true flow, and the legend matches the node types you used.
- Dark mode, Fit to screen, and both exports work.

If the audit can't clear a stubborn tab on its own, the **⚑ Audit overlap** → auto-fix button restores the tidy built layout; reach for it before hand-tuning coordinates.

---

## Platform architecture poster (static)

A second template for a **static, slide-ready** architecture poster — the kind you paste into a deck. It is **not** interactive: no pan/zoom/dark-mode/panels. The headline feature is a clean horizontal layout that exports crisply to **PNG (for PPT)** and **SVG**, with a white background and white padding so it drops onto any slide.

### Starting point

Copy [`assets/platform-skeleton.html`](assets/platform-skeleton.html) to the output path and edit **only the `config` object** at the top of the script. A worked example lives at [`samples/platform-architecture.html`](samples/platform-architecture.html).

The poster is **composable**: `config.sections` is an ordered list. Each entry is rendered top-to-bottom and joined to the next by a connector. To change the picture, **add / remove / reorder sections** or edit their data — the layout restacks and the artwork height (and `viewBox`) recompute automatically. The chrome (export buttons, **⚑ 檢查溢出／重疊** audit button, hint) ships in **zh-TW**; all diagram text lives in `config`, so it is fully localizable.

### Config shape

```js
const config = {
  meta: { title, hint, width: 1440, pad: 30, margin: 40, gap: 28,
          accent: "#3b6fe0", fileName: "platform-architecture" },
  sections: [ /* ordered; each has a `type` and, optionally, a `connect` */ ],
};
```

`connect` on a section selects the connector drawn in the gap **below** it.

### Section types

| `type` | Renders | Key fields |
|--------|---------|------------|
| `workflow-row` | a row of horizontal step cards joined by `>` arrows | `items: [{ ic, t }]` (icon name + label) |
| `platform-panel` | brand block (left) + inner white card of capability columns + an optional memory row | `brand: { name, sub, grad:[c1,c2] }`, `capabilities: [{ ic, tint, col, h, en, d:[lines], paren }]`, `memory: { ic, col, h, en, d, pills:[…] }` (omit `memory` to drop the row) |
| `api-node` | a small circular hub node | `label` (string or `[line1, line2]`), `color` |
| `provider-bar` | a bar with a brand on the left + provider chips on the right | `brand: { ic, h, sub, col }`, `items: [{ name, logo, g } | { name, more:true }]` (`more:true` renders a dashed "＋ …" placeholder) |

### Connector types (`connect`)

| value | draws |
|-------|-------|
| `arrows-down` | short down-arrow stubs under each card (workflow → next) |
| `dashed-converge` | dashed curves converging from across the section's bottom to the next section's top anchor (→ api-node) |
| `dashed-line` | a straight dashed line between the two anchors |
| `none` (default) | gap only |

### Icons

Icons are a small inline **Lucide** (MIT) set in the `LUCIDE` map (`scan`, `edit`, `upload`, `report`, `plug`, `flow`, `agent`, `db`, `sparkles`, `check`). To add one, paste its 24×24 inner markup as a new `LUCIDE` entry and reference it by key. An unknown icon name logs a `console.warn` and renders nothing.

### Overflow & overlap audit

The poster has a **layout audit** — the static-poster analogue of the interactive skeleton's [layout guard](#the-layout-guard-makelayouttab). Because sections stack deterministically top-to-bottom, the failure modes aren't free-form collisions but: **(1) text wider than the box it sits in** (a capability header or description line, a workflow card label, a provider chip name, the brand caption, the pills row, the API-node label) and **(2) sibling boxes packed so tight they overlap** (too many provider chips, too many workflow cards). The audit detects both:

- Each renderer records what it draws into a per-build collector (`ctx.audit`): `audit.box(id, group, …)` registers a rectangle for sibling-overlap checks; `fitText(audit, …)` registers that a string must stay inside an owner box (horizontal containment, measured with a canvas `measureText` against the real font).
- `evalAudit()` walks the records and returns `{ ok, count, conflicts[] }`. It runs **automatically on load** — logging `✓ 版面檢查：無溢出或重疊` or a `console.table` of conflicts, and updating the toolbar hint with a pass/fail badge.
- **⚑ 檢查溢出／重疊** re-runs it on demand. If the layout is clean it just confirms so; if it finds conflicts it **paints red dashed overlays** on each offender (red = text overflow, magenta = box overlap) and **offers to auto-fix** in the same dialog (OK = auto-fix, Cancel = keep the overlays). Click the button again to clear the overlays. Overlays are never baked into a PNG/SVG export.
- **Auto-fix** (offered from that ⚑ dialog — no separate button) is the static-poster analogue of the interactive skeleton's auto-fix. `autoFix()` re-runs `build()` + `evalAudit()` in a loop against two safe levers until the audit passes (or caps are hit): **(1)** it grows `config.meta.width` (overlaps and any overflow whose owner scales with width — capability columns, the memory row, workflow cards — ease as the artwork widens, with no font-size change); then **(2)** once width is capped (1.7×) it lowers a global text **`SCALE`** (consulted by both `tx()` and `measureText()`, so the audit always matches what is drawn) to shrink every glyph uniformly and clear overflow on **fixed-size owners** (chip names, the API-node label, the brand caption). It mutates `config.meta.width` + `SCALE` and re-renders, so PNG/SVG exports pick up the fixed layout. If a single token is simply longer than its box, auto-fix reports what it could not resolve and leaves the red overlay — shorten that one string by hand.

**Before handing over, confirm the console shows `✓ 版面檢查：無溢出或重疊`.** If it reports conflicts, run **⚑ 檢查溢出／重疊** and accept the auto-fix offer (or shorten the offending text / reduce item counts and reload) — don't ship overflow. To audit a new element, call `fitText(...)` (text) or `ctx.audit.box(...)` (rectangle) from your renderer; everything else is automatic. The inline capability `en` tag is intentionally **not** audited (its X is a rough heuristic, so bounding it would be noisy).

### Extending the framework

- **New section type:** add a renderer to the `SECTIONS` registry keyed by the type name. It receives `(sec, ctx)` — `ctx = { x, y, w, cx, W, M, accent, audit }` (content box + artwork center + the [layout-audit](#overflow--overlap-audit) collector) — and must return `{ height, svg, topPort:{x,y}, bottomPorts:[{x,y}…] }`. The ports are where connectors attach; register any text/boxes you draw with `audit` so the overflow/overlap check covers them.
- **New connector:** add a function to the `CONNECTORS` registry keyed by name; it receives `(fromPorts, toPort, cctx)` (`cctx = { x, w, cx, fromY, toPort }`) and returns an SVG string.
- Reuse the helper vocabulary: `icon()`, `tx()`, `pill()`, `glassTile()`, `iconBox()`, `gloss()`, and the shared `DEFS` gradients/filters.

### Poster quality checklist

Before handing over, open the file in a browser and confirm:

- [ ] **Layout audit passes** — the console shows `✓ 版面檢查：無溢出或重疊` and the toolbar hint reads `✓ 版面 OK`. If it reports conflicts, click **⚑ 檢查溢出／重疊** and accept the auto-fix offer to auto-resolve them (or shorten the text / reduce item counts and reload). See [Overflow & overlap audit](#overflow--overlap-audit).
- [ ] **Text fits its box** — capability lines, card labels, chip names, brand caption, and the pills row don't spill outside their rectangles (the audit catches these).
- [ ] **Sections don't overlap** and connectors land on the right anchors (arrows under cards, dashed curves into the API node, dashed line into the bar).
- [ ] **White export padding present** — the artwork isn't flush to the edge.
- [ ] **Export works** — `↓ PNG（貼到 PPT）` downloads a 2× PNG and `↓ SVG` downloads valid SVG with no unresolved `var(--…)`.

## Maintaining the shipped examples

Every file under `samples/` and `examples/` is a self-contained snapshot that
**embeds the template runtime it was generated from** — editing a skeleton
does *not* update them. After changing `assets/skeleton.html` or
`assets/platform-skeleton.html`, run `node scripts/regen-examples.mjs` to
splice each shipped file's authored content (its config object + `<title>`)
into the current template, then open every regenerated file and confirm its
layout audit passes before shipping.

## Deliverable

One `.html` file. Open it. It works. The user can edit the config object at the top and reload to change the entire picture — `app` for the interactive skeleton, `config.sections` for the platform poster.
