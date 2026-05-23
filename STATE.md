# PR Dashboard State

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
