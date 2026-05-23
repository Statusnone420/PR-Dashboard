# PR Dashboard State

Last updated: 2026-05-23

This file is intentionally compact. Full prior implementation history was archived to [docs/archive/2026-05-23-state-history.md](docs/archive/2026-05-23-state-history.md).

## Current Status

- Active plan: PR Dashboard UX sweep in [PLAN.md](PLAN.md), completed in four verified phases.
- Completed prior plan: the Match Score full-system plan was archived to [docs/archive/2026-05-23-match-score-full-system-implementation-plan.md](docs/archive/2026-05-23-match-score-full-system-implementation-plan.md).
- Workspace: current default workspace only; no additional worktree was created.
- App shape: local-first Vite SPA with direct read-only GitHub REST API calls, no backend sync, no GitHub OAuth/App auth, no database, and no model API dependency.
- Current sweep status: all four UX sweep phases are implemented in the current default workspace. No additional worktree was created.

## Active UX Sweep Phase Log

### Phase 1 - Plan/docs/baseline contract

- Summary: PLAN.md is the active vanilla JS + Vite + Tailwind/CSS UX sweep. The docs contract now validates the active sweep instead of the archived reset-plan state. STATE.md records the active plan and the known baseline docs-contract mismatch.
- Baseline before edits: `git status --short --branch` reported `## dev...origin/dev`. `npm test` passed 215/216 with the expected pre-existing `test/docs-contract.test.js` reset-plan failure. `npm run build` passed. `git diff --check` passed.
- Verification after phase: initial rerun caught a real PLAN.md/archive-pointer mismatch, then `npm test` passed 216/216, `npm run build` passed, and `git diff --check` passed.
- Browser/screenshot verification: Vite dev server ran at `http://127.0.0.1:5173`. In-app browser checks at 1440x900 and 390x844 confirmed Dashboard, Find Contributions initial/results states, Board, Profile, and Settings render nonblank with no console errors or framework overlay. Search results rendered from an initial public GitHub query. Rate-limit and review-reminder popovers rendered, but can overlap when both are opened.
- Remaining risks: Phase 1 does not change rendered UX. Existing result cards remain chip-heavy, Find Contributions has a tall header/control stack, the old inspector has no Overview/Evidence/Action tabs yet, and popover overlap remains for the hardening phase.
- Intentional deviations: none.

### Phase 2 - Core decision flow

- Summary: Added shared app metrics, strength-first score presentation, compressed contribution cards, inspector Overview/Evidence/Action tabs, dashboard active-work previews from the shared board summary, and restrained score counter / inspector stagger / save-pop interactions. No dependencies, React, TSX, backend sync, OAuth, database, or model API dependencies were added.
- Verification after phase: `npm test` passed 219/219, `npm run build` passed, and `git diff --check` passed before this STATE.md update.
- Browser/screenshot verification: Vite dev server ran at `http://127.0.0.1:5173`. In-app browser checks at 1440x900 and 390x844 covered Dashboard, Find Contributions initial state and results cards, inspector Overview/Evidence/Action tabs, save from inspector, save from a result card, Board with the current multiple active cards, Profile, Settings token and danger areas, API limits popover, and review reminders popover. Checks found no blank screen, horizontal overflow, unreadable primary text, hidden primary action, or obvious overlap. The default inspector Overview keeps save/hide/repo/pass/open decisions above the fold at desktop width and does not show the raw issue description. Result cards and Dashboard saved previews now use strength-first score chips instead of raw percentage-first chips.
- Remaining risks: Find Contributions still has the tall header/filter stack, and at 390px the first result starts far below the top; this is the planned Phase 3 compression work. Compact Board mode for 0-3 active cards is not implemented yet, so the Phase 2 browser pass inspected the current multiple-card Board state only. The Activity route/nav does not exist yet and `#activity` still falls back to Dashboard; this is the planned Phase 3 Profile/Activity/Settings split. Token persistence copy, destructive confirmation dialogs, shared popover behavior, deeper keyboard/focus handling, Help/Feedback wiring, and shared empty states remain Phase 4 work.
- Intentional deviations: none.

### Phase 3 - Primary workflow screens

- Summary: Compressed Find Contributions header/filter/results flow, added Compact Board mode for 0-3 active cards with full Kanban still available, and split Profile/Activity/Settings responsibilities. Activity now owns Proof Log, review reminders, and personal scoring signals; Profile now focuses on identity/preferences; Settings keeps export/import/token/danger controls.
- Verification after phase: `npm test` passed 225/225, `npm run build` passed, and `git diff --check` passed before this STATE.md update.
- Browser/screenshot verification: Vite dev server ran at `http://127.0.0.1:5173`. In-app browser checks covered Dashboard, Find Contributions initial state, live multi-card Board, Profile, Activity, Settings token/danger areas, inspector Overview/Evidence/Action tabs, API limits popover, and review-reminder popover at 1440x900 and/or 390x844. Isolated Playwright fixture checks covered Find Contributions results, result-card save, inspector save, and Board with 0 and 1 active cards. Results now start at about 401px on desktop and 555px on mobile in the fixture, the GitHub query preview stays collapsed, and the one-card compact Board gives the saved card the dominant area instead of burying it in empty lanes. No blank screens, framework overlays, console warnings/errors, horizontal overflow, hidden primary actions, or obvious overlap were observed.
- Remaining risks: The compact/full Board toggle is intentionally manual after first interaction; there is no separate Auto toggle. Phase 4 still needs density utilities, clearer token persistence copy, destructive confirmation dialog coverage, popover cleanup, deeper keyboard/focus checks, Help/Feedback wiring polish, and shared empty states.
- Intentional deviations: Board 0/1-card and search-results screenshots used isolated Playwright contexts because the in-app browser did not expose mutable `localStorage` for fixture setup. The live in-app browser was still used first for normal route checks and popovers.

### Phase 4 - Polish and hardening

- Summary: Added shared density, readable-copy, empty-state, popover, and destructive-dialog CSS primitives; clarified token persistence copy; moved destructive Settings and Board clear actions behind app dialogs; required `CLEAR ALL` for full reset; tightened popover behavior; added sanitized Feedback diagnostics; kept Help compact with a first-run Find Contributions CTA; and standardized empty-state copy across Dashboard, Board, Activity, Proof Log, Hidden Results, and reminders.
- Verification after phase: `npm test` passed 229/229, `npm run build` passed, and `git diff --check` passed after implementation and again after this compact STATE.md update.
- Browser/screenshot verification: Vite dev server ran at `http://127.0.0.1:5173`. In-app browser checks at 1440x900 and 390x844 covered Dashboard, Find Contributions initial state, live multi-card Board, Activity, Profile, Help, Feedback, Settings token and danger areas, Clear All confirmation dialog, API limits popover, and review-reminder popover. Isolated Playwright fixture checks covered Find Contributions results, result-card save, inspector default Overview, inspector save, and Board with 0 and 1 active cards. The Clear All dialog focused the phrase input, kept Confirm disabled until `CLEAR ALL`, closed with Cancel, and returned focus to the Clear All button. No blank screens, framework overlays, console warnings/errors, horizontal overflow, hidden primary actions, or obvious overlap were observed.
- Remaining risks: Browser verification is Chromium-only. The in-app browser still cannot seed localStorage fixture states directly, so 0/1-card Board and fixture search states rely on isolated Playwright contexts. Live GitHub API latency and rate limits remain variable.
- Intentional deviations: Impeccable PRODUCT.md/DESIGN.md context files were absent; no new context files were created because that would be unrelated repo documentation churn, so the UI polish used the product-register guidance and the existing app style. Fixture screenshots for mutable storage states used isolated Playwright contexts for the same localStorage limitation noted in Phase 3.

## Data Boundaries

- Board, Hidden Results, Proof Log, profile metadata, preferences, and personal scoring signals stay browser-local unless exported.
- Export Local Data excludes GitHub tokens, `pr_dashboard_repo_metadata_cache_v1`, and `pr_dashboard_score_enrichment_cache_v1`.
- Inspector enrichment is lazy and inspector-only for comments, timeline, setup files, recent closed pull requests, and same-label issue history.

## Recently Completed

### Advanced Context Scan-Line Loading

- Replaced the three Advanced Context loading skeletons with the Option B scan-line state.
- Loading labels are `Fetching timeline`, `Scanning setup files`, and `Reading repo history`.
- Scan delays are `0s`, `0.4s`, and `0.8s`; resolved fade delays are `0s`, `0.1s`, and `0.2s`.
- Loading card colors are `#0d1117` background, `#1a2332` border, and `#378ADD` scan/label, with pulsing dots `#378ADD`, `#534AB7`, and `#5DCAA5`.
- Advanced Context keeps a minimum 300ms loading display before replacing cached or fresh summaries with resolved cards.
- Resolved card content remains unchanged: `Timeline inspected`, `Setup files inspected`, and `Repo history inspected`.

### Match Score v3

- Phase 1A added structured score output, confidence, mini-scores, local contribution preferences, and export/import support.
- Phase 1B added visible score diagnostics, Profile contribution preferences, inspector confidence details, and mini-score UI.
- Phase 2 added local learned feedback from board movement, saved items, completed outcomes, and hidden items.
- Phase 3 added lazy inspector-only comment enrichment and compact six-hour score enrichment caching.
- Phase 4 added lazy inspector-only timeline, setup-file, recent-PR, and same-label history enrichment.

### Documentation And Archive Sweep

- Root `PLAN.md` was reset to a ready-state pointer and the completed plan was archived.
- Root `STATE.md` was compacted and full history was archived.
- `README.md`, `docs/SECURITY.md`, and `docs/DATA_MODEL.md` were updated for current Match Score v3, Advanced Context enrichment, local storage, export/import, and API boundaries.

## Verification Baseline

- Latest implementation baseline before the docs sweep: `npm test` passed 212/212, `npm run build` passed, and `git diff --check` passed on 2026-05-23.
- Advanced Context browser smoke used mocked GitHub routes and confirmed cached and fresh inspector loading, exact scan/fade delays, exact colors, and no card-height shift at desktop and mobile sizes.
- Docs/archive sweep verification on 2026-05-23: `npm test` passed 216/216, `npm run build` passed, and `git diff --check` passed.

## Remaining Risk

- Browser rendering verification so far is Chromium-only.
- Live GitHub API latency, rate limits, repository contents, timeline event availability, and label quality can vary.
- Score and enrichment behavior remains deterministic and heuristic; no backend sync or remote merge verification exists in v1.
