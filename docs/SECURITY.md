# PR Dashboard Security Notes

## GitHub Access

- Public issue search works without a GitHub Personal Access Token.
- A PAT is optional. It is only used to increase GitHub API rate limits or to run the Settings connection test.
- All GitHub API traffic in Finder v2 is read-only. The app blocks `POST`, `PATCH`, `PUT`, and `DELETE` request methods through its GitHub request helper.
- Authorization headers are only attached to `https://api.github.com` requests.
- External GitHub issue links are validated before rendering and open in a new tab with `rel="noopener noreferrer"`.
- Exact Lookup validates GitHub issue URLs and `owner/repo#number` references before constructing an API URL.

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
- Do not grant workflow, admin, package, deployment, organization, or private repository scopes for v0.1.

## Data Sent To GitHub

- Public issue searches send the GitHub search query and selected filters to `https://api.github.com/search/issues`.
- Exact Lookup sends read-only `GET https://api.github.com/repos/{owner}/{repo}/issues/{number}` requests after local input validation.
- Finder v2 hydrates repository metadata with read-only `GET https://api.github.com/repos/{owner}/{repo}` requests so stars/forks and local stars filtering can work from non-secret repo data.
- Saved issue refresh sends read-only `GET https://api.github.com/repos/{owner}/{repo}/issues/{number}` requests.
- Settings "Test Connection" sends a read-only `GET https://api.github.com/user` request with the entered token.
- The app does not have a backend and does not send tokens, board data, or settings to any app-owned server.
- Board cards, hidden result keys, and non-secret UI state are stored locally in the browser.
- Proof Log entries and profile metadata are stored locally in the browser. Profile metadata is limited to non-secret GitHub identity fields from the Settings connection test and does not render remote avatar images in v1.
- Export Local Data includes board cards, hidden keys, profile metadata, and Proof Log entries. It excludes GitHub tokens and repository metadata cache.
- Repository metadata hydration caches only non-secret repository fields for 24 hours. Tokens, Authorization headers, API errors, and request URLs containing secrets are never cached.

## Hidden Results Storage

- Hidden issues and repositories are stored under `pr_dashboard_hidden_v1` in browser `localStorage`.
- Hidden issue entries use compact keys like `owner/repo#123` plus a timestamp.
- Hidden repository entries use compact keys like `owner/repo` plus a timestamp.
- Hidden storage does not include issue titles, issue bodies, labels, repository metadata, API responses, Authorization headers, or tokens.
- The Settings Hidden Results manager derives GitHub links from the stored keys. It does not fetch hidden issue titles or repository details.
- "Clear Hidden" removes hidden issue/repo keys only. "Clear All App Data" removes hidden keys along with token/settings and board data.

## Proof Log Storage

- Proof Log entries are stored under `pr_dashboard_proof_log_v1` in browser `localStorage`.
- Proof Log identity uses canonical lowercase keys like `owner/repo#123`; display casing from GitHub is preserved in snapshots when available.
- Entries created from the board `Merged` lane are local completion records with `status: marked_complete`. They are not remote merge verification.
- Proof Log storage does not include GitHub tokens or Authorization headers.

## Rendering Rules

- GitHub issue titles, bodies, repository names, users, labels, dates, URLs, and API error messages are escaped before template rendering.
- GitHub issue bodies are displayed as plain text. Raw Markdown or HTML from GitHub is not rendered.
- Unsafe issue URLs are not rendered as links. If possible, issue links are derived only from GitHub API repository URLs.
