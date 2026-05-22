# PR Dashboard State

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
- Exact Lookup now accepts GitHub pull request URLs, bypasses hidden filtering, shows `Hidden locally`, and allows manual `Add to Proof Log` from cards and inspector.
- Board cards now get local movement timestamps, and moving to `Merged` through either move path creates local `marked_complete` proof history.
- Replaced the board's fixed horizontal row with a responsive wrapping grid and added a real `#profile` route plus an enabled local-alert bell.
- Export Local Data includes board, hidden keys, profile metadata, and Proof Log entries while excluding tokens and repo metadata cache.
- Files touched include `src/issueKeys.js`, `src/proofLog.js`, `src/profile.js`, `src/localAlerts.js`, `src/localData.js`, `src/state/store.js`, `src/main.js`, `src/styles.css`, `src/lookup.js`, docs, and focused tests.
- Verification: new tests were written first and failed before implementation. Final `npm test` passed 108/108, `npm run build` passed, and Browser smoke at `http://127.0.0.1:4173/` verified dashboard load, profile route, local alerts popover, responsive board grid without horizontal overflow, exact Lookup for `TEAMMATES/teammates#13998`, hide recovery, Proof Log add, profile proof visibility, and mobile `390x844` profile/board overflow checks with no console warnings/errors.
- Known limitations: Proof Log entries are local completion records, not remote merge verification. Export/import is the v1 multi-device bridge; automatic sync still requires a backend or user-managed sync layer later.

## 2026-05-22 v1 Local-First Hardening

- Direction confirmed: do not implement GitHub OAuth, backend sync, encrypted sync, GitHub App auth, database storage, or remote avatar rendering in this pass.
- v1 remains local-first. Export/Import Local Data is the current phone/desktop bridge; GitHub auth and encrypted sync are deferred to a later backend-sync project.
- Hardened regression coverage so Clear Board preserves Proof Log history, Clear All removes token, remember-token, board, migration, proof, profile, hidden, and repository metadata cache keys, and Import ignores token/repo metadata cache fields in hand-edited payloads.
- Documentation now states that GitHub tokens are never exported and repository metadata cache is excluded from exported local data.
- Verification on 2026-05-22: `npm test` passed 98/98 after the hardening coverage was added, and `npm run build` passed. A built-preview Playwright smoke verified dashboard and profile Proof Log history, exact Lookup recovery for a hidden item, and no horizontal board overflow at `1366x768` or `390x844`, with no console warnings/errors.
- Remaining risk: v1 cross-device movement is manual export/import only. Live GitHub data and public API rate limits can still vary over time, and no real PAT was used during this pass.
