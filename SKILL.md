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

Workflow with the skeleton:

1. Copy `assets/skeleton.html` to the output path.
2. Replace **only the `CONFIG` block** (`diagram`) with the real system. Give
   every node a `sector` id and define the `sectors` array; `x/y/w/h` are
   starting hints, not final coordinates.
3. Open it. `init()` runs the guard automatically and logs the audit result to
   the console. Click **⚑ Audit overlap** to re-check at any time.

### The layout guard (`Layout`)

The skeleton checks distance / non-overlap across the **four element
categories** a diagram is built from, and resolves collisions:

| Category | What it is | Resolver |
|----------|------------|----------|
| `node`   | block rectangles / diamonds | `resolveNodes()` — push-apart loop, ≥40px clearance, axis of least resistance |
| `label`  | text riding on arrow (edge) lines | `resolveLabels()` — vertical nudge so label boxes never collide |
| `title`  | section / band / swimlane captions | `titleBox()` places each in clear margin outside its sector |
| `sector` | container rectangles grouping nodes | `fitSectors()` grows each to contain its members + padding |

Two entry points:

- **`Layout.run()`** — call on the *data* before rendering: pushes nodes apart,
  then grows sectors around them. (The skeleton's `init()` already does this.)
- **`Layout.audit()`** — walks every conflicting category pair and returns
  `{ ok, count, conflicts[] }`, logging a `console.table`. **Containment is not
  a conflict**: a node inside its sector, a title captioning its sector, and
  bands crossing swimlanes are all by design (see `Layout.POLICY.isConflict`).
  Nodes that spill *outside* their declared sector are reported separately.

`Layout.resolveLabels()` runs on the DOM after render (labels need measured
positions); everything else runs on the in-memory `diagram` data. Geometry
primitives (`measureText`, `penetration`, `overlaps`, `contains`) are exposed
for custom layouts. **Before handing over the file, confirm the console shows
`✓ Layout audit: no overlaps`** — if it logs conflicts, adjust the starting
hints or sector membership and reload.

## Required structure of the generated file

Organize the `<script>` into clearly commented sections, in this order:

```
// === CONFIG ===     diagram data (nodes, edges) lives here, nothing else
// === RENDER ===     SVG construction, layout, edge routing
// === INTERACTIONS === hover, click, drag, pan, zoom, panel
// === EXPORT ===     SVG and PNG download
// === INIT ===       wire it all up on DOMContentLoaded
```

The `CONFIG` block must be the first thing in the script and must be self-contained, so the user can edit only that object to change the diagram. Use this shape:

```js
const diagram = {
  type: "system" | "sequence" | "flow",
  nodes: [
    { id, label, type, x, y, description, tech, responsibilities },
    // type drives the color (service / database / queue / external / actor)
  ],
  edges: [
    { from, to, label, style },
    // style: "sync" | "async" | "dashed"
  ],
};
```

## Required features

Render with **inline SVG**. SVG is interactive, scalable, and exportable — do not use Canvas for the diagram itself.

Interactions, all of which must work:

1. **Hover** a node or edge → highlight it and its directly connected elements; dim everything else via opacity transition.
2. **Click** a node → a side panel slides in from the right showing the node's label, type, description, tech, and responsibilities. Close via an X button or by clicking the backdrop.
3. **Pan** by click-and-drag on empty canvas.
4. **Zoom** with mouse wheel and trackpad pinch. Include `+`, `−`, and "Fit to screen" buttons in a floating toolbar.
5. **Drag nodes** to reposition; edges must follow smoothly during the drag.
6. **Sequence-diagram step mode** (only when `type: "sequence"`): Prev / Next buttons that reveal messages one at a time along vertical lifelines.
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

These constraints must be satisfied before the file is handed to the user. The goal is that someone who opens the file immediately sees a clean, readable diagram — not a puzzle of overlapping boxes. When you start from `assets/skeleton.html`, the **layout guard enforces most of these automatically** (`Layout.run()` + `Layout.audit()`); the rules below explain what it does and what you still set by hand (sector membership, starting hints, edge routing).

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

One `.html` file. Open it. It works. The user can edit the `diagram` config object at the top and reload to change the entire picture.
