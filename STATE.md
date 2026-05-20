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
