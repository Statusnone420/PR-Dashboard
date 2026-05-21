# PR Dashboard Security Notes

## GitHub Access

- Public issue search works without a GitHub Personal Access Token.
- A PAT is optional. It is only used to increase GitHub API rate limits or to run the Settings connection test.
- All GitHub API traffic in v0.1 is read-only. The app blocks `POST`, `PATCH`, `PUT`, and `DELETE` request methods through its GitHub request helper.
- Authorization headers are only attached to `https://api.github.com` requests.
- External GitHub issue links are validated before rendering and open in a new tab with `rel="noopener noreferrer"`.

## Token Storage

- Session-only memory is the default. If "Remember token locally" is not checked, the token is not written to `localStorage`.
- Remember mode is opt-in. When enabled, the token is stored in browser `localStorage`.
- `localStorage` is convenience storage, not secure secret storage. Do not use remember mode on shared or untrusted machines.
- Settings has separate destructive actions for token/settings, board data, and all app data. "Clear Token/Settings" does not wipe the board.

## Recommended Token Permissions

- No token is recommended for normal public issue search unless GitHub rate limits get in the way.
- If you use a fine-grained token, keep it limited to public repositories and read-only metadata/content access.
- If you use a classic token, avoid private repository and write scopes. `public_repo` is the broadest scope that should be considered for public-only workflows.
- Do not grant workflow, admin, package, deployment, organization, or private repository scopes for v0.1.

## Data Sent To GitHub

- Public issue searches send the GitHub search query and selected filters to `https://api.github.com/search/issues`.
- Saved issue refresh sends read-only `GET https://api.github.com/repos/{owner}/{repo}/issues/{number}` requests.
- Settings "Test Connection" sends a read-only `GET https://api.github.com/user` request with the entered token.
- The app does not have a backend and does not send tokens, board data, or settings to any app-owned server.
- Board cards and non-secret UI state are stored locally in the browser.

## Rendering Rules

- GitHub issue titles, bodies, repository names, users, labels, dates, URLs, and API error messages are escaped before template rendering.
- GitHub issue bodies are displayed as plain text. Raw Markdown or HTML from GitHub is not rendered.
- Unsafe issue URLs are not rendered as links. If possible, issue links are derived only from GitHub API repository URLs.
