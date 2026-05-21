# PR Dashboard Finder v2 Spec

## Purpose

This spec is the handoff source of truth for the next implementation pass. A fresh agent should be able to implement from this file without reading the prior conversation.

The goal is to improve PR Dashboard's issue finder quality while preserving what already works and looks good. The app already feels polished on desktop and mobile. Do not redesign it. Keep the current visual language, Tailwind setup, SPA architecture, local board persistence, and token security posture.

## Product Intent

PR Dashboard helps a developer find open source issues worth contributing to, inspect the risk, save candidates, and track them on a local board.

The current app already does the core workflow well:

- Search GitHub issues from the browser.
- Save issues to a local board.
- Inspect issue details.
- Persist saved board and optional token locally.
- Work on desktop and mobile.

Finder v2 should make the search results more trustworthy. The important fixes are repo metadata, stars filtering, better fit scoring, explicit filter application, exact issue lookup, and clearer UI copy.

## Hard Constraints

- Work on the currently checked-out branch only.
- Do not create a new worktree.
- Do not add Electron.
- Do not change the core architecture.
- Do not redesign the app.
- Do not add GitHub OAuth in this pass.
- Keep current PAT/local auth behavior. Session memory remains default; remember-token localStorage remains opt-in.
- Do not introduce backend/serverless requirements for Finder v2.
- Keep GitHub API traffic read-only.
- Do not imply the app can clone, fork, or modify repositories.
- Preserve mobile quality. Every change must be checked on mobile and desktop.
- Tailwind is already installed and working. Do not reinitialize Tailwind, replace the build setup, or rewrite the app around a new component framework.

## Tailwind Implementation Guidance

Use Tailwind as the existing implementation tool, not as a reason to redesign.

Keep:

- Existing Tailwind/PostCSS/Vite build flow.
- Existing dark product UI.
- Existing semantic CSS variables in `src/styles.css`.
- Existing component vocabulary for cards, buttons, labels, inputs, and navigation.

Use Tailwind utilities for small, local refinements:

- Responsive structure, such as tighter desktop board columns and mobile-safe stacked layouts.
- Dense but readable dashboard spacing.
- Hover, focus, active, disabled, loading, and selected states.
- Status badges and score chips that use the current semantic tokens instead of generic gray/green/purple palettes.
- Mobile-first visibility rules when a detail is noncritical on small screens.

Do not:

- Add a light mode in this pass.
- Replace the current palette with generic Tailwind gray colors.
- Add analytics metric cards, velocity charts, reviewer tables, or team PR workflow features. Those are out of scope for Finder v2.
- Add decorative animation. Motion should only communicate state.
- Rewrite `src/styles.css` wholesale. Keep changes targeted.

Production CSS size should stay controlled by the current Tailwind build. Verify with `npm run build`; no special purge/JIT migration is needed.

## Branding

The visible product name is exactly **PR Dashboard**.

Remove visible "Obsidian Workbench" branding from:

- Page title.
- Sidebar brand.
- Mobile drawer brand.
- Header/mobile brand text.
- Any visible empty state, settings copy, labels, titles, or tooltips.

"Obsidian" may remain only in old internal design reference files if those files are clearly historical design artifacts.

## Finder Modes

Add a two-option mode control near the search input:

- **Find Contributions**
- **Lookup**

### Find Contributions

This is the default mode.

Use it when the user wants to discover contribution candidates. It applies contribution-oriented filtering and scoring:

- Open issues only by default.
- `archived:false`.
- Selected beginner labels.
- Comments cap.
- Updated date filter.
- Optional unassigned filter using `no:assignee`.
- Repo metadata hydration.
- Local stars filtering after hydration.
- Fit score sorting and display.

Default query shape:

```text
is:issue state:open archived:false
```

If beginner labels are selected, preserve GitHub label OR syntax:

```text
label:"good first issue","help wanted"
```

Do not use `stars:>=...` as the only stars mechanism. Issue search results do not include reliable repo star metadata. Stars must be applied after repo hydration.

### Lookup

Lookup is for known issues, repos, titles, issue numbers, or URLs.

Lookup must not apply beginner labels, stars, comments cap, updated date, or fit-score filtering unless the user explicitly enables filters for Lookup. The default should be broad and literal.

Exact fetch support:

- Pasted GitHub issue URL: `https://github.com/openai/codex/issues/19464`.
- Compact reference: `owner/repo#123`.
- Bare issue number: `#123`, only when a repo context is available from the current query/session.

Exact fetch must use:

```text
GET https://api.github.com/repos/{owner}/{repo}/issues/{number}
```

Lookup results may still be saved, but if an issue is closed, assigned, high-comment, missing beginner labels, stale, or otherwise risky, show:

```text
Not a contribution candidate
```

Saving a risky Lookup result should warn the user in the UI before or during the save action. Do not block saving entirely.

## Filters And Query Behavior

Add an **Apply Filters** button near the filter panel.

Filter controls should update draft state only. Changing a checkbox, label chip, radio option, dropdown, or sort mode must not immediately call GitHub.

Search may run only from:

- Search button.
- Enter in the search box.
- Preset buttons.
- Apply Filters button.
- Exact Lookup fetch.

Show a visible "filters changed" state when draft filters differ from the last applied filters. The state can be a small badge or text near Apply Filters.

GitHub Query Preview remains visible and read-only. No raw query editing in this pass.

The preview should show the draft query that will be applied. After a search runs, the applied query and visible results should match.

Keep support for:

- Language.
- Label OR and label AND if existing.
- Comments.
- Updated date.
- Include closed, when explicitly selected.
- `no:assignee`, if the unassigned filter is added.

## Repo Metadata Hydration

GitHub issue search results include `repository_url`, but do not include enough repo stats for star display, star filtering, or scoring.

After search results arrive, hydrate unique repositories with:

```text
GET https://api.github.com/repos/{owner}/{repo}
```

Hydrate at least:

- `stargazers_count`
- `forks_count`
- `open_issues_count`
- `pushed_at`
- `archived`
- `disabled`
- `default_branch`
- `language`
- `topics`, when available

Cache policy:

- Cache by `full_name`.
- Use in-memory cache for the current session.
- Use localStorage cache with a 24 hour TTL.
- Cap network concurrency at 4.
- Do not refetch cached repos unless TTL expired or force refresh is explicit.
- Never cache tokens or Authorization headers.

Behavior:

- Issue cards show real repo stars and forks after hydration.
- Score logic uses hydrated repo metadata.
- Stars filter applies locally after hydration.
- If hydration fails for a repo, keep the issue visible but mark repo metadata as unavailable. Do not crash the search.

## Match Score v2

Extract scoring into a testable module. Do not keep score logic buried inside rendering.

Closed issues always score `0`.

Score categories:

- `85-100`: Strong candidate.
- `70-84`: Good candidate.
- `50-69`: Maybe / inspect first.
- Below `50`: Risky / likely pass.

Bonuses should favor realistic first contributions:

- Beginner labels such as `good first issue` or `help wanted`.
- Docs, README, typo, config, or small cleanup scope.
- Clear expected behavior.
- Clear task list.
- Low comment count.
- Unassigned.
- Updated recently.
- Repo pushed recently.
- Healthy hydrated repo metadata.

Penalties should catch bad beginner targets:

- Closed issue.
- Assigned issue.
- Too many comments.
- Too old.
- Stale, blocked, duplicate, or wontfix labels.
- Archived or disabled repo.
- Vague issue body.
- Large or ambiguous scope.
- Meta, marketing, community, or growth issues.

Explicitly penalize text like:

- `grow to 1000 stars`
- `add good first issues`
- `starter issues board`
- `contributors wanted`
- `roadmap`
- `community onboarding`
- `project is bigger than me`
- `growth`

Inspector must show:

- "Why this score?"
- Signed score rows, such as `+12 Low comment count` or `-25 Meta/growth issue`.
- Pass reason chips when relevant:
  - Too vague
  - Too old
  - Too many comments
  - Meta/growth issue
  - Too complex
  - Assigned
  - Repo setup risk

Lookup mode should still compute and display risk, but should not hide exact results just because they score poorly.

## Action Plan Copy

Replace fork/clone-style language with beginner recon language.

Default checklist for new or unsaved issues:

- Read README.
- Read CONTRIBUTING.md.
- Check install/test command.
- Identify likely files.
- Open issue discussion.
- Decide attempt/pass.

Do not imply the web app can clone, fork, run tests, or submit PRs.

Preserve existing board progress where possible. If migrating old default checklist labels, only migrate known defaults such as:

- Fork repository.
- Clone repository.
- Setup local environment.
- Draft PR for feedback.

Do not rewrite user-customized checklist items.

## Board Spacing

The board currently works but has too much horizontal scrolling on desktop. Tighten it without changing board behavior.

Allowed changes:

- Slightly narrower kanban columns.
- Smaller horizontal gaps.
- More efficient card padding.
- Preserve readable card titles and controls.

Do not:

- Remove columns.
- Change board persistence.
- Change drag/move semantics.
- Hide critical actions.
- Break mobile layout.

## Header Actions

The gear and avatar may continue to open Settings. That is coherent because both are account/config affordances.

The bell must not route to Settings.

Do not build fake notifications in Finder v2. There is no real notification source yet. Recommended v2 behavior:

- Hide the bell, or
- Render it disabled with a tooltip/title like `Notifications are not available yet`.

Do not add a notification panel unless a real notification data source is defined in a separate spec.

## Visual Preservation Rules

The app already looks strong. Changes should feel like a product-quality refinement of the same app, not a new app.

Preserve:

- Dark, high-contrast product UI.
- Existing card/button/select visual vocabulary.
- Current Tailwind setup.
- Current mobile navigation quality.
- Existing saved-board workflow.
- Existing inspector drawer pattern.

Avoid:

- New color palette.
- New layout system.
- Marketing-style hero treatment.
- Decorative gradients/orbs.
- Large typography changes.
- Nested cards.
- Excess animation.

Native select options must be readable in dark mode without hover. Add explicit option background and text styles if needed.

## Screenshot Validation Requirements

Before implementation, capture baseline screenshots or use the existing `qa_screenshots` as baseline references.

After implementation, capture screenshots for:

- Dashboard.
- Find Issues, initial state.
- Find Issues, Find Contributions results.
- Find Issues, Lookup exact issue result.
- Board.
- Settings.
- Inspector open from a search result.
- Inspector open from a board card.
- Mobile Find Issues.
- Mobile Lookup result.
- Mobile Board.
- Mobile Settings.

Required viewport set:

- Desktop: `1920x1080`.
- Wide desktop: `3440x1440`.
- Mobile: `390x844`.
- Mobile small: `375x667`.

Validation criteria:

- No horizontal page overflow on mobile.
- No incoherent text overlap.
- No clipped buttons or unreadable select options.
- Sidebar/topbar branding reads PR Dashboard.
- Finder mode control is visible and understandable.
- Apply Filters state is visible when filters changed.
- Query Preview remains readable and read-only.
- Results cards still show Save, Inspect, GitHub link, score, comments, stars/forks.
- Lookup risky warning is visible when applicable.
- Inspector score breakdown and pass chips are readable.
- Board requires less horizontal scrolling than before on desktop.
- Mobile navigation still works and does not feel downgraded.

If screenshots show the UI moving farther from the current polished app, stop and adjust before continuing.

## Test Requirements

Add or update tests for:

- Finder mode defaults.
- Lookup URL parsing.
- Lookup `owner/repo#number` parsing.
- Exact issue fetch URL construction.
- Lookup risky warning classification.
- Filter changes do not search until Apply/Search/Enter/preset.
- Query preview matches applied query.
- Label OR syntax remains correct.
- `archived:false` in Find Contributions default query.
- `no:assignee` when unassigned filter is active.
- Repo metadata hydration parses `stargazers_count`.
- Repo metadata cache TTL behavior.
- Stars filter works after hydration.
- Meta/growth issues are penalized.
- Closed issues score `0`.
- Select readability CSS is present.

Run:

```text
npm test
npm run build
```

Manual smoke:

- Search `first issue`.
- Quick Wins.
- Apply Filters.
- Stars filter.
- Lookup exact URL such as `https://github.com/openai/codex/issues/19464`.
- Save issue.
- Refresh board.
- Inspect score breakdown.
- Confirm no token leakage in console, DOM, query strings, or screenshots.
- Confirm `node_modules` is untracked.

## STATE.md Update

After implementation, update `STATE.md` with:

- What changed.
- Tests run.
- Build result.
- Screenshot validation summary.
- Whether repo stars now show correctly.
- Exact score formula summary.
- Known remaining issues or risk.

## Final Response Requirements

Final implementation response must include:

- Files changed.
- Tests run.
- Build result.
- Screenshot validation result.
- Whether repo stars now show correctly.
- Exact score formula summary.
- Known remaining issues.
