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
