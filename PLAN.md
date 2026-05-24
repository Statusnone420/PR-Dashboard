# PR Dashboard UX Polish Pass

## Context

The PR Dashboard has reached feature completeness for v1 (scoring, enrichment, board, Proof Log, activity tracking). The next gap is UX polish: the inspector — the most-used surface — has scroll-away action buttons, a too-fast loading animation that gets cut at 300ms, no manual width control on ultrawide displays, and clipping when the 3-column Advanced Context grid is squeezed at mid-resolutions. Find Contributions has visible styling inconsistency in two filter sections and an oversized hero.

These are all "polish" changes — no scoring, enrichment, storage, routing, or API contracts move. Scope intentionally kept tight (user declined a placement audit and most Find Contributions restructuring).

## Section 1: Inspector polish

### 1.1 Pin Action Center as a sub-header sticky strip

The Action Center (`Save / Hide issue / Hide repo / Refresh / Open on GitHub`) is the most-clicked region in the inspector but currently scrolls away with content. Pin it directly below the existing sticky title header as its own sticky strip — two stacked sticky rows.

- File: [src/main.js](src/main.js) `openInspector()` around lines 3990–4021 — extract the `<div class="action-toolbar shrink-0">` block out of the scrollable content region and make it a sibling of the sticky title header, with its own `sticky top-[<title-header-height>] z-10` positioning.
- File: [index.html](index.html:172) `#inspector-overlay-drawer` — the existing structure already has the title header as `sticky top-0`. The new action strip needs `sticky top-[N]` where N is the rendered height of the title header (measure in dev tools — likely ~88px given `p-6` plus single-line title; if the title can wrap, switch to a CSS variable set from a `ResizeObserver` on the title header).
- Surface: use the existing `bg-surface-dim/95 backdrop-blur-md border-b border-outline-variant` treatment so the two sticky rows feel like one chrome unit.
- Active board work alerts (closed status, hidden status, GitHub activity) remain in the scrollable area below the strip — they are state, not action.

### 1.2 Slow the Advanced Context loading animation

The scan-line keyframes are correct and visually distinctive (2s cycle with 0/0.4/0.8s per-card stagger), but the JS minimum loading hold of 300ms cuts the animation off at ~15% of one cycle. Cached repos feel like an aborted blink.

- File: [src/main.js:48](src/main.js:48) — change `ADVANCED_CONTEXT_MIN_LOADING_MS` from `300` to `1200`. The first card will see ~60% of the scan cycle, the last card ~30%. Animation still resolves quickly enough that opening multiple inspectors in a row does not feel sluggish.
- File: [src/main.js:568](src/main.js:568) `waitForAdvancedContextMinimum()` — no logic change needed; the helper already uses the constant.
- Files: [src/styles.css](src/styles.css) lines 847–1026 — keyframes, scan-line `2s`, `fadeUp` `220ms`, scan-pulse durations all stay as-is.

### 1.3 Inspector width — drag handle + better default breakpoints

Current width is `100% / md:60% / lg:48%`. On a 3440px ultrawide the inspector becomes ~1651px — way too wide, splitting the screen unevenly. There is also no user override.

- File: [index.html:172](index.html:172) — extend the className from `md:w-[60%] lg:w-[48%]` to `md:w-[60%] lg:w-[48%] xl:w-[44%] 2xl:w-[40%]`. Tighter defaults at wider breakpoints.
- File: [index.html:172](index.html:172) — add a 6px-wide drag handle element on the left edge of `#inspector-overlay-drawer`: `<div class="inspector-resize-handle" aria-hidden="true"></div>` positioned absolutely at `left: 0; top: 0; bottom: 0; cursor: col-resize`.
- File: [src/main.js](src/main.js) — add a new module `src/inspectorResize.js` (or inline into main.js if you prefer fewer new files). It binds `pointerdown` on the handle, captures pointer, updates the drawer's inline width style on `pointermove`, and on `pointerup` persists the width in `localStorage` under `pr_dashboard_inspector_width_v1` keyed by viewport width bucket (so a wide-monitor setting does not carry over to a laptop). Bounds: minimum width is `420px` (small enough this only matters on narrow laptops); maximum width is `min(80vw, viewport - 360px)` so the underlying page keeps at least 360px of usable content. If the viewport is too small for both minimums (e.g., under ~780px), fall back to the responsive breakpoint width and skip the drag handle entirely on that viewport.
- File: [src/styles.css](src/styles.css) — add `.inspector-resize-handle` styles with a subtle hover state and an `:active` state showing the resize cursor across the whole body during drag.
- On window resize: if a persisted width is now out of bounds for the current viewport, clamp on first inspector open rather than overwriting storage.

### 1.4 Advanced Context cards reflow with inspector width

Currently `grid grid-cols-1 gap-3 lg:grid-cols-3`. With the new drag handle a user can shrink the inspector below where 3 columns fit; the cards then clip badge/title text. Replace the viewport breakpoint with content-based reflow.

- File: [src/main.js](src/main.js) around line 519 — change the Advanced Context grid container className from `grid grid-cols-1 gap-3 lg:grid-cols-3` to `grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]`. Cards naturally flow 3 → 2 → 1 as the inspector narrows. No JS, no container queries.
- File: [src/styles.css](src/styles.css) — keep the existing `.advanced-context-card { min-height: 94px }` mobile rule and `min-height: 152px` at lg. The min-height behavior remains tied to viewport, which is fine because the cards can be tall regardless of column count.

## Section 2: Find Contributions polish

### 2.1 Tighten the page hero

The hero is oversized (large vertical padding, `text-3xl` heading) and dominates the page before users see results.

- File: [src/main.js](src/main.js) `renderFindIssues()` around lines 1868–1896 — reduce vertical padding (e.g., `py-12` → `py-6`), drop the heading to `text-2xl`, keep the search input and mode toggle but in a more compact arrangement. The `View GitHub query` disclosure stays.
- Search bar stays as-is per user preference (both global topbar and page hero search remain).

### 2.2 Restyle Comments and Updated Date selects

These two filter controls are bare `<select>` elements, visually inconsistent with the chip/button system used for Language, Labels, Stars, etc.

- File: [src/main.js](src/main.js) `renderFindIssues()` around the Comments and Updated Date filter sections (inside lines 1902–1994). Replace each bare `<select class="p-2">` with a small button-group or a styled select that matches the existing `.interactive-button` / chip treatment. Reuse the existing tokens — no new component class unless reuse demands one.
- File: [src/styles.css](src/styles.css) — if a new shared `.filter-select` class is needed, add it with the same surface, border, and hover treatment used by `.interactive-button` secondary variant.

### 2.3 Collapse less-used filters under "More filters"

After restyling, group Comments + Updated Date + State under a single collapsible "More filters" disclosure. Quick filters, Language, Labels, and Stars remain always-visible.

- File: [src/main.js](src/main.js) `renderFindIssues()` lines 1902–1994 — wrap the three sections in a `<details class="filter-disclosure">` element with `<summary>More filters</summary>`. Persist open/closed state in `localStorage` under `pr_dashboard_find_filters_expanded_v1` (optional but nice).
- File: [src/styles.css](src/styles.css) — add `.filter-disclosure` styling that matches the existing filter section spacing.

## Files modified

- [src/main.js](src/main.js) — inspector layout, animation constant, Advanced Context grid, Find Contributions hero/filters
- [src/styles.css](src/styles.css) — sticky action strip surface, resize handle, optional new filter-disclosure / filter-select classes
- [index.html](index.html:172) — inspector drawer classes + resize handle markup
- New (optional): [src/inspectorResize.js](src/inspectorResize.js) — drag handle behavior and width persistence

## Verification

1. **Unit/contract tests** — extend [test/ui-copy.test.js](test/ui-copy.test.js) and [test/css-contract.test.js](test/css-contract.test.js) to assert:
   - Action Center markup appears as a sibling of the title header (not inside the scrollable content)
   - `ADVANCED_CONTEXT_MIN_LOADING_MS === 1200`
   - Advanced Context grid uses `auto-fit minmax(220px, 1fr)`
   - Comments + Updated Date + State are inside a `<details>` summary block
   - The inspector drawer markup contains a resize handle element
2. **Layout smoke** — extend [test/board-layout-a1.spec.cjs](test/board-layout-a1.spec.cjs) (or add a new inspector-layout spec) to capture inspector screenshots at `1024×768`, `1366×768`, `1920×1080`, and `3440×1440` with the inspector open. Assert no horizontal overflow on the drawer, Advanced Context cards visible without clipping, Action Center visible after scrolling past 800px.
3. **Manual browser smoke** — run `npm run dev`, open the inspector from Find Contributions and Board, confirm:
   - Action Center stays pinned when scrolling the inspector content
   - Advanced Context loading visible for ~1.2s on cached repos before resolving
   - Drag handle on inspector left edge resizes smoothly; width persists across reloads
   - Shrinking inspector below ~660px reflows Advanced Context cards from 3 → 2 → 1 columns
4. **Find Contributions** — confirm hero is visibly smaller; Comments/Updated Date/State are inside the More filters disclosure; restyled selects match the rest of the sidebar visually.
5. **Gates** — `npm test`, `npm run build`, `npm run test:layout` must pass.

## Out of scope (explicitly)

- Discovery rail / personalized feed on Find Contributions
- Onboarding redesign for empty Find Contributions state
- Topbar / sidebar / global search restructuring
- Activity tab placement audit
- Settings vs Profile boundary clarification
- Hidden Results manager surfacing
- Dashboard hero stickiness
- Any change to scoring, enrichment, storage, routing, or API behavior