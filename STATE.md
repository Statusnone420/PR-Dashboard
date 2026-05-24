# PR Dashboard State

Last updated: 2026-05-23

This file is intentionally compact. Full prior implementation history was archived to [docs/archive/2026-05-23-state-history.md](docs/archive/2026-05-23-state-history.md).

## Current Status

- Active plan: none. The completed Match Score full-system plan was archived to [docs/archive/2026-05-23-match-score-full-system-implementation-plan.md](docs/archive/2026-05-23-match-score-full-system-implementation-plan.md).
- Workspace: current default workspace only; no additional worktree was created.
- App shape: local-first Vite SPA with direct read-only GitHub REST API calls, no backend sync, no GitHub OAuth/App auth, no database, and no model API dependency.
- Next work: ready for the next user-provided UX sweep plan.

## Current Product Behavior

- Find Contributions searches public GitHub issues and ranks them with deterministic Match/Fit Score signals.
- Profile stores local contribution preferences and learned feedback summaries.
- Board, Hidden Results, Proof Log, profile metadata, contribution preferences, and learned feedback are browser-local app data.
- Inspector enrichment is lazy and inspector-only. It can inspect issue comments, issue timeline, repo setup files, recent closed pull requests, and same-label issue history.
- Advanced Context cards now show the scan-line loading treatment on every newly opened inspector, including cached issues, then resolve with staggered `fadeUp` cards.

## Local Storage And Export

- Export Local Data includes board cards, hidden keys, Proof Log entries, profile metadata, contribution preferences, and learned feedback.
- Export Local Data excludes GitHub tokens, `pr_dashboard_repo_metadata_cache_v1`, and `pr_dashboard_score_enrichment_cache_v1`.
- Clear Token/Settings clears token state, local profile identity, rate-limit state, and score enrichment cache while preserving board cards, hidden keys, Proof Log, preferences, and learned feedback.
- Clear All App Data removes board cards, hidden keys, Proof Log, profile metadata, contribution preferences, learned feedback, repo metadata cache, score enrichment cache, and token/settings state.

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
