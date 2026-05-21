# PR Dashboard Data Model

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
