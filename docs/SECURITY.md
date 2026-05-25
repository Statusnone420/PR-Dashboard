# PR Dashboard Security Notes

## v1 Local-First Boundary

- PR Dashboard v1 is local-first and browser-only. There is no app backend, backend sync, encrypted sync, database, or app-owned remote storage.
- Export/Import Local Data is the current cross-device bridge for moving board cards, hidden keys, profile metadata, contribution preferences, learned feedback, and Proof Log entries between phone/desktop browsers.
- GitHub tokens are never exported. Import ignores token, repository metadata cache, and score/setup enrichment cache fields even if they are present in a hand-edited file.
- GitHub OAuth, GitHub App auth, and encrypted backend sync are deferred future work for a dedicated backend-sync project.

## GitHub Access

- Public issue search works without a GitHub Personal Access Token.
- A PAT is optional. It is only used to increase GitHub API rate limits or to run the Settings connection test.
- All GitHub API traffic is read-only. The app blocks `POST`, `PATCH`, `PUT`, and `DELETE` request methods through its GitHub request helpers.
- Authorization headers are only attached to `https://api.github.com` requests.
- External GitHub issue links are validated before rendering and open in a new tab with `rel="noopener noreferrer"`.
- Exact Lookup validates GitHub issue URLs and `owner/repo#number` references before constructing an API URL.
- Setup/platform evidence uses read-only GitHub contents requests for repository setup documents and config hints after issue/repo validation.

## GitHub API Limits

- Find Contributions uses `GET https://api.github.com/search/issues`, which is governed by GitHub Search API limits: 10 requests per minute without a token and 30 requests per minute with authentication.
- Exact Lookup and saved-card refresh use `GET https://api.github.com/repos/{owner}/{repo}/issues/{number}`, which uses the normal REST/core primary rate limit: 60 requests per hour without a token and 5,000 requests per hour with a user/PAT token.
- Repository metadata hydration, setup/platform evidence requests, and Settings "Test Connection" also use normal REST/core requests.
- The app uses response rate-limit headers for normal operation. The manual "Check limits" action calls `GET https://api.github.com/rate_limit` and shows the primary `core` and `search` buckets. GitHub does not expose a direct secondary-limit status bucket. See GitHub's [REST API rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api?apiVersion=2026-03-10) and [rate-limit endpoint notes](https://docs.github.com/en/rest/rate-limit/rate-limit?apiVersion=2026-03-10).

## Token Storage

- Session-only memory is the default. If "Remember token locally" is not checked, the token is not written to `localStorage`.
- Remember mode is opt-in. When enabled, the token is stored in browser `localStorage`.
- `localStorage` is convenience storage, not secure secret storage. Do not use remember mode on shared or untrusted machines.
- Settings has separate destructive actions for token/settings, board data, hidden results, and all app data. "Clear Token/Settings" does not wipe the board.
- "Clear Token/Settings" also clears local non-secret profile identity metadata, while keeping board cards, hidden keys, and Proof Log entries.

## Recommended Token Permissions

- No token is recommended for normal public issue search unless GitHub rate limits get in the way.
- If you use a fine-grained token, keep it limited to public repositories and read-only metadata/content access.
- If you use a classic token, avoid private repository and write scopes. `public_repo` is the broadest scope that should be considered for public-only workflows.
- Do not grant workflow, admin, package, deployment, organization, or private repository scopes for v1.

## Data Sent To GitHub

- Public issue searches send the GitHub search query and selected filters to `https://api.github.com/search/issues`.
- Exact Lookup sends read-only `GET https://api.github.com/repos/{owner}/{repo}/issues/{number}` requests after local input validation.
- The app hydrates repository metadata with read-only `GET https://api.github.com/repos/{owner}/{repo}` requests so stars/forks and local stars filtering can work from non-secret repo data.
- Setup/platform evidence may send read-only `GET https://api.github.com/repos/{owner}/{repo}/contents/...` requests for root contents, README, CONTRIBUTING, selected config files, workflow listings, and docs/CONTRIBUTING when available.
- Bounded background setup scans can run for visible uncached candidates after search/lookup results so target-platform filters can be corrected after setup summaries are cached. The scan is capped and stops for stale search runs or rate-limit failures rather than crawling every result indefinitely.
- Manual saved-card refresh sends read-only `GET https://api.github.com/repos/{owner}/{repo}/issues/{number}` requests for active board cards. Completed `Merged` and `Passed` lanes are excluded from active-board refresh.
- Settings "Test Connection" sends a read-only `GET https://api.github.com/user` request with the entered token.
- The app does not have a backend and does not send tokens, board data, or settings to any app-owned server.
- Board cards, hidden result keys, and non-secret UI state are stored locally in the browser.
- Activity data, Proof Log entries, learned feedback, contribution preferences, and profile metadata are stored locally in the browser. Profile metadata is limited to whitelisted non-secret GitHub identity fields from the Settings connection test.
- Profile/header avatar images may load from `https://avatars.githubusercontent.com/...` after strict URL validation. Tokens are never placed in avatar URLs or sent with image requests.
- Export Local Data includes portable local app data: board cards, hidden keys, profile metadata, contribution preferences, learned feedback, and Proof Log entries. It excludes GitHub tokens, repository metadata cache, and score/setup enrichment caches.
- Repository metadata hydration caches only non-secret repository fields for 24 hours. Tokens, Authorization headers, API errors, and request URLs containing secrets are never cached.

## Setup And Platform Evidence

- Setup/platform evidence is reduced to compact summary booleans and short reasons such as setup docs present, CI workflow found, test/build hints found, and platform supported/unsupported.
- Cached setup summaries do not include raw README or CONTRIBUTING text, raw config file bodies, tokens, Authorization headers, private data, API errors, or request URLs containing secrets.
- Setup summaries share the score-enrichment cache with other issue evidence and expire after the enrichment TTL. Token-authenticated private/unknown repository evidence is not persisted unless the repository is known public.
- Platform evidence is advisory and heuristic. Unknown setup compatibility remains visible and neutral until inspected or scanned.

## Hidden Results Storage

- Hidden issues and repositories are stored under `pr_dashboard_hidden_v1` in browser `localStorage`.
- Hidden issue entries use compact keys like `owner/repo#123` plus a timestamp.
- Hidden repository entries use compact keys like `owner/repo` plus a timestamp.
- Hidden storage does not include issue titles, issue bodies, labels, repository metadata, API responses, Authorization headers, or tokens.
- The Settings Hidden Results manager derives GitHub links from the stored keys. It does not fetch hidden issue titles or repository details.
- "Clear Hidden" removes hidden issue/repo keys only. "Clear All App Data" removes hidden keys along with token/settings, board data, Activity data, profile metadata, contribution preferences, learned feedback, and local caches.

## Proof Log Storage

- Proof Log entries are stored under `pr_dashboard_proof_log_v1` in browser `localStorage`.
- The Activity route owns the Proof Log surface, Review reminders, and learned feedback/history. Profile is limited to identity, stats, and contribution preferences.
- Proof Log identity uses canonical lowercase keys like `owner/repo#123`; display casing from GitHub is preserved in snapshots when available.
- Entries are created only when board cards enter the `Merged` lane or from startup backfill of existing `Merged` cards. They are local completion records with `status: marked_complete`, not remote merge verification.
- Exact Lookup does not directly create Proof Log entries. Save the item to the board and move it to `Merged` to create completed history.
- Proof Log storage does not include GitHub tokens or Authorization headers.

## Rendering Rules

- GitHub issue titles, bodies, repository names, users, labels, dates, URLs, and API error messages are escaped before template rendering.
- GitHub issue bodies are displayed as plain text. Raw Markdown or HTML from GitHub is not rendered.
- Unsafe issue URLs are not rendered as links. If possible, issue links are derived only from GitHub API repository URLs.
