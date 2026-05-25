# PR Dashboard State

## 2026-05-25 A11y Responsive Audit Follow-Up

- Addressed the next A11y/Responsive items from `IMPECCABLE_AUDIT.md` after the PR #15 Material Symbols `aria-hidden` fix.
- Mobile navigation now exposes GitHub API limits with a mobile drawer trigger and popover that shares the desktop rate-limit rendering path and store state.
- Mobile chrome controls now use 44px touch targets for menu open/close, Review reminders, Settings, Profile, and the mobile API-limits trigger while preserving compact desktop sizing.
- Inspector resizing now exposes slider semantics with live width values, keyboard resizing, and the existing bucketed localStorage persistence.
- CSS tooltips now wrap long text, suppress on Escape for focused tooltip hosts, and do not render visual pseudo-tooltips on coarse pointer/touch devices.
- Find Contributions now keeps Apply Filters and Quick filters visible on mobile while collapsing the detailed filter stack by default unless filters differ from defaults or draft filters are changed.
- Verification on 2026-05-25: new focused tests failed first against missing mobile API limits, missing touch-target contracts, missing mobile filter disclosure, missing tooltip suppression/wrapping, and missing inspector slider semantics, then passed after implementation. Final verification passed `node --test test/ui-copy.test.js test/css-contract.test.js test/inspector-resize.test.js`, `npm test`, `npm run build`, `npm run test:layout`, and `git diff --check`.
- Follow-up regression fix on 2026-05-25: the detailed Find Contributions filter controls were unintentionally hidden on desktop because the mobile-only wrapper used a closed native `<details>` element. Desktop now renders that disclosure open while mobile still defaults collapsed, and `test/board-layout-a1.spec.cjs` has a desktop guard for visible Language, Labels, and Stars controls.
- Remaining risk: audit score has not been recalculated; visual identity/theming, first-run dashboard zero states, motion cleanup, and glassmorphism cleanup remain separate audit follow-ups.

## 2026-05-25 Explicit Ubuntu Platform Support

- Addressed PR review thread `discussion_r3299846134`.
- Repo setup platform detection now treats explicit Ubuntu support statements such as `Supported platforms: Ubuntu and macOS` as Linux-compatible without restoring broad plain-`ubuntu` matching.
- Added regressions covering explicit Ubuntu support plus macOS support and Windows unsupported evidence, and negated Ubuntu support such as `does not support Ubuntu`. Existing incidental `ubuntu-latest` CI wording remains neutral so generic CI platform names do not turn into Linux badge/filter evidence.
- Verification on 2026-05-25: `node --test test/repo-setup.test.js` failed first on the explicit Ubuntu support case, later failed first on the negated Ubuntu support guard, then passed 11/11 after the fixes. `node --test test/repo-setup.test.js test/platform-filters.test.js test/match-score.test.js` passed 52/52, `npm test` passed 284/284, `npm run build` passed, `npm run test:layout` passed 16/16, and `git diff --check` passed.
- Remaining risk: platform compatibility parsing is still heuristic; broad badge API-cost optimization remains a separate pass.

## 2026-05-25 Platform Badge Accessibility Pass

- Addressed PR review thread `discussion_r3299791102`.
- Platform evidence chips now expose their compact icon-only labels through an explicit `role="img"` plus existing `aria-label` text such as `Linux supported`.
- Material Symbols glyph spans in `src/main.js` and `index.html` are now hidden from assistive technology so screen readers do not announce decorative icon names like `dashboard`, `speed`, or `close`. The inspector close button now has an explicit `Close inspector` accessible name before its decorative glyph is hidden.
- Verification on 2026-05-25: `node --test test/ui-copy.test.js` failed first against missing badge role, missing icon hiding, and missing inspector close label, then passed 33/33 after the fix. `npm test` passed 282/282, `npm run build` passed, `npm run test:layout` passed 16/16, and `git diff --check` passed.
- Remaining risk: this is the scoped non-text/icon accessibility hardening pass from `IMPECCABLE_AUDIT.md`; broader audit findings such as touch target sizing, tooltip dismissal behavior, palette/theming, glassmorphism cleanup, and motion cleanup remain separate future passes.

## 2026-05-25 Web Platform Detection Tightening

- Addressed PR review thread `discussion_r3299034539`.
- Tightened repo setup Web support detection so incidental setup-doc mentions of React, Vite, HTML, or CSS no longer become authoritative Web platform support. Web support now requires explicit setup context such as `web app`, `frontend app`, `browser-based`, or running/opening in the browser.
- Added repo setup regressions proving incidental frontend technology mentions do not filter/down-score Windows-targeted candidates, while explicit browser app support still produces `Web setup supported`.
- Verification on 2026-05-25: `node --test test/repo-setup.test.js` failed first on the incidental frontend mention regression, then passed 9/9 after the fix; `node --test test/repo-setup.test.js test/platform-filters.test.js test/match-score.test.js` passed 44/44; `npm.cmd test` passed 269/269; `npm.cmd run build` passed; `npm.cmd run test:layout` passed 16/16; `git diff --check` passed.
- Remaining risk: platform support parsing remains heuristic by design; ambiguous setup docs without explicit platform statements stay neutral rather than authoritative.

## 2026-05-25 Passed Hidden Provenance + Dashboard Saved Candidate Fix

- Addressed PR review thread `discussion_r3298947148`.
- `Passed` now records whether the pass action created the exact hidden issue key. Leaving or removing a `Passed` card only unhides that key when the pass action created it, so manual hides before passing and manual hides made after passing remain hidden.
- Dashboard and Profile saved-candidate metrics now count active non-final board candidates only. `Passed`, `Merged`, and closed active-lane cards remain visible through `Resolved / Passed` and Board flow, but no longer appear in the Dashboard `Saved candidates` card or preview list.
- Added store regressions for manual hide before pass, manual hide after pass, and removing a manually hidden passed card, plus dashboard/app metric regressions for excluding final/closed cards from saved candidates.
- Verification on 2026-05-25: manual red checks failed first for the hidden-provenance and dashboard saved-candidate cases; `node --test test/store-persistence.test.js` passed 23/23 after the fix; dashboard/app targeted tests passed 12/12; `npm.cmd test` passed 267/267; `npm.cmd run build` passed; `npm.cmd run test:layout` passed 16/16; `git diff --check` passed; browser smoke with a seeded single `Passed` card showed Dashboard metrics `0 / 0 / 1`, `No saved candidates`, Board flow `1 in Passed`, and no console warnings/errors. Screenshot saved outside the repo at `C:/Users/Antho/AppData/Local/Temp/pr-dashboard-passed-dashboard-smoke.png`.
- Remaining risk: existing local data from older builds cannot prove whether a pre-existing `Passed` hidden key was manual or auto-created if the card has no provenance marker. New pass/unpass flows preserve provenance going forward.

## 2026-05-24 Ship-Ready Platform Filter + Compact Board Polish

- Addressed Codex PR review comment `discussion_r3295747713`: restrictive target-platform filters now queue a bounded background setup scan for the first visible uncached candidates, so fresh Find Contributions/Lookup results can be corrected after compact README/CONTRIBUTING compatibility data is cached without opening each inspector. The scan is skipped when all platforms are selected and remains bounded to avoid scanning all 30 results.
- Fixed forced Compact Board overflow at wide desktop widths. Full Kanban keeps the locked desktop board height, while Compact mode now allows normal vertical page scrolling so many active cards plus Merged/Passed lanes remain reachable without horizontal scroll or clipped actions.
- Added focused coverage for bounded platform setup scan candidate selection and a Compact Board layout regression with many active, Merged, and Passed cards plus long titles/repo names.
- Verification on 2026-05-24: targeted platform/setup/score/store tests passed, `npm.cmd test` passed 251/251, `npm.cmd run build` passed, `npm.cmd run test:layout` passed 16/16, `git diff --check` passed, and in-app rendered smoke at `http://127.0.0.1:5179` verified fresh Windows-only search hides a Linux-only result after background setup scans and crowded Compact Board remains scrollable with no horizontal overflow.
- Remaining risk: bounded background setup scans trade extra core REST requests for better first-pass platform triage only when platform filters are restrictive. Results outside the scan limit can still remain unknown until inspected or reached by a later scan.

## 2026-05-24 Platform Filter Candidate Triage

- Added a local Target platforms filter for iOS, Android, macOS, Linux, Windows, and Web. All platforms default selected, multiple selections match by OR, the last checkbox cannot be cleared, Lookup can apply the filter, and Broaden Search resets platforms to all selected.
- Extended inspector setup enrichment to scan discovered README/CONTRIBUTING content in memory for compact platform support/exclusion signals such as Linux only, Ubuntu required, Windows not supported, and Web only. The cache stores only normalized platform booleans and short reasons, not raw setup text.
- Match Score and Contribution Brief now treat inspected platform mismatches as a strong pass signal: Setup Ease becomes Blocked, score evidence includes Target platform mismatch with the selected-platform reason, and the brief explains the setup-platform risk. Unknown compatibility remains neutral and visible until inspected.
- Made saved actions reversible from result cards and the inspector: unsaved candidates show Save/Save issue, saved candidates show Remove/Remove from board, and removing from the board does not hide the issue. Moving a board card to Passed now hides that exact issue through hidden-item storage.
- Verification on 2026-05-24: targeted platform/store/search/setup/score/brief/copy tests passed, `npm.cmd test` passed 250/250, `npm.cmd run build` passed, and `git diff --check` passed. In-app Browser smoke at `http://127.0.0.1:5178/#find-issues` verified all six platform checkboxes default selected, Windows could be left selected alone, and no console warnings/errors. Playwright screenshot smoke with mocked GitHub responses verified Windows-only filtering, inspector platform mismatch/Blocked scoring, reversible Save/Remove from board, Passed hiding exact `demo/platform-app#1`, and no console warnings/errors.
- Remaining risk: platform compatibility detection is heuristic and depends on setup docs being inspected. Rendered validation used mocked GitHub responses in Chromium and did not use a live PAT or live repository docs.

## 2026-05-24 Impeccable Context Setup

- Added root `PRODUCT.md` and `DESIGN.md` so future `$impeccable` work has explicit product strategy and current visual-system context.
- Added `.impeccable/design.json` sidecar with representative component snippets, including the accessible icon-button pattern intended for future header/settings-style controls.
- Verification: impeccable loader returned `hasProduct: true` and `hasDesign: true`, `.impeccable/design.json` parsed as JSON, and `git diff --check` passed. Remaining risk: context documents capture the current UI only; palette/category-reflex improvements remain separate future work.

## 2026-05-24 UX Polish Pass

- Implemented the scoped polish pass only: inspector Action Center is pinned under the title chrome, title height is set synchronously and watched with `ResizeObserver`, Advanced Context holds for `1200ms`, its cards use an auto-fit grid, and Find Contributions has a smaller hero plus persisted `More filters`.
- Added inspector width resizing through `src/inspectorResize.js` with bucketed `pr_dashboard_inspector_width_v1` storage, 420px/min and `min(80vw, viewport - 360px)` max bounds, desktop-only handle behavior, and open/close detach cleanup. The only other new storage key is `pr_dashboard_find_filters_expanded_v1`.
- Follow-up: inspector `Refresh this card` now force-replays the Advanced Context scan-line loading pass before resolving cached or refreshed context again.
- Updated the active/archived plan docs, kept `docs/archived/PLAN.md` clearly historical, and adjusted local scripts/Playwright web-server commands to call Vite/Playwright through `node` so Windows does not resolve `.ps1` shims during verification.
- Verification before handoff: `npm.cmd test`, `npm.cmd run build`, `npm.cmd run test:layout`, and `git diff --check`; in-app Browser smoke at `http://127.0.0.1:3000/#find-issues` opened `More filters`, verified Comments/Updated Date/State controls, persistence after reload, screenshots, and zero app console warnings/errors. Remaining risk: rendered checks are Chromium/localStorage/mocked-GitHub based, not live PAT/GitHub data.
- Follow-up PR review fix: inspector resize now clears stale inline width when the current viewport bucket has no saved width, preventing one bucket's persisted width from leaking into another. Verified with `node --test test/inspector-resize.test.js`, `npm.cmd test`, `npm.cmd run build`, and `git diff --check`.
- Follow-up PR review fix: layout smoke specs now derive their fallback target from `PR_DASHBOARD_LAYOUT_PORT`, so custom-port runs do not start Vite on one port while navigating to `3000`. Verified with `npm.cmd run test:layout` using `PR_DASHBOARD_LAYOUT_PORT=4317`, plus `npm.cmd test`, `npm.cmd run build`, and `git diff --check`.

## 2026-05-24 Inspector Advanced-First Score Evidence

- Reordered `openInspector()` again so the inspector now leads from Action center and alerts into Advanced context, comment enrichment, Contribution Brief, Issue Description, a single `Why this score?` evidence card, and Action Plan.
- Removed the standalone visible `Score diagnostics` heading/card shape from the inspector template. The merged evidence card now uses `Why this score?` as the header with the confidence badge, existing score/rating/stage subtext, confidence reasons, mini-scores, signed score rows, and pass chips.
- Updated source-order tests to slice `openInspector()` from `src/main.js`, assert marker/placeholder order against the template source, and assert the merged evidence source contains the existing confidence, mini-score, score-row, and pass-chip placeholders without the old `Score diagnostics` heading.
- Verification on 2026-05-24: `node --test test/ui-copy.test.js` failed first against the old order and heading, then passed 27/27 after the template change. `npm test` passed 232/232 and `npm run build` passed. Deterministic Chromium smoke under Vite preview opened inspectors from Find Contributions and Board with mocked public GitHub responses to verify rendered section order, confidence evidence, mini-score evidence, signed score rows, no `Score diagnostics` heading, no console/page errors, and no horizontal overflow. Screenshot verification captured nonblank drawer images at `%TEMP%\pr-dashboard-inspector-screenshots\find-inspector-drawer-advanced-first.png` and `%TEMP%\pr-dashboard-inspector-screenshots\board-inspector-drawer-advanced-first.png`.
- Additional compact Board verification on 2026-05-24 seeded six active `Considering` cards in browser localStorage only, forced Compact mode, and captured nonblank desktop/mobile screenshots at `%TEMP%\pr-dashboard-inspector-screenshots\compact-board-seeded-desktop.png` and `%TEMP%\pr-dashboard-inspector-screenshots\compact-board-seeded-mobile.png`; a separate cleared-board mobile screenshot at `%TEMP%\pr-dashboard-inspector-screenshots\compact-board-empty-onboarding-mobile.png` verified the onboarding/empty compact board state stayed inside the viewport with no horizontal overflow.
- Remaining risk: rendered smoke used mocked public GitHub responses and localStorage-only seeded board data in Chromium rather than live GitHub/PAT data. The change is template-only and does not alter score calculation, enrichment timing, storage, routing, board, token, API, or Match Score contracts.

## 2026-05-24 Inspector Readability Reorder

- Reordered `openInspector()` content so Action center and local alerts lead into Contribution Brief, Issue Description, comment enrichment, Advanced context, merged score evidence, and Action Plan.
- Merged the previous Score diagnostics and Why this score? inspector blocks into one score evidence card while preserving the score summary, confidence reasons, mini-scores, signed score rows, pass chips, and existing Match Score/enrichment contracts.
- Added stable inspector source markers and a source-order regression test that checks the template order using placeholders and verifies the merged evidence source still exposes confidence, mini-scores, `Why this score?`, score rows, and pass chips.
- Verification on 2026-05-24: `node --test test/ui-copy.test.js` failed first against the old inspector order, then passed 27/27 after the template change. `npm test` passed 232/232, `npm run build` passed, and a deterministic Chromium smoke under Vite preview opened inspectors from Find Contributions and Board with mocked public GitHub responses to verify rendered section order, confidence evidence, mini-score evidence, signed score rows, no console/page errors, and no horizontal overflow.
- Remaining risk: rendered smoke used mocked public GitHub responses in Chromium rather than live GitHub/PAT data. The change is template-only and does not alter score calculation, enrichment timing, storage, routing, board, token, API, or Match Score contracts.

## 2026-05-24 UX Salvage From TEST-UX

- Salvaged the narrow `TEST-UX` improvements onto `dev` without merging the branch wholesale. Added the Activity route/nav item, kept Profile focused on identity/local contribution preferences, moved Proof Log, Review reminders, and learned feedback into Activity, and left export/import/reset controls in Settings.
- Added session-local Board view switching with auto Compact mode when active non-closed board work is three cards or fewer, plus a Full Kanban toggle that preserves the existing A1 board layout. Compact mode shows a dense active-card list with lane, exact `% Match`, confidence, next move, Pass, move-forward, and Inspect actions.
- Reduced Find Contributions card noise while preserving exact score visibility: cards now keep `% Match` and Confidence visible, show one primary GitHub label plus `+N labels`, add a quiet one-line `Why:` reason, and move quick filters into the filter sidebar. The GitHub query preview is now behind a `View GitHub query` disclosure.
- Preserved the current single-scroll inspector and Advanced Context scan-line loading. No inspector tabs, `Overview` / `Evidence` / `Action` tab flow, or hidden/multi-click inspection model was imported.
- Verification on 2026-05-24: board mode tests were written first and failed for missing `src/boardMode.js`; routing/copy/CSS tests failed for missing Activity, compact board, Profile split, and compact styles before implementation. Final `npm test` passed 221/221, `npm run build` passed, `npm run test:layout` passed 9/9, and the in-app browser smoke at `http://127.0.0.1:5174` verified Profile cleanup, Activity page, Board Compact/Full Kanban toggle, Find Contributions quick filters/query disclosure/exact score card, and inspector opened from a result card with Action center plus Advanced context and no Overview/Evidence tabs.
- Remaining risk: the in-app browser inspector smoke used one live public GitHub Lookup result from `TEAMMATES/teammates#13997`, so that exact issue's live state and GitHub rate limits can change. Rendered browser validation was Chromium-only.

## 2026-05-23 Advanced Context Scan-Line Loading

- Replaced the three inspector Advanced Context loading cards with the Option B scan-line treatment: `Fetching timeline`, `Scanning setup files`, and `Reading repo history` now render a 1px `#378ADD` scan line, staggered scan delays of `0s`, `0.4s`, and `0.8s`, three pulsing colored dots, and pulsing skeleton rows on the `#0d1117` / `#1a2332` loading surface.
- Preserved the resolved Advanced Context content labels, summaries, and badges, then added staggered `fadeUp` reveal delays of `0s`, `0.1s`, and `0.2s`.
- Changed advanced enrichment display timing so every newly opened inspector starts in loading state, including cache hits. The existing fetchers still provide cached summaries, but the advanced cards now hold the loading view for at least 300ms before resolving.
- Added responsive fixed minimum heights for the advanced context cards so loading and resolved states do not shift in the desktop three-column inspector or the mobile one-column inspector.
- Verification on 2026-05-23: regression tests were written first and failed against the old loading state; final `node --test test/css-contract.test.js` passed 5/5, `node --test test/ui-copy.test.js` passed 21/21, `npm test` passed 212/212, and `npm run build` passed. A deterministic Chromium smoke at `http://127.0.0.1:4174/#board` verified cached issue loading, cached issue reopen loading, fresh issue scan delays, resolved fade delays, exact loading/resolved heights at `1280x900` (`152px`) and `390x844` (`94px`), exact loading colors, and no live GitHub dependency via mocked API routes.
- Remaining risk: rendered validation was Chromium-only with seeded local board/cache data and mocked GitHub API responses. Live GitHub latency/rate limits can still affect how long uncached cards remain loading before they resolve or fall back to the existing error state.

## 2026-05-23 Token Input Password Manager Avoidance

- Replaced the Settings GitHub token field with a normal `type="text"` input that is visually masked via `-webkit-text-security` while hidden. This avoids Chrome treating the token as a login password field, which caused both Save Password and Strong Password prompts.
- Kept browser/password-manager suppression hints on the token input: `autocomplete="off"`, autocap/autocorrect/spellcheck off, and common password-manager ignore attributes. The visibility button now toggles a `data-token-visible` state instead of changing the input type.
- Added UI copy/markup contract coverage so the token input stays out of password-field heuristics.
- Verification on 2026-05-23: `node --test test/ui-copy.test.js` passed 21/21, `npm test` passed 211/211, `npm run build` passed, and `git diff --check` passed.
- Remaining risk: Chrome and Chromium browsers support the masking CSS used here. Other browsers or third-party password managers can still apply their own heuristics, but the app no longer renders this token control as an actual password field.

## 2026-05-23 Phase 4 Setup Enrichment DevTools Noise Fix

- Updated inspector-only repo setup enrichment to fetch the repository root contents listing first, infer setup evidence from discovered entries, and fetch bodies only for discovered manifest files needed for test/build hints. Missing `package.json`, `pyproject.toml`, `pom.xml`, README, CONTRIBUTING, `.github`, `workflows`, or `docs/CONTRIBUTING*` files are now normal missing evidence instead of direct optional-file probes.
- `.github/workflows` inspection is gated by root `.github` discovery and a `.github` directory listing that contains `workflows`. `docs/CONTRIBUTING*` detection is gated by root `docs` discovery and the `docs` directory listing. True root contents failures, auth/rate-limit failures, malformed issue references, and network failures still flow to the existing non-blocking inspector enrichment error path.
- Verification on 2026-05-23: `node --test test/repo-setup.test.js` passed 5/5, `npm test` passed 210/210, `npm run build` passed, `npm run test:layout` passed 9/9, and `git diff --check` passed.
- Remaining risk: root and discovered-directory contents requests still depend on live GitHub availability and rate limits. The DevTools-noise fix covers expected missing optional setup files and directory children, not true repository/API failures.

## 2026-05-23 Match Score v3 Phase 4

- Added inspector-only advanced enrichment for public issue timeline events, repo setup files, recent closed PR samples, and same-label issue samples. These read-only fetches run lazily from the inspector, sequence API use conservatively, stay non-blocking on errors, and never fetch for result or board cards before the inspector opens.
- Extended `pr_dashboard_score_enrichment_cache_v1` with typed compact entries for comments, timeline, repo setup, and repo history while preserving old comment-only cache behavior. Cached data stores normalized booleans/counts/reasons only; raw comment bodies, config/script bodies, tokens, Authorization data, private repos, and token-used unknown-visibility repos remain excluded. Token save/change/clear and Clear All clear the cache, and export/import still excludes it.
- Match Score now uses advanced enrichment for transparent timeline, setup, recent PR, and same-label rows plus confidence and mini-score updates for Social Risk, Setup Ease, Repo Health, and Opportunity Fit. Closed-issue zero scoring remains unchanged.
- Verification on 2026-05-23: `npm test` passed 208/208, `npm run build` passed, and `npm run test:layout` passed 9/9. Mocked Chromium screenshots covered inspector final advanced state at 1920x1080, inspector mini-scores at 1920x1080, final enriched mobile inspector at 390x844, and error mobile inspector at 375x667. The checks confirmed no advanced fetch before inspector open, request counts of 1 comment, 1 timeline, 6 setup file checks, 1 PR sample, and 1 same-label search for the successful inspector path, no horizontal overflow, compact cache contents, and no unexpected console/page/request failures. Expected mocked GitHub 404/503 resource messages were allowed for missing setup files and the error-state screenshot.
- Remaining risk: advanced enrichment is heuristic and uses small public GitHub samples. Timeline events, contents endpoints, same-label quality, and rate-limit behavior can vary on live repositories; rendered validation was Chromium-only with mocked GitHub responses and no real PAT.

## 2026-05-23 Match Score v3 Phase 3

- Added lazy inspector-only issue comment enrichment. Result and board cards stay preview-only; opening the inspector fetches public issue comments with a read-only GitHub API request, shows loading/error/loaded states, and feeds compact comment summary signals into Match Score.
- Added `pr_dashboard_score_enrichment_cache_v1` for six-hour public comment summaries only. The cache excludes comment bodies, tokens, Authorization data, private repos, and token-used repos with unknown visibility. Clear Token and Clear All remove the enrichment cache, while export/import continues to exclude it.
- Match Score now adds transparent comment rows for maintainer openness, possible ownership claims, and blocked-work hints. Comment inspection also updates confidence reasons and social-risk mini-score behavior without changing closed-issue zero scoring.
- Verification on 2026-05-23: `npm test` passed 196/196, `npm run build` passed, and `npm run test:layout` passed 9/9. Mocked Chromium screenshots covered inspector comment loading and enriched states at 1920x1080, enriched inspector at 390x844, and error/low-confidence inspector at 375x667. The checks confirmed no result-card comment fetches before inspector open, one lazy comments request per inspector scenario, no horizontal overflow, compact cache contents, and export exclusion of the enrichment cache/comment body/token data.
- Remaining risk: rendered validation used Chromium with mocked public GitHub comment responses and a fake PAT-shaped token. Live GitHub comment availability, rate limits, and author associations can vary.

## 2026-05-23 Match Score v3 Phase 2

- Added local Match Feedback storage under `pr_dashboard_match_feedback_v1`. Feedback records compact idempotent event markers for Save, Working, Merged, Passed, Hide issue, and Hide repo actions; totals and feature buckets are recomputed from those markers instead of being durable mutable counters.
- Wired local feedback into store actions, Match Score rows, and export/import. Feedback rows are transparent and capped at `+8 / -10`; closed issues still score zero even when positive feedback exists. Clear Token preserves feedback and contribution preferences; Clear All removes feedback.
- Added a compact Profile `Learned feedback` summary with local action totals and a reset action that removes only match feedback. Export/import copy now names learned feedback while continuing to exclude GitHub tokens, repo metadata cache, and enrichment cache.
- Verification on 2026-05-23: `npm test` passed 187/187, `npm run build` passed, `npm run test:layout` passed 9/9, and `git diff --check` passed. Mocked Chromium screenshots covered Profile feedback summary and inspector feedback score rows at 1920x1080, Profile at 390x844 and 375x667, and scrolled mobile Profile feedback cards at 390x844 and 375x667; all had no console warnings/errors and no horizontal overflow. Reset learned feedback was smoke-tested to clear only the feedback key while preserving contribution preferences.
- Remaining risk: feedback learning is deterministic and local-only. The rendered validation used Chromium with seeded local storage rather than live GitHub data or a real PAT.

## 2026-05-23 Match Score v3 Phase 1B

- Added visible Phase 1A score diagnostics without changing scoring rules: compact Confidence chips on Dashboard/Find Contributions cards, inspector `Preview`/`Enriched` stage and confidence details, mini-score cards, and preserved existing score rows/pass reason chips.
- Added a compact Profile `Contribution preferences` card with language, preferred work, avoided work, experience, and time-budget controls. Save writes normalized local preferences; Reset removes only contribution preferences. Settings stayed focused on token, hidden items, export/import, and danger actions.
- Verification on 2026-05-23: `npm test` passed 177/177, `npm run build` passed, `git diff --check` passed, and `npm run test:layout` passed 9/9. Browser smoke at `http://127.0.0.1:4173/#profile` verified Profile preferences at 1920x1080 and 390x844 with no console warnings/errors or horizontal overflow, including Save/Reset interaction. Mocked Playwright screenshots covered Find Contributions, inspector, and Profile at 1920x1080 and 390x844, plus inspector/Profile at 375x667, all without horizontal overflow.
- Remaining risk: rendered validation used Chromium only. The deterministic result-card and inspector screenshots used mocked public GitHub responses rather than live GitHub search.

## 2026-05-23 Match Score v3 Phase 1A

- Added structured Match Score v3 data while preserving the existing `score`, `rating`, `rows`, `passReasons`, `flags`, and `isContributionCandidate` contract. New score output includes `stage`, confidence with fixed caps, seven mini-scores, and capped personal-fit adjustments.
- Added local contribution preference storage under `pr_dashboard_contribution_preferences_v1`, with normalized non-secret fields only. Export/import now includes preferences, merges by newer `saved_at`, and ignores hand-edited token/cache/private fields.
- Wired preferences into app state and invisible score calculation. Clear Token preserves preferences; Clear All removes preferences along with the existing local app data. Phase 1A made no intentional visible UI or style changes.
- Verification on 2026-05-23: targeted Phase 1A tests passed, then full gates passed with `npm test` 175/175, `npm run build`, and `git diff --check`.
- Remaining risk: mini-scores and confidence are deterministic heuristics based only on current local/search/repo data until later UI, feedback, and enrichment phases add more context.

## 2026-05-23 README Gallery And Docs Sweep

- Refreshed the README hero and added a compact Product Tour gallery under `qa_screenshots/readme/`, using deterministic TEAMMATES public GitHub snapshots for `#13997`, `#13998`, `#14005`, `#13698`, `#13944`, and `#14003`.
- Added README gallery verification: `test/readme-gallery.test.js` checks local README image/link targets and showcase copy, while `test/readme-gallery.spec.cjs` seeds curated board/profile/proof/reminder state, mocks public GitHub API responses, asserts no banned mock/slop terms, checks console/page health and horizontal overflow, and captures four 1920x1080 README screenshots.
- Swept README, `docs/SECURITY.md`, and `docs/DATA_MODEL.md` for current v1 local-first behavior, GitHub API limit wording, token handling, avatar privacy handling, local export/import, and active-board refresh boundaries. `LICENSE` was checked and left unchanged.
- Verification on 2026-05-23: `npm test` passed 163/163, `npm run build` passed, `npm run test:readme-screenshots` passed 4/4, and `git diff --check` passed.
- Remaining risk: screenshot data is deterministic and based on public GitHub snapshots captured for the README showcase; live GitHub issue status, repository statistics, and API limit policy can still change after the screenshots are committed. Visual smoke was Chromium-only and uses mocked public API responses, no real PAT.

## 2026-05-23 API Limits Tracker Review Fixes

- Addressed PR #6 Codex review findings: successful GitHub response-header limit updates now clear stale manual `Check limits` error state, and unsaved Settings token tests no longer mutate the active-session API limits tracker.
- Preserved active saved-token behavior: `/user` token tests still update the `REST/core` bucket when the tested token matches the currently active app token.
- Verification on 2026-05-23: `npm test` passed 161/161, `npm run build` passed, `npm run test:layout` passed 9/9, and `git diff --check` passed.
- Remaining risk: live GitHub limit headers vary by token/public session; the unsaved-token edge case is covered by unit tests rather than a real PAT.

## 2026-05-23 API Limits Tracker

- Replaced the ambiguous header `API: n/n` badge with a desktop `API limits` button and app-styled popover for `REST/core` and `Search` primary GitHub limit buckets.
- Added in-memory-only `rateLimits` tracking with `lastCheckedAt`/bucket `updatedAt`, while preserving the existing single `rateLimit` compatibility value. Token save/change/clear resets tracker state without adding storage keys.
- GitHub response headers now parse `x-ratelimit-resource`, `remaining`, `limit`, `used`, and `reset`; Search updates the `search` bucket, while Lookup, saved-card refresh, and token test update `core`. Manual `Check limits` calls `GET /rate_limit` and applies the normalized snapshot in the UI.
- Help now explains that the tracker shows primary limits only, `REST/core` powers Lookup/token test/saved-card refresh, `Search` powers Find Contributions, and secondary limits are not directly exposed by GitHub.
- Verification on 2026-05-23: `npm test` passed 159/159, `npm run build` passed, `npm run test:layout` passed 9/9, and `git diff --check` passed. Generated A1 screenshot churn from layout testing was restored.
- Remaining risk: popover/browser behavior was verified in Chromium via the existing layout smoke; live GitHub limit values and reset windows vary by token/public session.

## 2026-05-23 Avatar Clipping Review Fix

- Kept `#user-profile-avatar` as the custom tooltip host without `overflow-hidden`.
- Runtime avatar initials now render with `rounded-full overflow-hidden`; runtime GitHub avatar images render inside a rounded overflow-hidden wrapper, with the image itself also rounded.
- Added regression coverage in `test/ui-copy.test.js` to keep runtime avatar content clipped while preserving the outer `data-tooltip="Profile"` wrapper and avoiding native `title` attributes.
- Verification on 2026-05-23: local Chromium smoke at `http://127.0.0.1:5173/` verified initials, mocked GitHub image, and broken-image fallback avatar states are circular, and the custom Profile tooltip remains visible while the outer wrapper keeps `overflow: visible`. `npm test` passed 152/152, `npm run test:layout` passed 8/8, and `git diff --check` passed.
- Remaining risk: avatar and tooltip rendering were smoke-tested in Chromium only.

## 2026-05-22 UI Polish: Scrollbars, Tooltips, Help, Feedback

- Confirmed `dev` is synced to `main`: `git rev-list --left-right --count main...dev` returned `0 0`.
- Implemented app-styled thin scrollbars for page and board-lane scrolling, CSS-only `data-tooltip` app tooltips for chrome/icon controls and small board-flow metrics, and removed native `title` tooltip usage from interactive app chrome.
- Added real `#help` and `#feedback` routes with desktop and mobile navigation. Help covers Board workflow basics, manual saved-card serial refresh behavior, GitHub API limits for Search vs REST/core, and local export/import/privacy notes. Feedback opens a prefilled GitHub issue and warns not to paste GitHub tokens or private data.
- Built-preview route smoke at `http://127.0.0.1:4173` verified `#help` renders Help content without Dashboard `Saved candidates`, `#feedback` renders Feedback with the GitHub issue link, Review reminders and Settings tooltips appear on hover and keyboard focus, and a crowded Board lane scrolls vertically without document or lane horizontal overflow.
- Verification on 2026-05-22: `npm test` passed 151/151, `npm run build` passed, `npm run test:layout` passed 8/8, and the built-preview smoke captured no app console warnings/errors. Generated A1 screenshot churn from `npm run test:layout` was restored.
- Remaining risk: tooltip behavior was smoke-tested in Chromium only. GitHub issue creation is an outbound link to GitHub and was verified by URL construction, not by submitting an issue.

## 2026-05-20

- Installed build-time Tailwind with PostCSS/autoprefixer and replaced the broken homemade utility clone.
- Verified `npm test` and `npm run build` pass after the CSS/router/search changes.
- Started Vite at `http://127.0.0.1:3000/` and captured route screenshots in `qa_screenshots/` at `1920x1080` and `3440x1440`.
- Remaining visual note: Settings is reached from the topbar settings icon rather than a desktop sidebar item, so the active state is shown in the topbar.

## 2026-05-20 Security + Functionality Hardening

- Added escaping and GitHub URL validation helpers for template-rendered issue data.
- GitHub API helper now attaches Authorization only for `https://api.github.com` and blocks write methods in v0.1.
- Public search remains token-optional and was verified without a PAT against `GET https://api.github.com/search/issues`.
- Search filter changes update state without triggering GitHub requests; preset/search buttons still run explicit searches.
- Board save, board refresh persistence, card move persistence, and inspector links from Find Issues, Dashboard, and Board were verified with Playwright.
- Settings Test Connection was verified with a mocked `GET https://api.github.com/user`; no real PAT was used. Remember-token storage remains opt-in, and Clear Data removes token keys without wiping the board.
- `npm test` passed 12/12, `npm run build` passed, and `npx playwright test test/e2e-hardening.spec.cjs --browser=chromium --reporter=line` passed.
- Screenshots were refreshed in `qa_screenshots/` at `1920x1080` and `3440x1440` after token state was cleared.
- `node_modules` remains ignored/untracked, and no Tailwind CDN or PAT-shaped strings were found outside ignored dependency/build output.
- Remaining risk: public GitHub search can still hit GitHub's unauthenticated rate limit; the Settings connection test was not exercised with a real PAT.

## 2026-05-20 Real-Data Reliability Pass

- Removed production startup seeding from `mockBoardCards`; the default board is empty unless the user has saved real GitHub issues.
- Added migration for old seeded demo board cards. Known mock issue signatures are removed from stored board data instead of being shown as live GitHub issues.
- Removed runtime use of mock search cards and mock active PRs. Mock data remains in `src/data/mockData.js` for tests/reference only.
- GitHub search query builder now uses default open-only search, explicit include-closed filtering, comma OR label syntax, and a visible query preview.
- Added Low Noise preset, Relax Filters no-results action, and no-results explanation with active filters and exact query.
- Added saved issue refresh support using read-only GitHub issue metadata requests. Refreshed closed issues show a closed warning and can be moved to Passed.
- Split destructive settings actions into Clear Token/Settings, Clear Board, and Clear All App Data.
- Verified `vuejs/core#8291` via GitHub API on 2026-05-20: the real issue is closed/completed, confirming the old seeded board card was fake/stale.
- Verified with Playwright that normal startup has an empty board, no PAT search sends no Authorization header, real public issue save persists after refresh, issue metadata refresh marks a saved card closed, and token storage remains session-only unless Remember is checked.
- Remaining risk: saved issue refresh depends on GitHub rate limits/network availability, and the PAT path was smoke-tested with a non-secret mocked `/user` response rather than a real PAT.

## 2026-05-21 Finder v2

- Implemented Find Contributions and Lookup modes from `docs/design/PR-Dashboard-Finder-v2-Spec.md` while preserving the existing SPA, Tailwind setup, desktop layout, and mobile layout.
- Visible app branding is now exactly `PR Dashboard`; visible `Obsidian Workbench` branding was removed from the running app, and the header notification bell is disabled with unavailable-state copy.
- Find Contributions now uses applied filters plus draft filters. Filter control changes only update the query preview and `Changed` badge until Apply Filters, Search, or a preset runs an explicit GitHub request.
- Query defaults are `is:issue state:open archived:false` with label OR defaults for `good first issue` and `help wanted`; Lookup mode uses broad literal search by default and exact Lookup uses `GET https://api.github.com/repos/{owner}/{repo}/issues/{number}` after local validation.
- Added repo metadata hydration/caching for non-secret repository fields with a 24 hour TTL and four-request concurrency cap. Stars filtering is applied locally after hydration; no tokens or Authorization headers are cached.
- Repo stars/forks verified in screenshots and smoke testing: `openai/codex#19464` showed approximately `84k` stars and `12k` forks, and the `5k+` stars filter reduced results to hydrated repos meeting the threshold.
- Match Score v2 now shows inspector breakdown rows and pass chips. Formula summary: closed issues score 0; open issues start with an open-issue baseline and receive bonuses for beginner labels, small/docs/config scope, clear expected behavior, task lists, low comments, unassigned status, recent issue/repo activity, and healthy hydrated repo metadata; penalties apply for assigned issues, heavy comments, stale age, archived/disabled or unavailable repo metadata, stale/blocked/duplicate/wontfix labels, vague body text, large ambiguous scope, and meta/growth issues. Scores are clamped to 0-100 with Strong/Good/Maybe/Risky ratings.
- Safer action plan copy now asks the user to read repo docs, check install/test commands, identify likely files, open issue discussion, and decide attempt/pass. Legacy default action plans are migrated without changing custom user tasks.
- Board spacing was tightened with narrower columns and smaller card padding, board refresh status persists through re-render, and mobile board header controls no longer clip at 390x844 or 375x667.
- Dark-mode select option readability was hardened with explicit option background/text colors.
- Added unit coverage for Lookup validation/API preview, Match Score v2, repo metadata caching/concurrency/stars filtering, Finder store draft/apply behavior, CSS contract, and updated GitHub query expectations.
- Verification on 2026-05-21: `npm test` passed 41/41 and `npm run build` passed.
- Screenshot validation captured Finder v2 screens in `qa_screenshots/finder-v2/` at desktop `1920x1080`, wide desktop `3440x1440`, and mobile `390x844`/`375x667`. Browser checks found no page overflow, no visible `Obsidian` branding, and no missing `PR Dashboard` branding on Dashboard, Find Contributions, Board, or Settings.
- Manual smoke covered search `first issue`, Quick Wins, Apply Filters, `5k+` stars filtering, exact Lookup URL, save issue, refresh board, inspect score breakdown from search and board, token-leakage checks in URL/body/logs, and `git ls-files node_modules` returning no tracked files.
- Codex Security diff review found no reportable findings. Security checks covered read-only GitHub methods, Authorization scoping to `https://api.github.com`, exact Lookup validation before API construction, escaping before template rendering, validated GitHub links with `rel="noopener noreferrer"`, and non-secret-only repo metadata caching.
- Remaining risk: GitHub API rate limits and live repository data can change screenshot/smoke outputs over time; final token hygiene was verified without a real PAT, so remembered-token persistence was covered by tests and code inspection rather than a live secret. `qa_screenshots/vite-dev.log` also contains HMR noise from the pre-existing Vite server on port 3000 and could not be restored without stopping that server.

## 2026-05-21 Navigation Copy Tightening

- Renamed the visible desktop and mobile navigation item from `Find Issues` to `Find Contributions` so the left rail matches the Finder v2 product promise.
- Updated the dashboard empty-state helper copy to point at Find Contributions results.
- Verification: added `test/ui-copy.test.js`; watched it fail before the copy change, then pass after the copy change. `npm test`, `npm run build`, and `git diff --check` passed.

## 2026-05-21 Dashboard Hero Recommendation Fix

- Added a tested dashboard hero decision helper so `Configure Personal Access Token` only appears when there is no active saved issue and no configured PAT.
- Dashboard hero now prioritizes active saved issues anywhere in non-final board columns, with `Working` first, then normal board order. Closed issues and cards in `Merged` or `Passed` are ignored for resume recommendations.
- When a PAT exists and there is no active saved issue, the hero recommends `Find Contributions` instead of token setup.
- Adjusted PAT setup copy to mention increased GitHub API rate limits for searches/lookups, without implying private repository search.
- Verification: `test/dashboard-hero.test.js` failed before `src/dashboardHero.js` existed, then passed after implementation. `npm test` passed 48/48 and `npm run build` passed.

## 2026-05-21 Contribution Coach Layer

- Added deterministic contribution brief logic in `src/contributionBrief.js` using issue labels, body/title terms, comments, assignees, updated dates, hydrated repo metadata, and existing Match Score rows/pass reasons.
- Find Contributions and Lookup result cards now show a restrained `Best For` chip beside the existing Match chip. Dashboard saved issue cards also show the same chip where the Match chip already appears.
- Issue inspector now includes a `Contribution Brief` section near `Why this score?` with verdict, best-for label, why bullets, risk bullets, first move, and optional maintainer question for vague-but-not-hard-pass issues.
- Bad candidates now get plain-English deterministic risk copy for assigned issues, crowded discussions, stale issues/repos, vague bodies, large/refactor scope, blocked/duplicate/wontfix labels, and roadmap/meta issues.
- Files touched: `src/contributionBrief.js`, `src/main.js`, `test/contribution-brief.test.js`, `test/ui-copy.test.js`, `STATE.md`, and generated HMR log lines in `qa_screenshots/vite-dev.log` from the already-running Vite server.
- Verification: contribution brief tests were written first and failed before the helper existed; `npm test` passed 55/55, `npm run build` passed, and a local browser smoke at `http://127.0.0.1:3000/#find-issues` found 30 rendered result cards with `Best For` chips and one inspector `Contribution Brief`.
- Known limitations: the coach is intentionally rules-only and depends on the metadata already available in GitHub issue/search responses plus hydrated repo fields. It does not add AI, backend services, or any new network dependency beyond the existing GitHub API calls.

## 2026-05-21 Contribution Coach Cleanup + Hide

- Tightened `src/contributionBrief.js` so Match/Fit Score remains the base signal: `Likely pass` now requires a low score or a true hard-pass condition such as closed issue, archived/disabled repo, hard-pass label, assigned plus stale/noisy thread, or very vague plus large/unclear scope.
- Replaced broad `meta` substring detection with whole-term/phrase checks so normal `metadata` issues are not treated as roadmap/meta work.
- Renamed fit labels from `Comfortable` to `Standard` and `Likely Pass` to `Skip`; cards now show `Fit: First PR`, `Fit: Standard`, `Fit: Deep Dive`, or `Fit: Skip`, while the inspector shows `Best fit` copy.
- Added local hide support in `src/hiddenItems.js` using `pr_dashboard_hidden_v1` compact JSON with issue/repo keys and timestamps only. Search rendering filters hidden issues/repos, card and inspector actions hide immediately, and Settings includes `Clear Hidden`.
- Files touched: `src/contributionBrief.js`, `src/hiddenItems.js`, `src/state/store.js`, `src/main.js`, `test/contribution-brief.test.js`, `test/hidden-items.test.js`, `test/ui-copy.test.js`, and `STATE.md`.
- Verification: new tests were written first and failed for the old labels, metadata false positive, bad high-score likely-pass copy, and missing hidden-items module. After implementation, `npm test` passed 61/61 and `npm run build` passed.
- Known limitations: hidden items are local to the current browser storage and intentionally do not sync across devices. Clearing hidden items restores visibility on the next render/search, but it does not alter saved board cards.

## 2026-05-21 Line Ending Rules

- Updated `.gitattributes` so the attributes file plus JavaScript, JSON, HTML, CSS, and Markdown files keep LF line endings across platforms while retaining automatic text normalization for other files.
- Verification: `git check-attr eol -- .gitattributes src/main.js STATE.md package.json index.html` reports `lf` for those representative files, and `git diff --check` passes.

## 2026-05-21 Hidden Results Manager

- Extended `src/hiddenItems.js` with compact-listing and per-key unhide helpers. Hidden issue/repo rows are derived only from existing keys and timestamps, with GitHub URLs generated from those keys.
- Added a Settings `Hidden Results` card above Danger Zone with issue/repo counts, a local filter input, Issues and Repositories sections, capped rendering at the first 100 matching rows per section, Open links, and per-row Unhide buttons.
- Existing `Clear Hidden` and `Clear All App Data` still clear hidden storage; no hidden item titles, bodies, labels, repo metadata, tokens, backend calls, or network fetches were added.
- Files touched: `src/hiddenItems.js`, `src/state/store.js`, `src/main.js`, `test/hidden-items.test.js`, `test/ui-copy.test.js`, and `STATE.md`.
- Verification: hidden manager tests were written first and failed for the missing list/unhide helpers and Settings copy. After implementation, `npm test` passed 65/65 and `npm run build` passed.
- Known limitation: hidden rows show compact keys rather than issue titles by design, because the hidden storage intentionally avoids storing or fetching full issue data.

## 2026-05-21 Interaction Polish + Dashboard Metrics

- Added reusable Tailwind component-layer interaction classes in `src/styles.css` for interactive cards, rows, buttons, chips, action toolbars, and metric/progress components.
- Replaced the confusing no-results `Relax Filters` action with `Broaden Search`. It now clears contribution filters, keeps the typed query text, and immediately reruns the current search.
- Polished Find Contributions cards, Dashboard saved rows, Board cards, Hidden Results rows, Settings cards, filter chips, presets, mode tabs, inspector actions, and danger-zone buttons with restrained hover/focus/active states.
- Fixed inspector/card action button wrapping with `action-button` and no-wrap behavior so labels such as `Save anyway?`, `Saved to board`, `Hide issue`, `Hide repo`, and `Open on GitHub` stay on one line while toolbars can wrap.
- Upgraded Dashboard metric cards using only local app data: Saved Issues, Active Review, Resolved / Passed, Hidden Results, and Board Momentum with lightweight CSS progress bars.
- Files touched: `src/styles.css`, `src/searchInteractions.js`, `src/main.js`, `test/css-contract.test.js`, `test/search-interactions.test.js`, `test/ui-copy.test.js`, and `STATE.md`.
- Verification: tests were written first and failed for missing CSS classes, old Relax Filters behavior/copy, and missing dashboard metric copy. After implementation, `npm test` passed 69/69 and `npm run build` passed.
- Known limitation: dashboard metrics are local board/storage summaries only; they do not infer team velocity, PR activity, or remote GitHub state beyond data already saved/hydrated in the app.

## 2026-05-21 Board Momentum Purpose Follow-up

- Kept all five Dashboard metric cards visible when the board is empty; no metric cards are removed or hidden in the empty state.
- Kept the `Board Momentum` card label and visual shell, but changed its populated-state content to show only non-zero board lanes, a dominant-lane headline such as `1 in Considering`, and a short next-move line.
- Added hover/focus feedback inside Board Momentum so lane chips highlight their matching progress segment and update the next-move line without changing board data.
- Added `src/dashboardReviewFlow.js` for deterministic local board-lane summaries and tests for empty, single-lane, and dominant-lane cases.
- Files touched: `src/dashboardReviewFlow.js`, `src/main.js`, `src/styles.css`, `test/dashboard-review-flow.test.js`, `test/css-contract.test.js`, and `STATE.md`.
- Verification: `npm test` passed 72/72, `npm run build` passed, and `git diff --check` passed.
- Known limitation: Board Momentum is still a local board summary only; it does not fetch remote PR status or infer team velocity.

## 2026-05-22 Score Gate + Action Plan Scroll Fix

- Tightened Match Score so generic issue quality signals cannot stack into a fake perfect score. Scores without strong contribution-fit evidence are capped at `90`, and broad actionable bugs without a strong contribution label are capped below perfect.
- A bare `bug` label no longer bypasses the near-perfect gate. Strong fit now comes from labels such as `good first issue`, `help wanted`, docs/test/starter/beginner/easy labels, bounded fix wording, scoped docs/UI-text work, or action-oriented task sections.
- Narrowed copy detection so `Copy, Paste` and `copy to clipboard` do not count as docs/copywriting scope, while contextual UI/error-message copy still can.
- Replaced broad task-list detection with heading-aware/action-oriented detection so reproduction steps and template compliance checklists do not count as contributor task lists.
- Fixed inspector Action Plan toggles so checking a task updates the existing row and progress bar in place instead of rebuilding the inspector drawer. Saved-card checklist progress now persists from any board lane, not only `Working`.
- Files touched: `src/matchScore.js`, `src/main.js`, `src/state/store.js`, `test/match-score.test.js`, `test/finder-store.test.js`, `test/ui-copy.test.js`, and `STATE.md`.
- Verification: score and Action Plan regression tests were written first and failed against the old behavior. After implementation, `npm test` passed 90/90 and `npm run build` passed.
- Browser smoke at `http://127.0.0.1:3000/#find-issues` used Lookup for `openai/codex#23986`, saved the issue, opened the inspector, scrolled to Action Plan, and toggled a checkbox. The drawer scroll stayed at `1969`, focus stayed on the checkbox, progress updated from `0%` to `17%`, and console warnings/errors were `0`.
- Known limitation: scoring is still deterministic and heuristic. It avoids the observed false-perfect path, but live GitHub issue data can still change rankings over time.

## 2026-05-22 README Product Proof Point

- Added a README `Product Proof Point` section for the May 22, 2026 merged TEAMMATES contribution discovered through PR Dashboard.
- Framed TEAMMATES respectfully as a public open-source example, with an explicit note that the mention is not an endorsement or affiliation.
- Tightened the README wording to focus on the concrete workflow: discovery, fit evaluation, local verification, CI, review feedback, and merge.
- Verification: checked the public GitHub issue/PR pages for `TEAMMATES/teammates#13997` and merged PR `#13998`, then ran `git diff --check`.
- Remaining risk: the linked GitHub issue and PR pages are live public pages, so labels, counts, or surrounding GitHub metadata can change over time.

## 2026-05-22 Local Proof Log + Recovery Pass

- Added canonical issue keys, local Proof Log storage, local profile metadata, local alerts, and local export/import helpers.
- Saved items no longer disappear when hidden or clicked while already saved; hide only suppresses future discovery results, and explicit board delete remains the removal path.
- Exact Lookup accepts GitHub pull request URLs, bypasses hidden filtering, and shows `Hidden locally`; Proof Log creation now requires saving to the board and moving the card to `Merged` as described in the board-only cleanup below.
- Board cards now get local movement timestamps, and moving to `Merged` through either move path creates local `marked_complete` proof history.
- Replaced the board's fixed horizontal row with a responsive wrapping grid and added a real `#profile` route plus an enabled local-alert bell.
- Export Local Data includes board, hidden keys, profile metadata, and Proof Log entries while excluding tokens and repo metadata cache.
- Files touched include `src/issueKeys.js`, `src/proofLog.js`, `src/profile.js`, `src/localAlerts.js`, `src/localData.js`, `src/state/store.js`, `src/main.js`, `src/styles.css`, `src/lookup.js`, docs, and focused tests.
- Verification: new tests were written first and failed before implementation. Final `npm test` passed 108/108, `npm run build` passed, and Browser smoke at `http://127.0.0.1:4173/` verified dashboard load, profile route, local alerts popover, responsive board grid without horizontal overflow, exact Lookup for `TEAMMATES/teammates#13998`, hide recovery, profile proof visibility, and mobile `390x844` profile/board overflow checks with no console warnings/errors.
- Known limitations: Proof Log entries are local completion records, not remote merge verification. Export/import is the v1 multi-device bridge; automatic sync still requires a backend or user-managed sync layer later.

## 2026-05-22 v1 Local-First Hardening

- Direction confirmed: do not implement GitHub OAuth, backend sync, encrypted sync, GitHub App auth, database storage, or remote avatar rendering in this pass.
- v1 remains local-first. Export/Import Local Data is the current phone/desktop bridge; GitHub auth and encrypted sync are deferred to a later backend-sync project.
- Hardened regression coverage so Clear Board preserves Proof Log history, Clear All removes token, remember-token, board, migration, proof, profile, hidden, and repository metadata cache keys, and Import ignores token/repo metadata cache fields in hand-edited payloads.
- Documentation now states that GitHub tokens are never exported and repository metadata cache is excluded from exported local data.
- Verification on 2026-05-22: `npm test` passed 98/98 after the hardening coverage was added, and `npm run build` passed. A built-preview Playwright smoke verified dashboard and profile Proof Log history, exact Lookup recovery for a hidden item, and no horizontal board overflow at `1366x768` or `390x844`, with no console warnings/errors.
- Remaining risk: v1 cross-device movement is manual export/import only. Live GitHub data and public API rate limits can still vary over time, and no real PAT was used during this pass.

## 2026-05-22 Proof Log Board-Only + Profile Avatar Cleanup

- Removed manual Proof Log creation from result cards and the inspector. Proof Log creation now comes from board cards entering `Merged` through `moveBoardCard()`, `moveCardToColumn()`, or startup backfill of existing `Merged` cards.
- Result card actions are now Inspect, Save/View on board, Hide, Unhide when hidden, and GitHub. The inspector shows a non-interactive `In Proof Log` / `Not in Proof Log` status chip.
- Kept legacy `manual_lookup` entries loadable/importable as local history; no v1 UI creates new manual proof entries.
- Extended profile storage with whitelisted `github_id` and safe `avatar_url` fields from the existing Settings Test Connection response.
- Added strict avatar URL validation for `https://avatars.githubusercontent.com/...` with digit-only `v` and `s` query params. Header/Profile render safe avatars with no-referrer/lazy/async attributes and initials fallback.
- Docs now state that Exact Lookup does not directly create Proof Log entries and that GitHub avatar images are loaded without tokens in image URLs or image requests.
- Verification on 2026-05-22: `npm test` passed 100/100, `npm run build` passed, `git diff --check` passed, and a built-preview Playwright smoke verified mocked Test Connection avatar storage/rendering, export token exclusion, inspector status-only proof chip, board-to-`Merged` Proof Log creation, Profile removal, and no console warnings/errors.

## 2026-05-22 Product Copy + Inspector Cleanup Sweep

- Used `$impeccable` product-register guidance for the copy sweep because this repo still has no `PRODUCT.md` or `DESIGN.md`.
- Removed the inspector Proof Log status chip/state entirely. The inspector Action center now renders only Save/Saved to board, Hide issue, Hide repo, Unhide when hidden, and Open on GitHub.
- Kept Proof Log creation on the Board Merged path and Proof Log display/removal on Dashboard/Profile. Legacy `manual_lookup` entries remain loadable/importable, but no manual lookup Proof Log UI path was added.
- Renamed visible local alert copy to `Review reminders` in the header bell, popover, Profile metric/card, empty state, and helper text.
- Tightened visible product copy across Dashboard, Board, Profile, Settings, export/import, danger-zone, Lookup recovery, and Find Contributions surfaces with the preferred vocabulary from the plan.
- Aligned current README and data-model docs with `Review reminders`, `Proof Log`, `Board`, and `GitHub token` vocabulary where they describe user-facing product behavior.
- Added copy contract coverage for banned visible phrases in `index.html` and `src/main.js`, inspector/result-card Proof Log control exclusions, `Review reminders` copy, and the extra banned terms `beautiful thing`, `magic`, standalone `wins`, and standalone `momentum`.
- Browser smoke at `http://127.0.0.1:5173/` saved a Lookup result, confirmed the inspector had no Proof Log chip/status/action, moved the card to `Merged`, confirmed Dashboard/Profile Proof Log visibility, removed the Profile entry, re-opened the inspector with no Proof Log state, verified the bell popover says `Review reminders`, and found no console warnings/errors.
- Verification on 2026-05-22: `npm test` passed 102/102, `npm run build` passed, and `git diff --check` passed.
- Remaining risk: live GitHub Lookup data and public API rate limits can vary over time. This pass intentionally added no OAuth, backend sync, encrypted sync, issue-card avatars, new storage keys, or new product surfaces.

## 2026-05-22 README Badge Polish

- Added Tailwind CSS and Live on Vercel badges to the README badge row, keeping the existing compact Shields style.
- Verification: badge image URLs and the live Vercel URL returned `200`, and `git diff --check` passed.

## 2026-05-22 GitHub Activity Refresh + Review Reminders

- Added local GitHub activity comparison metadata on board cards, including ETag-aware refresh state, comment deltas, state/assignee/label changes, and cleanup for stale activity summaries after no-change refreshes.
- Reworked saved-card refresh into manual `Refresh this card` and `Refresh active board` paths. Active-board refresh only covers `Considering`, `Read Docs`, `Asked Maintainer`, `Working`, and `PR Open`; `Merged` and `Passed` are excluded by default.
- Refresh requests use direct GitHub issue endpoints, send `If-None-Match` when available, handle `304 Not Modified`, run active-board batches serially, warn for no-token public batches above 5 requests, and stop on rate-limit errors.
- Review reminders now include `New GitHub activity` above stale-refresh reminders, and board/inspector cards show a restrained local activity status line when new activity exists.
- Verification on 2026-05-22: new tests were written first and failed before implementation. Final `npm test` passed 118/118, `npm run build` passed, and a built-preview mocked Playwright smoke at `http://127.0.0.1:4173/` verified Lookup save, `Refresh this card`, card/inspector activity summaries, Review reminders, board-to-`Merged` Proof Log behavior, active-board request count, `Merged` exclusion, serial active-board refresh with max concurrency 1, and no console warnings/errors. The Browser plugin could verify the app shell but could not seed/mock page `localStorage`, so the deterministic API smoke used the repo Playwright dependency.
- Remaining risk: live GitHub issue metadata and public API limits can vary. No real PAT was used; token behavior was covered by request/header tests and mocked browser traffic.

## 2026-05-22 Refresh Throttle + Mark Reviewed + A1 Board Layout

- Replaced board-wide default refresh with `Refresh stale cards`, selecting only stale active-lane cards and capping the primary batch at 10 requests. `Refresh all active cards` remains available as a secondary serial action with public/token confirmation thresholds.
- Centralized board lane, refresh threshold, stale-age, and A1 layout-width constants in `src/boardConstants.js`.
- Added per-card `Mark reviewed` for GitHub activity reminders. It only stamps `github_activity.acknowledged_at`, preserves the activity summary, and suppresses reminders/status lines only when `acknowledged_at >= last_checked_at`.
- Hardened local import collisions so the newer `github_activity.last_checked_at` wins and stale acknowledgements cannot hide newer activity.
- Reworked the Board into A1: `Active workflow` lanes first, always-visible compact `Completed` lanes below, centered under a max-width board shell. Added a separate `npm run test:layout` Playwright smoke that saves five viewport screenshots under `qa_screenshots/board-layout-a1/`.
- README, Security notes, and Settings copy now clarify that Find Contributions uses GitHub Search limits while Lookup and saved-card refresh use REST/core limits.
- Verification on 2026-05-22: `npm test` passed 127/127, `npm run build` passed, `git diff --check` passed, and `npm run test:layout` passed 5/5 across `390x844`, `375x667`, `1366x768`, `1920x1080`, and `3440x1440`, with screenshots written to `qa_screenshots/board-layout-a1/`. The in-app browser also opened `http://127.0.0.1:5173/#board` and confirmed Active workflow, Completed, both refresh labels, and no document horizontal overflow.
- Remaining risk: browser smoke uses mocked local board data and a built preview, not live GitHub responses or a real PAT. Live API limits and issue metadata can still vary.

## 2026-05-22 Pre-Merge Cleanup

- Fixed inspector checklist persistence so `toggleTaskChecklist()` searches every board column, not only `Working`, then updates the matching board card, saves board storage, and keeps the inspected issue in sync.
- Changed local data import to merge durable collections instead of overwriting them: hidden items now union by key with newest timestamp winning, Proof Log entries merge by key while preserving earliest completion/creation dates and keeping newest updated content, and profile import keeps the newer `saved_at`.
- Import now returns the retained merged profile/hidden/proof data, and the import UI uses the merged profile result instead of assigning from the raw imported payload.
- Board-card import behavior, GitHub activity acknowledgement collision handling, Refresh Throttle, Mark Reviewed, and A1 Board layout behavior were left unchanged.
- Verification on 2026-05-22: regression tests were written first and failed for the old behavior; after the fix, `npm test` passed 131/131, `npm run build` passed, and `npm run test:layout` passed 5/5 across the required A1 viewports.
- Remaining risk: export/import is still a local manual bridge. Conflict resolution is timestamp-based and does not attempt remote sync, OAuth identity reconciliation, or cross-device locking.

## 2026-05-22 Narrow Desktop Board Layout Hardening

- Fixed the awkward middle-width board layout where the sidebar plus five active lanes made cards unreadably narrow and exposed horizontal lane scrollbars.
- Added a `1090x1212` A1 layout smoke case matching the narrow-desktop/tablet-landscape band. Active workflow now prioritizes readable lane width: two columns at that cramped width, three around small desktop widths, and five only when the content pane is wide enough.
- Hardened board cards and lane containers against horizontal overflow while allowing long repository names and issue titles to wrap. Compact card controls and issue numbers stay intact.
- Added a crowded-lane smoke case with 35 cards in one active lane at `1090x1212`, proving the lane scrolls vertically without horizontal overflow.
- Verification on 2026-05-22: `npm run test:layout` passed 7/7, including `board-a1-1090x1212.png` and `board-a1-1090x1212-crowded.png`.
- Remaining risk: responsive checks cover Chromium and the specified smoke widths. Very unusual browser zoom or OS text scaling could still affect wrapping density.

## 2026-05-22 Passed vs Proof Log Boundary

- Clarified the local completion boundary in code: `Merged` remains the only board move that creates a Proof Log entry, while `Passed` means inactive/not pursuing and must not preserve a matching proof record.
- Moving a board card to `Passed` now removes any matching Proof Log entry for that issue/PR. This covers the closed-card `Move to Passed` path after a GitHub refresh reports a card closed/completed.
- Added regression coverage proving a matching proof entry is cleared when the card moves to `Passed`.
- Verification on 2026-05-22: the new regression test failed against the old behavior, then passed after the store fix. Final gates also passed: `npm test` passed 132/132, `npm run build` passed, `npm run test:layout` passed 7/7, and `git diff --check` passed.
- Remaining risk: this intentionally removes local proof for a card moved to `Passed`; users should keep true completed work in `Merged`.

## 2026-05-22 Refresh Confirmation Modal

- Replaced the native browser confirmation for large manual board refreshes with an in-app modal that matches the dashboard surface, keeps the same public/token REST warning thresholds, and preserves the serial refresh/rate-limit stop behavior.
- Added copy coverage to prevent `window.confirm` from returning for refresh batch warnings.
- Browser smoke at `http://127.0.0.1:5173/#board` seeded six stale active cards, opened `Refresh stale cards`, verified the app modal copy/actions, cancelled it, and saved `qa_screenshots/refresh-confirm-dialog.png`.
- Verification on 2026-05-22: full final gates were rerun after this modal change. `npm test` passed 133/133, `npm run build` passed, `npm run test:layout` passed 7/7, and `git diff --check` passed.
- Remaining risk: the modal was validated in Chromium with mocked local board data. Live GitHub request failures still depend on GitHub response headers and current rate-limit state.

## 2026-05-22 Emergency Blank-Screen Hotfix

- Cause: `renderDashboard()` called `summarizeDashboardMetrics(store.boardCards)` without importing `summarizeDashboardMetrics`, which raised `ReferenceError: summarizeDashboardMetrics is not defined` during the initial built-preview render and left `#app-content` empty. The same block also referenced undefined local metric helpers for board counts/progress, so the dashboard now uses the fields returned by `summarizeDashboardMetrics()`.
- Files fixed: `src/main.js`, `test/board-layout-a1.spec.cjs`, and `STATE.md`.
- Built-preview route smoke before the fix: `/`, `/#dashboard`, `/#find-issues`, `/#board`, `/#settings`, and `/#profile` loaded the shell but rendered empty route content; console showed `ReferenceError: summarizeDashboardMetrics is not defined` from the built JS bundle.
- Built-preview route smoke after the fix at `http://127.0.0.1:4173`: `/`, `/#dashboard`, `/#find-issues`, `/#board`, `/#settings`, and `/#profile` all rendered non-empty `#app-content` with expected route text and no fresh console or page errors.
- Added Playwright route smoke coverage to `npm run test:layout` so blank valid routes and dashboard runtime errors fail the layout gate.
- Verification on 2026-05-22: `npm test` passed 148/148, `npm run build` passed, `npm run test:layout` passed 8/8, and a targeted built-preview route smoke passed for all requested routes.
- Remaining risk: this hotfix only covers local route rendering and did not exercise live GitHub API responses or real PAT behavior.

## 2026-05-24 Same-Label History Review Fix

- Fixed repo-history enrichment so the current issue is excluded from the same-label peer sample before `activeSameLabelIssues` and `staleSameLabelSample` are computed.
- Same-label search now fetches one extra issue (`per_page=6`) and keeps at most five peer issues after filtering, preserving the compact sample size while avoiding self-inflated scoring.
- Added regression coverage where the current issue is fresh but the only peer issue is stale; the summary now reports the stale peer sample instead of active same-label history.
- Verification on 2026-05-24: `npm test -- test/repo-history.test.js` passed 222/222 after the fix.
- Remaining risk: GitHub Search ordering and live metadata can still vary, but the current issue no longer contributes to same-label activity or stale-sample signals.

## 2026-05-24 Native Token Masking Review Fix

- Changed the GitHub token settings input to use native `type="password"` masking by default while preserving the existing eye-toggle UX.
- The visibility toggle now switches the input type between `password` and `text`, and the WebKit-only `-webkit-text-security` masking dependency was removed.
- Password-manager suppression attributes remain on the token input; token storage behavior was not changed.
- Verification on 2026-05-24: `node --test test/ui-copy.test.js` passed 25/25 after first failing against the old `type="text"` behavior.
- Remaining risk: native password inputs can still trigger some password-manager heuristics, but hidden-by-default masking no longer depends on non-standard CSS.

## 2026-05-24 Full Enrichment Pagination Review Fix

- Added shared read-only GitHub pagination for JSON array endpoints, following `rel="next"` links until no next page remains and validating every page URL through the GitHub API guard.
- Issue comments and issue timeline enrichment now inspect all returned pages instead of only the first 100 comments/events, preserving existing summary, cache, scoring, and inspector data shapes.
- Added regression coverage for page-two comment ownership/blocking signals, page-two timeline PR/assignment signals, final-page rate-limit reporting, and blocked non-GitHub pagination links.
- Verification on 2026-05-24: `node --test test/github-read-only.test.js test/issue-comments.test.js test/issue-timeline.test.js` passed 15/15 after first failing against the old one-page behavior.
- Remaining risk: full pagination can consume more GitHub core requests for very active issues, especially without a token.

## 2026-05-24 Duplicate Timeline + Repo Rate-Limit Review Fix

- Timeline summaries now treat duplicate/blocked event names as caution signals, covering GitHub duplicate timeline events even when no body text mentions duplication.
- Repo-history enrichment now returns both core and search rate-limit buckets while preserving the legacy single `rateLimit` field for compatibility.
- Inspector rate-limit updates now accept multi-bucket enrichment snapshots through the existing `store.setRateLimits` path.
- Verification on 2026-05-24: `node --test test/issue-timeline.test.js test/repo-history.test.js test/ui-copy.test.js` passed 37/37 after first failing against the old event-name and single-bucket behavior.
- Remaining risk: live GitHub rate-limit headers can vary, and duplicate/blocked timeline detection remains intentionally conservative to event names and existing text fields.

## 2026-05-24 Optional Same-Label Repo History Review Fix

- Repo-history enrichment now treats same-label sampling as optional for unlabeled issues, preserving recent PR history evidence instead of failing the full history step.
- Unlabeled issues skip the impossible search request and return a core-only rate-limit snapshot with `lastResource: 'core'`; labeled issues keep the existing core plus search snapshot.
- Verification on 2026-05-24: `node --test test/repo-history.test.js` passed 6/6 after first failing against the old no-label throw.
- Remaining risk: unlabeled issues have no same-label freshness signal, so repo history for them is intentionally PR-sample only.

## 2026-05-24 Hidden Lookup Suppression Fix

- Removed the Lookup exception that let hidden issues and hidden repositories reappear as result cards with `Hidden locally` recovery UI.
- Find Contributions and Lookup now both filter hidden results before rendering, scoring, sorting, card actions, and result-count display. Hidden item recovery remains in Settings and inspector contexts, not search results.
- Browser smoke on `http://127.0.0.1:5173/#find-issues`: looked up `facebook/react#1`, hid it, repeated the exact Lookup, and verified `Showing 0 issues` with no result card, `Hidden locally`, `Unhide`, or hidden-count hint.
- Verification on 2026-05-24: `node --test test/ui-copy.test.js test/hidden-items.test.js`, `npm test`, `npm run build`, and `git diff --check` passed.
- Remaining risk: GitHub Search can still return low-quality automation-created issues, but the matcher flags them as likely pass/low match; this change only enforces hidden suppression.

## 2026-05-24 Authenticated Platform Filter Loop Hotfix

- Cause: restrictive Target platforms filters launched background setup scans. When a GitHub token was active and issue repository visibility was unknown, the privacy guard correctly skipped persistent cache writes, but the finder then treated the same results as unscanned on every render. That created repeated setup fetches and desktop re-renders after Apply Filters.
- Fixed the loop by keeping normalized repo setup summaries in session memory when persistent cache writes are skipped, and by debouncing scan-triggered finder re-renders.
- Search card actions now resolve from the hidden-filtered result set instead of recomputing platform visibility at click time, so a visible card cannot become a dead click if setup compatibility cache changes between render and user action.
- Browser smoke on the authenticated local app at `http://127.0.0.1:5180/find-issues#find-issues`: Linux and Android unchecked, Apply Filters stayed clickable, 27 result cards remained stable over the wait window, Inspect opened the desktop drawer, and the screenshot was saved outside the repo at `C:/Users/Antho/AppData/Local/Temp/pr-dashboard-auth-os-filter-fixed.png`.
- Verification on 2026-05-24: `npm test -- test/platform-setup-scan.test.js test/ui-copy.test.js` passed 252/252, and `npm run build` passed.
- Remaining risk: live GitHub rate-limit headers can still change while setup/inspector enrichment runs, but the authenticated platform filter no longer reschedules the same uncached setup scans indefinitely.

## 2026-05-24 Lookup Platform Filter Opt-In Hotfix

- Addressed PR review thread `discussion_r3295800467`: exact Lookup results were still being passed through Target platforms result filtering even when `Use filters in Lookup` was disabled.
- Added an explicit `shouldApplyTargetPlatformResultFilter()` contract: Find mode always applies Target platforms, while Lookup applies them only when lookup filters are opted in.
- Render-time result filtering and background platform setup scans now use the last search mode, so exact Lookup remains broad/literal unless the user enables filters. Hidden issue/repo suppression remains active in Lookup.
- Browser smoke in an isolated Chromium context seeded a cached Linux-only setup summary for `microsoft/vscode#1`, selected Windows only, and verified the exact Lookup card stayed visible with `Use filters in Lookup` off, then hid only after the lookup filter checkbox was enabled. Screenshot saved outside the repo at `C:/Users/Antho/AppData/Local/Temp/pr-dashboard-lookup-platform-opt-out.png`.
- Verification on 2026-05-24: `npm test` passed 253/253, `npm run build` passed, and the targeted lookup platform smoke passed.
- Remaining risk: exact Lookup still scores the issue with normal contribution heuristics; this fix only restores the display/filtering contract.

## 2026-05-25 Platform Filter P2 Review Polish

- Addressed PR review threads `discussion_r3295849661` and `discussion_r3295849663`.
- Added a read-once repo setup cache resolver for platform filtering so a finder render does not reparse the full score enrichment cache for every visible issue. The finder now shares the same per-render summary resolver across result filtering, card rendering, and background setup scan candidate selection.
- Tightened platform mismatch wording so support-only evidence for an unselected platform falls back to selected-platform copy instead of contradictory text like `Target platform mismatch: Linux setup supported` when Windows is selected.
- Verification on 2026-05-25: `npm test` passed 255/255, `npm run build` passed, `npm run test:layout` passed 16/16, `git diff --check` passed, and a desktop browser smoke for `/#find-issues` passed without runtime errors or horizontal overflow. Screenshot saved outside the repo at `C:/Users/Antho/AppData/Local/Temp/pr-dashboard-p2-review-smoke.png`.
- Remaining risk: the browser smoke did not make live GitHub API calls; the cache and mismatch behavior are covered by deterministic unit tests.

## 2026-05-25 Lookup Scoring And Session TTL Review Fix

- Addressed PR review threads `discussion_r3295883527` and `discussion_r3295883529`.
- Exact Lookup scoring now follows the same `Use filters in Lookup` contract as result visibility: when lookup filters are off, platform scoring receives all target platforms so cached setup evidence cannot create a platform mismatch warning for a literal lookup.
- In-memory platform setup scan summaries now store an expiry and are deleted after the enrichment TTL, allowing long-lived tabs to rescan instead of treating stale session summaries as permanent cache hits.
- Verification on 2026-05-25: `npm test` passed 257/257, `npm run build` passed, `npm run test:layout` passed 16/16, `git diff --check` passed, and a deterministic exact Lookup browser smoke verified a Windows-only filter plus cached Linux-only setup did not show platform mismatch or `Not a contribution candidate` while `Use filters in Lookup` was off. Screenshot saved outside the repo at `C:/Users/Antho/AppData/Local/Temp/pr-dashboard-lookup-score-opt-out.png`.
- Remaining risk: the browser smoke used mocked GitHub API responses to keep the scoring regression deterministic; live GitHub data can still affect non-platform score signals.

## 2026-05-25 Passed Reversal Hidden-State Fix

- Addressed PR review thread `discussion_r3295918103`.
- Board movement now treats `Passed` hiding as reversible workflow state: entering `Passed` still hides the exact issue, while leaving `Passed` through either `moveCardToColumn` or `moveBoardCard` unhides that exact issue so Finder can show it again.
- Added store regressions for both board move paths and kept remove-from-board behavior unchanged.
- Verification on 2026-05-25: `npm test` passed 259/259, `npm run build` passed, `npm run test:layout` passed 16/16, `git diff --check` passed, and a board browser smoke moved a hidden Passed card back to Merged and verified its exact hidden issue key was removed. Screenshot saved outside the repo at `C:/Users/Antho/AppData/Local/Temp/pr-dashboard-passed-unhide-smoke.png`.
- Historical remaining risk: hidden issue storage did not record provenance in this pass. Resolved for new movement flows by the 2026-05-25 Passed Hidden Provenance fix.

## 2026-05-25 Passed Remove Hidden-State Fix

- Addressed PR review thread `discussion_r3298657974`.
- Removing a card from the board now captures the source lane before deletion and reuses the `Passed` hidden-state sync, so removing a `Passed` card also unhides that exact issue. Removing cards from other lanes still does not hide or pass the issue.
- Added a store regression for save -> move to `Passed` -> remove from board -> exact issue visible again.
- Verification on 2026-05-25: `node --test test/store-persistence.test.js` failed first against the old remove path, then passed 20/20 after the fix. `npm test` passed 260/260, `npm run build` passed, `npm run test:layout` passed 16/16, and a browser smoke removed a seeded `Passed` card through the inspector `Remove from board` button and verified the exact hidden key was cleared. Screenshot saved outside the repo at `C:/Users/Antho/AppData/Local/Temp/pr-dashboard-remove-passed-unhide-smoke.png`.
- Historical remaining risk: hidden issue storage still had no provenance in this pass. Resolved for new removal flows by the 2026-05-25 Passed Hidden Provenance fix.

## 2026-05-25 Platform Setup Scan Budget Fix

- Addressed PR review thread `discussion_r3298803420`.
- Restrictive Target platforms searches now have a cumulative per-search background setup-scan budget. The finder still scans only when platform filters are restrictive, but completed scans can no longer trigger rerenders that walk the next uncached batch until all visible results have been inspected. Search entry points also enter loading state before filter-change renders, preventing stale results from spending the new search budget.
- Added budget coverage for repeated renders in one search and a finder source contract requiring search-budget reserve/reset wiring.
- Verification on 2026-05-25: `node --test test/platform-setup-scan.test.js test/ui-copy.test.js` failed first against the old behavior, then passed 34/34 after the fix. `npm test` passed 261/261, `npm run build` passed, `npm run test:layout` passed 16/16, and `git diff --check` passed. Browser smoke with 20 mocked Linux-only results verified one search request, one repo metadata request, exactly 16 setup `/contents` requests for the 8-scan budget, and 12 visible cards after the first 8 scanned candidates were filtered. Screenshot saved outside the repo at `C:/Users/Antho/AppData/Local/Temp/pr-dashboard-platform-scan-budget-smoke.png`.
- Remaining risk: manually opening inspectors still performs deliberate setup enrichment outside the background budget, so live GitHub core usage can still increase when the user actively inspects many candidates.

## 2026-05-25 Platform Setup Stale Failure Fix

- Addressed PR review thread `discussion_r3298894681`.
- Background setup-scan failures are now scoped to the search run that started the scan. If an older in-flight setup request rejects after a newer search has reset the scan state, its failure is ignored instead of poisoning `platformFilterSetupScanFailures` for the active search.
- Added regression coverage for current-run versus stale-run failure recording and a finder source contract that prevents direct global failure writes from the async catch path.
- Verification on 2026-05-25: `node --test test/platform-setup-scan.test.js test/ui-copy.test.js` failed first against the old direct failure write, then passed 35/35 after the fix. `npm test` passed 262/262, `npm run build` passed, `npm run test:layout` passed 16/16, and `git diff --check` passed. Browser smoke started a second restrictive platform search while the first setup scan was still in flight, then failed the stale request; the active search rescanned successfully and hid the Linux-only candidate. Screenshot saved outside the repo at `C:/Users/Antho/AppData/Local/Temp/pr-dashboard-platform-stale-failure-smoke.png`.
- Remaining risk: stale successful setup scans can still populate factual session summaries for the same issue key, which is intentional because repo setup evidence is not search-filter-specific.

## 2026-05-25 Platform Evidence Filter Plan Implementation

- Replaced strict support-only target-platform matching with derived platform evidence: `confirmed`, `platform-neutral`, `mismatch`, and `pending`. Find Contributions now hides only explicit mismatches such as Linux-only/no-Windows evidence when Windows is selected and Linux is not.
- Result and inspector scoring now receive setup evidence, add a small selected-platform confirmation boost, and keep platform-neutral/pending results visible without penalty.
- Finder cards and inspector headers now render compact platform evidence badges. OS logo PNGs for iOS, Android, macOS, Linux, and Windows are bundled from `ngeenx/operating-system-logos` with local attribution; Web and neutral/pending badges use existing non-brand Material Symbols.
- Stars remain a local hydrated-repo metadata filter and now support `Any`, `50+`, `100+`, `500+`, `1k+`, `5k+`, and `10k+`.
- Verification on 2026-05-25: targeted platform/star/UI tests failed first against the old behavior, then passed. `npm test` passed 273/273, `npm run build` passed, `npm run test:layout` passed 16/16, and `git diff --check` passed. Browser smoke with mocked GitHub API data verified Linux-only filtering showed a Linux-confirmed card plus a Platform-neutral card, hid the Windows-only mismatch, rendered two platform evidence badges, had no console warnings/errors, and stayed within mobile viewport width. Screenshots saved outside the repo at `C:/Users/Antho/AppData/Local/Temp/pr-dashboard-platform-badges-desktop.png` and `C:/Users/Antho/AppData/Local/Temp/pr-dashboard-platform-badges-mobile-results.png`.
- Remaining risk: platform badges depend on the existing progressive setup scan budget, so some result cards can show `Platform pending` until setup evidence arrives.

## 2026-05-25 OS Badge Discovery Fix

- Separated badge display from platform filtering. Result cards now render icon-only OS/Web badges for confirmed support and never show visible `Platform pending`, `Platform-neutral`, or `confirmed` badge text; readable labels remain in aria/tooltips.
- Default Find Contributions searches now queue bounded background setup discovery for the top 30 unique result repos, even when every target platform checkbox is selected. Scans run with concurrency 4, reuse session summaries by repo, and stop the queue when GitHub rate-limit errors appear.
- Added explicit repo-topic first-pass badge evidence for only direct platform topics (`ios`, `android`, `macos`, `mac-os`, `linux`, `windows`, `web`). Generic stack or CI terms like Python, Streamlit, requirements, frontend, and `ubuntu-latest` do not imply OS/Web support.
- Verification on 2026-05-25: targeted platform/setup/UI/match tests failed first against the old behavior, then passed 85/85. `npm test` passed 276/276, `npm run build` passed, `npm run test:layout` passed 16/16, and mocked browser smoke verified 3 cards, 2 icon-only platform badge groups, 3 icons, no visible platform status words, no console warnings/errors, and no mobile horizontal overflow. Screenshots saved outside the repo at `C:/Users/Antho/AppData/Local/Temp/pr-dashboard-os-badges-desktop.png` and `C:/Users/Antho/AppData/Local/Temp/pr-dashboard-os-badges-mobile-results.png`.
- Remaining risk: cards outside the top 30 uncached repos may stay badge-free until they are inspected or appear in a later search; live GitHub core quota can still stop discovery early, but the queue now stops gracefully instead of looping.

## 2026-05-25 Confirmed Platform Filter And Badge Fix

- Tightened restrictive Target platforms filtering so confirmed support only for unchecked platforms is now a mismatch. Linux-only or Android-only results are hidden when those platforms are unchecked, while Windows + Linux remains visible if Windows is checked. Unknown, pending, and platform-neutral results remain visible.
- Platform badges now render as one quiet icon-only chip per confirmed platform. Badge chips no longer use grouped multi-icon containers, visible text labels, native titles, or app tooltip attributes; each keeps only an `aria-label` like `Linux supported`.
- Verification on 2026-05-25: focused platform/match/UI tests failed first against the old behavior, then passed 72/72. Related setup/search tests passed 20/20. `npm test` passed 277/277, `npm run build` passed, `npm run test:layout` passed 16/16, and `git diff --check` passed. Mocked browser smoke with Android and Linux unchecked verified Linux-only and Android-only results were hidden, Windows + Linux and neutral results stayed visible, badges were separate icon boxes with no tooltip/title/text, and desktop/mobile had no horizontal overflow. Screenshots saved outside the repo at `C:/Users/Antho/AppData/Local/Temp/pr-dashboard-platform-filter-badges-fixed-desktop.png` and `C:/Users/Antho/AppData/Local/Temp/pr-dashboard-platform-filter-badges-fixed-mobile.png`.
- Remaining risk: multi-platform cards still show factual icons for unchecked platforms after they pass through a checked platform, by design; live GitHub evidence quality still depends on discovered setup docs and exact repo topics.

## 2026-05-25 Mobile Finder Results-First Polish

- Find Contributions now renders the results panel before the long filter controls on mobile, while preserving the desktop filters-left/results-right layout through responsive order classes.
- OS/Web badges now use compact square 22px icon chips inside a tight icon group, keeping one separate chip per confirmed platform with no visible text or tooltip copy.
- Verification on 2026-05-25: `node --test test/ui-copy.test.js test/css-contract.test.js` failed first against the old mobile order and badge sizing, then passed 40/40 after the fix. `npm test` passed 279/279, `npm run build` passed, and `npm run test:layout` passed 16/16. Mocked browser smoke verified Android/Linux unchecked still hides unchecked-only results, desktop layout remains filters-left/results-right, mobile shows the first result card before filters with no horizontal overflow, and platform chips measure 22x22. Screenshots saved outside the repo at `C:/Users/Antho/AppData/Local/Temp/pr-dashboard-results-first-mobile-viewport.png`, `C:/Users/Antho/AppData/Local/Temp/pr-dashboard-results-first-mobile-full.png`, and `C:/Users/Antho/AppData/Local/Temp/pr-dashboard-results-first-badges-desktop.png`.
- Remaining risk: the smoke test used mocked GitHub API responses to keep the layout and platform evidence deterministic.

## 2026-05-25 Stale Platform Scan Queue Fix

- Validated PR review feedback that old background platform setup scan queues could continue dequeuing candidates after a newer search advanced `platformFilterSetupSearchRunId`.
- Added a queue-continuation guard that checks the scan run id before each candidate dequeue and suppresses final queue rerenders from stale runs.
- Verification on 2026-05-25: `node --test test/platform-setup-scan.test.js` failed first against the missing stale-run guard, then passed 6/6 after the fix. `node --test test/platform-setup-scan.test.js test/ui-copy.test.js` passed 38/38, `npm test` passed 280/280, `npm run build` passed, `npm run test:layout` passed 16/16, and `git diff --check` passed.
- Remaining risk: in-flight setup requests that already started before a new search can still finish and populate repo-level session summaries, which is intentional cache reuse; the fix stops stale queues from starting additional requests.

## 2026-05-25 Stale Platform Scan Rerender Fix

- Validated follow-up PR review feedback that in-flight stale setup scans could still schedule finder rerenders after a newer search became active.
- Added an active-run-aware rerender predicate and reused it for both individual scan completion and queue completion rerenders.
- Verification on 2026-05-25: `node --test test/platform-setup-scan.test.js` failed first against the missing stale-rerender guard, then passed 7/7 after the fix. `node --test test/platform-setup-scan.test.js test/ui-copy.test.js` passed 39/39, `npm test` passed 281/281, `npm run build` passed, `npm run test:layout` passed 16/16, and `git diff --check` passed.
- Remaining risk: stale in-flight requests may still update shared repo setup session summaries when they finish, which remains intentional cache reuse; they no longer schedule UI rerenders for newer searches.
