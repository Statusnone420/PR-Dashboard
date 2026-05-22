<div align="center">

# PR Dashboard

Find GitHub issues worth contributing to, not just more issues.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF.svg)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38BDF8.svg?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Live on Vercel](https://img.shields.io/badge/live-Vercel-000000.svg?logo=vercel&logoColor=white)](https://pr-dashboard-xi.vercel.app/)
[![Local first](https://img.shields.io/badge/local--first-no_backend-2ea043.svg)](docs/SECURITY.md)
[![Security notes](https://img.shields.io/badge/security-notes_available-8b949e.svg)](docs/SECURITY.md)

[Live app](https://pr-dashboard-xi.vercel.app/) | [Security](docs/SECURITY.md) | [License](LICENSE)

</div>

![PR Dashboard Find Contributions view](qa_screenshots/finder-v2/find-contributions-results-1920x1080.png)

## What It Does

PR Dashboard is a local-first GitHub issue finder for people who want to make better contribution decisions. It keeps the familiar search flow, then adds deterministic scoring, contribution guidance, and a lightweight Board so promising candidates do not get lost.

The app runs entirely in the browser. There is no backend sync in v1, no model API dependency, and no app-owned server receiving your GitHub token or Board data. Export/Import Local Data is the current phone/desktop bridge.

## Highlights

- **Find Contributions** searches GitHub issues with contribution-focused filters.
- **Lookup** supports exact issue URLs and `owner/repo#123` references without breaking normal search.
- **Match/Fit Score** ranks issues with transparent scoring rows and pass reasons.
- **Contribution Brief** explains who an issue is best for, why it may be worth trying, and what to do first.
- **Hidden Results** lets you hide noisy issues or repos locally, then review or unhide them in Settings.
- **Board flow** saves candidates into a local Board for follow-up.
- **Proof Log** preserves completed local contribution history when board cards move to Merged.
- **Profile and Review reminders** summarize Proof Log records, Board health, profile avatar, and follow-up reminders without a backend.
- **Export/Import Local Data** moves board, hidden, profile, and Proof Log data between browsers without exporting tokens.
- **Optional GitHub token** increases rate limits while staying browser-local unless you choose remember mode.

## v1 Local-First Scope

v1 deliberately ships without GitHub OAuth, GitHub App auth, backend sync, encrypted sync, or a database. Profile/header avatars can render from safe GitHub avatar URLs returned by the existing Settings connection test; GitHub auth and encrypted sync are future backend-sync work.

## Quick Start

```bash
npm install
npm run dev
```

Then open the local URL printed by Vite.

Useful commands:

```bash
npm test
npm run build
```

## How It Handles Data

PR Dashboard talks directly to the GitHub REST API from your browser.

- Public searches work without a token.
- Tokens are optional and only used for GitHub API requests.
- Find Contributions uses GitHub Search API limits. Exact Lookup and saved-card refresh use normal REST/core issue endpoints; see [GitHub REST API rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api?apiVersion=2026-03-10) and [GitHub Search API limits](https://docs.github.com/en/rest/search/search?apiVersion=2026-03-10).
- Remembering a token is opt-in and uses browser `localStorage`.
- Saved board cards stay local to your browser.
- Proof Log entries, profile metadata, Hidden Results keys, and board-derived reminder data stay local to your browser.
- GitHub avatar images load directly from safe GitHub avatar URLs. Tokens are never placed in avatar URLs or sent with image requests.
- Export/Import Local Data is the current cross-device bridge.
- GitHub tokens are never exported, and repo metadata cache is excluded from exports.
- Hidden results are stored as compact issue/repo keys and timestamps only.
- No issue titles, bodies, labels, repo metadata, or tokens are stored in the hidden-results list.

Read the full security notes in [docs/SECURITY.md](docs/SECURITY.md).

## Project Structure

```text
src/
  api/                 GitHub API and repo metadata helpers
  state/               Local app store
  contributionBrief.js Rules-based contribution guidance
  hiddenItems.js       Local hidden issue/repo storage
  proofLog.js          Local completed-contribution history
  profile.js           Local non-secret profile metadata
  localData.js         Local export/import helpers
  localAlerts.js       Local workflow alert summaries
  lookup.js            Exact Lookup parsing
  main.js              SPA rendering and UI bindings
  matchScore.js        Match/Fit Score logic
test/                  Node test suite
docs/SECURITY.md       Security and token handling notes
```

## License

PR Dashboard is open source under the [MIT License](LICENSE).

MIT allows use, copying, modification, distribution, and commercial use, but the copyright and license notice must stay with copies or substantial portions of the software.

This project is not affiliated with GitHub.
