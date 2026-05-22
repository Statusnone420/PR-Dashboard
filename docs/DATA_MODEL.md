# PR Dashboard Data Model

## v1 Local-First Boundary

PR Dashboard v1 stores app durability data in the current browser. There is no backend sync, encrypted sync, database, GitHub OAuth, GitHub App auth, or app-owned remote storage in v1.

Export/Import Local Data is the current phone/desktop bridge. Exports include portable local app data only; GitHub tokens are never exported, and repository metadata cache is excluded. GitHub auth and encrypted sync are future backend-sync work.

## Real GitHub Issue Data

Search results come from `GET https://api.github.com/search/issues`. By default the query includes `is:issue state:open`, so closed issues are excluded unless the user explicitly checks "Include closed issues".

Saved board cards are copied from real GitHub search results. The app stores the issue title, body text, repository identity, labels, assignees, comments, state, dates, and GitHub URL as local snapshots so the board still works after a refresh.

## Local Board State

The board is local browser state stored under `pr_dashboard_board_cards`. Local board state includes the column, checklist progress, saved timestamp, and other local workflow fields.

The board starts empty in normal app startup. It is not seeded with fake/demo cards.

## Demo And Mock Data Rules

Mock issue data may exist in source files for tests, screenshots, or future explicit Demo Mode only. It must not be loaded into the production board during normal startup.

Old seeded board cards are detected by their known mock repository/issue signatures and removed during migration. The migration writes `pr_dashboard_board_migration_v1=seeded-mock-cards-removed` so the app can record that cleanup occurred.

The app must never combine fake issue titles/bodies/states/dates with real GitHub URLs.

## Stale Issue Refresh

Saved cards can become stale because GitHub issues can be renamed, closed, relabeled, reassigned, or updated after saving.

The board's "Refresh saved issues" action fetches current issue metadata with `GET https://api.github.com/repos/{owner}/{repo}/issues/{number}` and updates:

- title
- state
- state_reason
- updated_at
- closed_at
- labels
- assignee and assignees
- comments
- html_url
- repository identity

Local workflow data such as checklist progress and board column is preserved. Closed issues are shown with a warning and can be moved to Passed.

## Proof Log

Completed local contribution history is stored separately from the active board under `pr_dashboard_proof_log_v1`.

Proof Log entries use canonical lowercase issue keys such as `owner/repo#123` for storage identity. Display snapshots preserve the original GitHub repository casing when available.

Moving a board card into `Merged` creates or updates a local Proof Log entry with `status=marked_complete`. This is intentionally a local history record, not remote merge verification. Re-saving the same proof entry preserves its original `completed_at` and `created_at` values while updating `updated_at` and `last_seen_at`.

## Local Profile, Alerts, And Export

Profile metadata is stored under `pr_dashboard_profile_v1` and contains only non-secret GitHub identity fields from the Settings connection test. Remote avatar images are not rendered in v1.

Local alerts are computed from board state and local workflow timestamps such as `column_entered_at`, `last_moved_at`, and `last_refreshed_at`.

Export Local Data includes board cards, hidden keys, Proof Log entries, and profile metadata. It excludes GitHub tokens and the repository metadata cache. Import accepts the same local-first payload shape and ignores token/cache fields if they appear in a hand-edited file.
