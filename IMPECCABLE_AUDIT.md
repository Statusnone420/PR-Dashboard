Starting the audit. Kicking off the static scan in parallel.

Server's up on :3000. Let me drive the app in a browser and capture screenshots.

# PR Dashboard — Full UX/UI Audit

## Anti-Patterns Verdict

**Mostly clean, with one major category-reflex failure.**

Specific tells found:

1. **First-order category reflex (P1)** — The "developer/observability tool" palette: forced dark mode (`<html class="dark">` with no light option), Zinc-950 backgrounds (`#09090b`), violet/purple accent (`#a78bfa`), Material Symbols icons everywhere. Anyone could guess this aesthetic from the category alone. The exact Shadcn/Vercel reflex. ([impeccable shared laws — AI slop test, category-reflex check](https://anthropic.skills/impeccable))
2. **Glassmorphism creeping past "rare and purposeful" (P2)** — `backdrop-filter: blur(12px)` on the inspector action strip (`styles.css:480`), `backdrop-blur-md` on inspector header (`main.js:4030`), `backdrop-blur-sm` on modal overlay (`main.js:2454`), and on the mobile nav drawer (`index.html:127`). Four surfaces is no longer "rare."
3. **Misleading `.glass-card` class name** (`styles.css:264`) — defined as just `border + bg`, no actual glass. Dead concept, real semantic noise.
4. **Em-dashes throughout** — 153 hits including UX copy strings. Shared-ban violation. (Some are JS `--` operators, but a non-trivial share are real em-dashes in user-facing strings.)
5. **`transition-all duration-200`** — applied to `.interactive-card`, `.interactive-row`, `.interactive-button`, `.metric-card`, `.action-button`, `.interactive-chip`. Animates layout properties implicitly (banned), and `ease-in-out` is the default-everywhere reflex rather than `ease-out-quart/quint/expo` from the motion laws.
6. **`linear-gradient(primary → tertiary)`** progress bar (`styles.css:437`) — not gradient text (the absolute ban), but the same reflex one tier over. Use solid color.

Not failing: no hero-metric template (the dashboard cards are functional summaries, not the SaaS cliché), no identical card grids (the bento has variety), no side-stripe borders, no `background-clip: text`.

## Audit Health Score

| # | Dimension | Score | Key Finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | **2/4** | 0 of 90+ Material Symbols icons have `aria-hidden`; every icon glyph name ("dashboard", "speed", "view_kanban") leaks into accessible names and screen-reader output. |
| 2 | Performance | **3/4** | `transition-all duration-200` everywhere, but Geist preloaded, no obvious layout thrashing. |
| 3 | Responsive Design | **3/4** | No horizontal scroll at 375px; but API limits, global search hidden entirely on mobile with no replacement; 32×32 icon-button touch targets. |
| 4 | Theming | **2/4** | Tailwind tokens defined twice (config + CSS vars), but `#0d1117`/`#1a2332`/`#378ADD`/`#534AB7`/`#5DCAA5`/`#f59e0b` hard-coded in `styles.css:956–1020`. No OKLCH. Dark-only with no token strategy for light. |
| 5 | Anti-Patterns | **2/4** | Category-reflex palette + 4 glassmorphism surfaces + em-dashes + transition-all. |
| **Total** | | **12/20** | **Acceptable — significant work needed** |

## UX Critique (heuristic, by surface)

**Dashboard.** "Configure GitHub token" hero next-action is the right shape for a first-run user. But the bento immediately below repeats four zero-state metric cards ("Saved candidates: 0", "Active board work: 0", "Resolved / Passed: 0", "Hidden Results: 0") *and then* repeats those same zeros as three full-width empty-state panels ("No saved candidates", "No active board work", "No Proof Log entries yet"). For a brand-new user, the dashboard is **eight nested zero states** stacked vertically. Heavy. Consider folding the four metric cards into the empty panels when all values are 0.

**Find Contributions.** Filters sit *above* results full-width on mobile, pushing the actual results below the fold even when results exist. Inverts the discovery → confidence flow the README advertises. The split "Find Contributions / Lookup" tab is unlabelled affordance — the tab metaphor is fine, but the active state uses the same primary-tint as the CTA Search button right below it, creating a visual fight. The "QUICK FILTERS" + "FILTERS" + "MORE FILTERS" three-tier vocabulary is one too many.

**Board.** Compact / Full Kanban toggle is a useful affordance but inherits the same button styling as everything else, so it doesn't read as a view switch. Empty board uses a single CTA card; good. Lane counts list (Considering / Read Docs / Asked Maintainer / Working / PR Open) is good information architecture — preserve this.

**Settings.** Best surface. "Local Session Storage by Default" lockup with `lock` icon + plain-English explanation is the right tone for a security-sensitive surface. "Recommended scopes" list with `check` glyphs is clear. **But** the icon glyphs read aloud as "lock", "key", "visibility", "open_in_new", "check" — the a11y bug bites hard here precisely where trust matters most.

**Profile / Proof Log / Inspector.** Not driven live in this audit (zero-state app — no saved cards to inspect). Static scan shows `inspector-overlay-drawer` is a fixed-position panel sliding from right at `60%`/`48%`/`44%`/`40%` widths; on `<md` it's full-width — reasonable. The `inspector-resize-handle` is keyboard-focusable but its only state is `:hover` / `:focus-visible` color change — no `aria-valuenow` or live region for the resulting width.

**API limits popover.** Good restraint — small, on-demand, progress bars with healthy/warning/critical levels. But `desktop-only` means **mobile users cannot see rate limits at all** even though they hit the same limits. P2.

**Tooltips.** Pure-CSS `[data-tooltip]::before` approach is clever and dependency-free, but `white-space: nowrap` + `max-width: 14rem` is contradictory (nowrap wins), and the tooltip appears on `:hover` AND `:focus-visible` — no escape, no delay, no dismiss-on-Escape. Common pattern, but not best-in-class.

## Executive Summary

- **Health: 12/20 (Acceptable).** No P0 blockers; one large systemic P1 (icon a11y) and several P2 polish items.
- **Issue counts:** P0: 0 · P1: 4 · P2: 7 · P3: 5
- **Top 5 issues:**
  1. **[P1] Material Symbols icons have no `aria-hidden`** — every icon name leaks into the accessible tree (90+ instances).
  2. **[P1] Category-reflex palette** — forced dark, Zinc/Violet, Material Symbols. Indistinguishable from generic Shadcn dev-tool.
  3. **[P1] No light-mode path** — `html class="dark"` is hard-coded; tokens duplicated across `tailwind.config.js` + `:root` with no swap mechanism.
  4. **[P1] Mobile dashboard is eight stacked zero-states** for new users — the worst first impression at the smallest viewport.
  5. **[P2] Hard-coded GitHub-y hex values** (`#0d1117`, `#1a2332`, `#378ADD` etc.) in advanced-context skeleton bypass the token system.

## Detailed Findings

### P1 — Major

**[P1] Icons read aloud by screen readers**
- **Location:** every `<span class="material-symbols-outlined">…</span>` in [src/main.js](src/main.js) (~90 hits) and [index.html](index.html) (~12 hits)
- **Category:** Accessibility
- **Impact:** A screen reader on the header button announces "speed API limits" instead of "API limits"; sidebar links announce "dashboard Dashboard", "search Find Contributions", etc. Confirmed live: `document.body.innerText` on `#find-issues` literally contains the strings `"speed"`, `"settings"`, `"notifications"`, `"view_kanban"`.
- **Standard:** WCAG 2.1 SC 1.1.1 (Non-text Content), SC 4.1.2 (Name, Role, Value)
- **Fix:** add `aria-hidden="true"` to every `span.material-symbols-outlined`. Audit shows only 4 of 92 occurrences currently have it.
- **Suggested command:** `/impeccable harden`

**[P1] Category-reflex palette / theme lock**
- **Location:** [index.html:2](index.html), [tailwind.config.js:7-33](tailwind.config.js), [styles.css:5-30](src/styles.css)
- **Category:** Anti-Pattern
- **Impact:** The product looks identical to every other Shadcn/Vercel dev tool. The README's stated identity ("local-first, transparent, decision-helping") doesn't translate to a visual signature.
- **Fix:** Either (a) commit to a distinctive identity — different hue family, different type pairing, different icon set; or (b) move the palette to OKLCH with intent (tinted neutrals, one accent ≤10%) and pick a *concrete scene sentence* per the impeccable theme law.
- **Suggested command:** `/impeccable bolder` (or `/impeccable colorize` for a smaller pass)

**[P1] No light-mode strategy, tokens defined twice**
- **Location:** [tailwind.config.js:6-34](tailwind.config.js) duplicates [styles.css:5-30](src/styles.css)
- **Category:** Theming
- **Impact:** Two sources of truth for the same palette; any token change requires editing both. `darkMode: 'class'` in Tailwind is set up but `html class="dark"` is hardcoded — the toggle infrastructure is half-built.
- **Fix:** Single source — keep CSS vars as authoritative, reference them from `tailwind.config.js`. Decide explicitly whether light mode ships or is removed.
- **Suggested command:** `/impeccable document` then `/impeccable harden`

**[P1] Mobile dashboard = eight stacked zero-states**
- **Location:** dashboard route, [main.js](src/main.js) (search the dashboard render path)
- **Category:** UX / IA
- **Impact:** A new user on a phone scrolls through "0 / 0 / 0 / 0" metric cards, then through three full-width "No X yet" panels, before reaching anything actionable. The hero CTA is the only useful thing on first run.
- **Fix:** For first-run state, collapse the metric grid and panels into one "Get started" sequence: hero → 3-step list → single Find Contributions CTA.
- **Suggested command:** `/impeccable onboard`

### P2 — Minor

**[P2] Hard-coded colors in advanced-context skeleton**
- **Location:** [styles.css:956-1020](src/styles.css) — `#0d1117`, `#1a2332`, `#378ADD`, `#534AB7`, `#5DCAA5`
- **Category:** Theming
- **Impact:** GitHub-mimicking hex values won't follow any future palette change.
- **Suggested command:** `/impeccable document`

**[P2] `transition-all duration-200` on six component classes**
- **Location:** [styles.css:269, 288, 298, 355, 416](src/styles.css)
- **Category:** Performance / Motion
- **Impact:** Animates layout properties implicitly (banned); `ease-in-out` everywhere instead of `ease-out-quart/quint/expo`.
- **Fix:** Replace with `transition: background-color, border-color, color, transform 180ms cubic-bezier(0.22, 1, 0.36, 1)`.
- **Suggested command:** `/impeccable animate`

**[P2] Glassmorphism on four surfaces (default-by-reflex)**
- **Location:** [styles.css:480](src/styles.css), [main.js:2454, 4030](src/main.js), [index.html:127](index.html)
- **Category:** Anti-Pattern
- **Fix:** Keep at most one (the modal overlay is the strongest case). Replace the inspector strips with a solid `surface-container-highest` and a real border.
- **Suggested command:** `/impeccable quieter`

**[P2] Mobile loses API limits affordance entirely**
- **Location:** [index.html:90](index.html), [styles.css:154-162](src/styles.css) (`desktop-only`)
- **Category:** Responsive
- **Fix:** Move API limits into the mobile nav drawer as a row, or surface in Settings.
- **Suggested command:** `/impeccable adapt`

**[P2] 32×32 icon button touch targets**
- **Location:** header bell + settings + avatar — [index.html:111-122](index.html)
- **Category:** Accessibility / Responsive
- **Standard:** WCAG 2.5.5 (24×24 AA, 44×44 AAA); Apple HIG / Material both recommend 44×44.
- **Fix:** Increase to `w-11 h-11` (44px) on touch viewports.
- **Suggested command:** `/impeccable adapt`

**[P2] Find Contributions filter section dominates mobile**
- **Location:** Find Contributions render path
- **Category:** UX / Layout
- **Fix:** Collapse FILTERS into an accordion on `<md`, defaulting closed. Keep QUICK FILTERS visible as a horizontal scrollable chip rail.
- **Suggested command:** `/impeccable adapt`

**[P2] Em-dashes in UX copy**
- **Location:** ~153 hits across [styles.css](src/styles.css) and [main.js](src/main.js) (mix of `—` chars and `--` JS operators — manual triage needed)
- **Category:** Anti-Pattern (copy)
- **Fix:** Replace em-dashes in user-facing strings with commas, colons, or periods. The non-string `--` JS operators are fine.
- **Suggested command:** `/impeccable clarify`

### P3 — Polish

- **[P3] `.glass-card` class with no glass effect** — rename or remove ([styles.css:264](src/styles.css)). `/impeccable distill`
- **[P3] Three-tier filter vocabulary** ("QUICK FILTERS", "FILTERS", "MORE FILTERS") — collapse to two. `/impeccable clarify`
- **[P3] Tooltip lacks Escape-to-dismiss and has contradictory `nowrap` + `max-width`** ([styles.css:736-823](src/styles.css)). `/impeccable harden`
- **[P3] Linear gradient on metric progress** — replace with solid `var(--primary)` ([styles.css:437](src/styles.css)). `/impeccable quieter`
- **[P3] `transform: translateY(-1px)` lift on every interactive card/button** is the default everywhere — saves the hover *visibility* but reads as one big monotonous wiggle. `/impeccable animate`

## Patterns & Systemic Issues

1. **Icon a11y is systemic, not local.** 90 instances, 4 fixed. A single helper (`renderIcon(name)` that always wraps in `aria-hidden="true"`) would eliminate the entire class.
2. **Token system is half-implemented.** CSS vars + Tailwind colors duplicated; `darkMode: 'class'` configured but never used; hardcoded hex values in skeleton loaders. The system needs one authoritative source.
3. **Empty/zero-states are over-explained.** Every section of the dashboard has its own zero-state mini-component. A first-run shell would let each surface assume content exists.
4. **`transition-all` + `ease-in-out` + `transform: translateY` is the universal motion vocabulary.** This is the motion equivalent of "everything is a card" — needs differentiation between affordance hovers, state transitions, and reveal animations.

## Positive Findings

- **Vanilla JS + Vite at 4.3k lines is a real choice and it works.** No framework drag, fast cold start (`Vite ready in 222 ms`), no console errors observed.
- **Security model is exemplary** — `docs/SECURITY.md`, the "Local Session Storage by Default" lockup, the "no private scopes needed" guidance. Trust-building copy.
- **Tooltip-only-on-`:focus-visible`** (not `:focus`) is the correct modern pattern.
- **Material Design 3 token *names*** (`on-surface-variant`, `surface-container-high`) bring genuine state vocabulary that most Tailwind projects lack.
- **Inspector resize handle** with `:hover` / `:focus-visible` / `.inspector-resizing` states and `touch-action: none` shows real interaction-design thought.
- **Real product proof point** in README ([TEAMMATES#13998](https://github.com/TEAMMATES/teammates/pull/13998)) — the app earned the right to its own description.
- **No horizontal scroll** at 375px on any tested route.
- **No console errors** during the walkthrough.

## Recommended Actions (priority order)

1. **[P1] `/impeccable harden`** — sweep `aria-hidden` onto every Material Symbols span; add focus-trap + Escape dismissal to modal/popover/tooltip.
2. **[P1] `/impeccable onboard`** — redesign the first-run dashboard so a new user sees a single guided path, not eight zero states.
3. **[P1] `/impeccable document`** — generate `DESIGN.md` from the current tokens, then collapse the duplicated palette into one source.
4. **[P1] `/impeccable bolder`** — break the category-reflex palette. Pick a concrete scene sentence, then a distinctive color strategy that doesn't read as Shadcn-default.
5. **[P2] `/impeccable adapt`** — mobile: surface API limits, grow icon buttons to 44×44, collapse the Find Contributions filter wall.
6. **[P2] `/impeccable quieter`** — strip three of the four glassmorphism surfaces; drop the metric-progress gradient.
7. **[P2] `/impeccable animate`** — replace `transition-all duration-200 ease-in-out` everywhere with scoped property lists and an exponential ease-out curve.
8. **[P2] `/impeccable clarify`** — em-dash pass on UX strings; collapse the three-tier filter vocabulary.
9. **[P3] `/impeccable distill`** — remove dead class names (`.glass-card`), collapse redundant zero-state copy.
10. **[P3] `/impeccable polish`** — final pass once the above land.

**Pre-flight suggestion:** run `/impeccable teach` first to write `PRODUCT.md`. The audit had to infer your register, users, and voice from the README; commands 2–4 above will be sharper with an explicit source.

> You can ask me to run these one at a time, all at once, or in any order you prefer.
>
> Re-run `/impeccable audit` after fixes to see your score improve.

Audit complete. Health **12/20 (Acceptable)** — no blockers, one big systemic a11y bug (icon glyphs leaking into accessible names), and a category-reflex palette to break out of. Suggested first move: `/impeccable harden` to fix the icon a11y across all 90 instances, then `/impeccable onboard` for the eight-zero-states first-run problem.