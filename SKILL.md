---
name: interactive-diagram
description: Build beautiful, interactive diagrams (system design, architecture, sequence, flow) as a single self-contained HTML file using only pure HTML, CSS, and vanilla JavaScript — no frameworks, no build step, no npm. Use this skill whenever the user asks to create, draw, generate, or visualize a system diagram, architecture diagram, sequence diagram, flowchart, data-flow diagram, component diagram, or any interactive technical diagram, even if they don't explicitly say "interactive" or "HTML." Also trigger when the user wants to turn a description of a system, services, components, or a process into a visual diagram they can pan, zoom, click, and explore in a browser.
---

# Interactive Diagram

Produce a single self-contained `.html` file that renders a beautiful, interactive technical diagram. The user opens it by double-clicking — no install, no build, no server.

## Hard constraints

- **Pure HTML + CSS + vanilla JS only.** No React, Vue, Svelte, no build step, no npm, no bundler.
- **No CDN dependencies** unless the user explicitly opts in. Build the renderer from scratch with inline SVG and DOM events.
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
| `block`     | block rectangles / diamonds | `resolveBlocks()` — push-apart loop, ≥40px clearance, axis of least resistance |
| `label`     | text riding on arrow (edge) lines | `resolveLabels()` — vertical nudge so label boxes never collide |
| `title`     | container captions | `titleBox()` places each in clear margin outside its container |
| `container` | rectangles grouping blocks | `fitContainers()` grows each to contain its members + padding |

Two entry points (on each tab's `layout`):

- **`layout.run()`** — call on the *data* before rendering: pushes blocks apart,
  then grows containers around them. (`buildTab()` already does this.)
- **`layout.audit()`** — walks every conflicting category pair and returns
  `{ ok, count, conflicts[] }`, logging a `console.table` tagged with the tab id.
  **Containment is not a conflict**: a block inside its container, a title
  captioning its container, and bands crossing lanes are all by design (see
  `POLICY.isConflict`). Blocks that spill *outside* their declared container are
  reported separately.

`layout.resolveLabels()` runs on the DOM after render (labels need measured
positions); everything else runs on the in-memory tab data. Geometry primitives
(`measureText`, `penetration`, `overlaps`, `contains`) are exposed for custom
layouts. **Before handing over the file, confirm the console shows
`✓ Layout audit [<tab id>]: no overlaps` for every tab** — if it logs conflicts,
adjust the starting hints or container membership and reload.

## Required structure of the generated file

Organize the `<script>` into clearly commented sections, in this order:

```
// === CONFIG ===     app data (tabs → containers, blocks, edges) lives here, nothing else
// === RENDER ===     SVG construction, layout, edge routing
// === INTERACTIONS === hover, click, drag, pan, zoom, panel
// === EXPORT ===     SVG and PNG download
// === INIT ===       wire it all up on DOMContentLoaded
```

The `CONFIG` block must be the first thing in the script and must be self-contained, so the user can edit only that object to change the diagram. Use this shape:

```js
const app = {
  title: "Diagram",
  tabs: [
    {
      id: "system",                       // unique; used as cache key + svg/png filename
      label: "System",                    // caption shown in the tab strip
      type: "system" | "sequence" | "flow",

      containers: [                        // the grouping rectangles
        { id, label, orient, color, title },
        // orient: "band" (horizontal stripe) | "lane" (vertical column) | "box" (free)
        // title.side: "above" | "left" | "top"
      ],

      blocks: [                            // the nodes
        { id, container, label, type, x, y, w, h, description, tech, responsibilities },
        // container = id of the container this block belongs to
        // type drives the color (client / http / worker / infra / queue / db / external)
      ],

      edges: [
        { from, to, label, style, bendDir },
        // style: "sync" | "async" | "dashed"; bendDir: 1 | -1 to bow parallel edges apart
      ],
    },
    // …add more tabs for additional views; the tab strip appears automatically
  ],
};
```

For a single diagram, use exactly one entry in `tabs` — the tab strip stays
hidden and the file behaves like a plain single diagram.

## Required features

Render with **inline SVG**. SVG is interactive, scalable, and exportable — do not use Canvas for the diagram itself.

Interactions, all of which must work:

1. **Hover** a node → highlight its **entire connected chain** (the full upstream flow that reaches it plus the full downstream flow it reaches, following edge direction), not just immediate neighbors; dim everything else via opacity transition. The skeleton's `chain()` computes this; `highlight()` applies it.
2. **Double-click** a node → **pin** the chain highlight so it persists. Double-click again to unpin; clicking a different node also clears the pin. While pinned, hovering other nodes previews their chain and `mouseleave` restores the pinned one (per-tab `state.pinned`).
3. **Click** a node → a side panel slides in from the right showing the node's label, type, description, tech, and responsibilities. Close via an X button or by clicking the backdrop.
4. **Pan** by click-and-drag on empty canvas.
5. **Zoom** with mouse wheel and trackpad pinch. Include `+`, `−`, and "Fit to screen" buttons in a floating toolbar.
6. **Drag nodes** to reposition; edges must follow smoothly during the drag.
7. **Help** button (`? Help`) in the toolbar → opens a modal documenting every interaction. Close via the X, the backdrop, or `Esc`.
8. **Sequence-diagram step mode** (only when `type: "sequence"`): Prev / Next buttons that reveal messages one at a time along vertical lifelines.
   Visuals:

- Modern aesthetic — clean like Linear, Vercel, or Stripe docs. No clip-art, no skeuomorphism.
- Rounded rectangles for nodes. Soft drop shadows via SVG `<filter>` (gaussian blur + offset). Subtle gradients via `<linearGradient>`.
- Distinct colors per node `type`, with a small legend pinned to a corner.
- Edges with **curved or orthogonal routing** — never just straight lines for system diagrams. Use SVG `<marker>` for arrowheads.
- Edge labels positioned along the path so they do not overlap the line itself (place on a small white/background-colored rect for legibility).
- Smooth CSS transitions for hover, panel slide, and zoom level changes.
- **Dark mode toggle** in the top-right corner. Theme via CSS custom properties (`--bg`, `--fg`, `--node-fill`, `--edge`, etc.) so toggling flips one attribute on `<html>`.
- System font stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`). Generous spacing. No cramped text.
  Export buttons in the toolbar:

- **Download SVG** — serialize the current `<svg>` and trigger a download.
- **Download PNG** — rasterize the SVG via a temporary `<canvas>` at 2× pixel ratio for crispness, then download.

## Layout quality rules

These constraints must be satisfied before the file is handed to the user. The goal is that someone who opens the file immediately sees a clean, readable diagram — not a puzzle of overlapping boxes. When you start from `assets/skeleton.html`, the **layout guard enforces most of these automatically** (each tab's `layout.run()` + `layout.audit()`); the rules below explain what it does and what you still set by hand (container membership, starting hints, edge routing).

### No overlap
Every node's bounding box must have at least **40 px of clearance** on all sides from every other node's bounding box. After computing initial `x, y` positions in the config, run a simple **collision-push loop** in the RENDER section: iterate over all node pairs, compute overlap, and push them apart along the axis of least resistance. Repeat until no pair overlaps (cap at ~30 iterations to avoid infinite loops). This means the x/y values in the config are *starting hints*, not final positions.

### Full viewport visibility
Compute the diagram's actual bounding box (min/max of all node positions + their width/height) after layout finalization, then set the SVG `viewBox` to that bounding box with **60 px of padding** on each side. This guarantees the user sees the whole diagram on first open without panning. The "Fit to screen" button should recalculate this same bounding box.

### Label containment
Node labels must fit inside their node rectangles. Measure the label string length (approximate: `label.length * 7` px for the default font, or use a canvas `measureText` call) and size the node width to be at least `label_width + 32 px`. Multi-line labels (e.g., long service names) should either wrap or expand the node height — never clip or overflow. Do not use CSS `overflow: hidden` on SVG text.

### Edge clarity
- Route edges so they don't pass through unrelated nodes. For `system` diagrams use curved Bézier paths that bow around congestion; for `flow` diagrams prefer orthogonal routing that steps around nodes.
- Edge labels must sit on a small filled background rectangle (matching the canvas background color), so they are always legible regardless of what's behind them.
- When two or more edges connect the same pair of nodes in the same direction, offset them slightly so they don't fully overlap.

### UI chrome placement
The floating toolbar, legend, and side panel must not permanently occlude diagram content. Pin the toolbar and legend to corners with a z-index above the SVG but ensure the initial viewBox computation (above) accounts for their footprint — add extra padding on whichever edges they occupy.

### Drag constraints
When the user drags a node, clamp its position so it cannot be dragged fully off the visible viewport. Nodes dragged to the edge should stop when their bounding box reaches the SVG canvas boundary.

---

## Workflow

1. **Clarify before building.** If the user's description of the system is ambiguous (missing components, unclear direction of flow, unclear sync vs async), ask focused questions first. Do not invent components.
2. **Pick a diagram type** based on what they're describing: `system` for architecture with services and data stores, `sequence` for time-ordered message exchanges between actors, `flow` for decision/process flows.
3. **Lay out nodes deliberately.** Don't dump them in a grid. For system diagrams, group by tier (client → edge → services → data). For sequences, lifelines as evenly spaced vertical columns. For flows, top-to-bottom or left-to-right with branches. These positions go in the config as starting hints; the collision-push loop in RENDER will finalize them.
4. **Write the config first**, then the renderer. The config should read like a clean summary of the system.
5. **Run the layout quality checklist before declaring done.** Go through each item below and fix any that would obviously fail:

### Pre-delivery quality checklist

Walk through this mentally (or scan your generated coordinates) before handing over the file:

- [ ] **No overlapping nodes** — every pair of nodes has ≥ 40 px clearance. The collision-push loop ran and converged.
- [ ] **All nodes visible on open** — viewBox is set from actual final positions + 60 px padding; no node is clipped at the edge.
- [ ] **Labels fit inside nodes** — node width ≥ label pixel width + 32 px; no text overflows its container.
- [ ] **Edge labels are readable** — each label sits on a filled background rect; none are directly on top of the edge line with no background.
- [ ] **Edges avoid unrelated nodes** — curved or orthogonal routes; no edge passes straight through a node it's not connected to.
- [ ] **Parallel edges are offset** — multiple edges between the same nodes are visually distinct.
- [ ] **Legend doesn't cover nodes** — legend is pinned to a corner with enough margin.
- [ ] **Dark mode works** — all colors use CSS custom properties; the toggle produces a clean, readable result.
- [ ] **Interactions work** — hover, click, drag, pan, zoom, fit, export SVG, export PNG would all function without obvious bugs.

If any checkbox would fail, fix it before handing over.

## Common pitfalls to avoid

- **Don't skip the collision-push loop.** If you place nodes by hand and don't run a pass to check and fix overlaps, some nodes will inevitably overlap, especially in dense diagrams or when there are many edges forcing nodes close together.
- **Don't set the viewBox to a fixed constant** like `0 0 1200 800`. Always derive it from the actual final node positions after layout, so nothing is cropped on first open.
- **Don't route every edge as a straight line through other nodes.** Use curved Bézier paths for system diagrams or orthogonal (right-angle) routing. Detect rough overlaps and offset.
- **Don't put edge labels directly on top of the line** — they become unreadable. Place them on a small filled background rect matching the canvas color.
- **Don't forget to update edge endpoints during node drag.** A common bug is dragging a node and the edges stay anchored to the old position. Recompute edge `d` attributes (or `x1/y1/x2/y2`) on every `pointermove` during a drag.
- **Don't use `transform: scale()` on the whole SVG for zoom** if you want crisp text and consistent stroke widths. Prefer manipulating the `viewBox` attribute.
- **Don't hardcode colors in shape attributes.** Use CSS custom properties so dark mode is a one-line flip.
- **Don't omit the legend.** If you're using color to encode node type, the user needs a key.
- **Don't size nodes smaller than their label.** Measure the label (or estimate from character count) and ensure the node rectangle is wide/tall enough to contain it cleanly.

## Deliverable

One `.html` file. Open it. It works. The user can edit the `app` config object at the top and reload to change the entire picture.
