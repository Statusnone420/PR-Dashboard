# PR Dashboard Data Model

## v1 Local-First Boundary

PR Dashboard v1 stores app durability data in the current browser. There is no backend sync, encrypted sync, database, GitHub OAuth, GitHub App auth, or app-owned remote storage in v1.

Export/Import Local Data is the current phone/desktop bridge. Exports include portable local app data only. GitHub tokens, repository metadata cache, score/setup enrichment caches, raw setup bodies, and Authorization data are never exported. GitHub auth and encrypted sync are future backend-sync work.

## Real GitHub Issue Data

Search results come from `GET https://api.github.com/search/issues`. By default the query includes `is:issue state:open`, so closed issues are excluded unless the user explicitly checks "Include closed issues".

Saved board cards are copied from real GitHub search results. The app stores the issue title, body text, repository identity, labels, assignees, comments, state, dates, and GitHub URL as local snapshots so the board still works after a refresh.

## Local Board State

The board is local browser state stored under `pr_dashboard_board_cards`. Local board state includes the column, checklist progress, saved timestamp, and other local workflow fields.

The board starts empty in normal app startup. It is not seeded with fake/demo cards.

Board columns include active workflow lanes plus final local outcome lanes. `Merged` and `Passed` are completed local outcomes. Dashboard and Profile saved-candidate metrics count active non-final board work; resolved/passed metrics count final local outcomes separately.

Moving a card to `Passed` hides that exact issue locally through Hidden Results. The card records whether the pass action created the hidden issue key, so leaving or removing `Passed` only reverses the hide when the pass action created it. Manual hides made before or after passing remain hidden.

## Demo And Mock Data Rules

Mock issue data may exist in source files for tests, screenshots, or future explicit Demo Mode only. It must not be loaded into the production board during normal startup.

README screenshots use curated public GitHub snapshots for deterministic rendering. Screenshot fixtures must keep public issue titles, numbers, labels, assignment state, comment counts, and URLs coherent, and must not mix invented issue content with real GitHub URLs.

Old seeded board cards are detected by their known mock repository/issue signatures and removed during migration. The migration writes `pr_dashboard_board_migration_v1=seeded-mock-cards-removed` so the app can record that cleanup occurred.

The app must never combine fake issue titles/bodies/states/dates with real GitHub URLs.

## Stale Issue Refresh

Saved cards can become stale because GitHub issues can be renamed, closed, relabeled, reassigned, or updated after saving.

Manual saved-card refresh actions fetch current issue metadata with `GET https://api.github.com/repos/{owner}/{repo}/issues/{number}`. `Refresh stale cards` selects stale cards in active workflow lanes and caps the primary batch at 10 requests. `Refresh all active cards` covers active workflow lanes only. `Merged` and `Passed` are completed local outcomes and are excluded from active-board refresh.

Saved-card refresh updates:

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

Local workflow data such as checklist progress and board column is preserved. Closed issues in active lanes are shown with a warning and can be moved to Passed or Merged locally.

## Score Enrichment And Setup Evidence

Issue comments, timeline, repo history, and repo setup summaries share a local score-enrichment cache under `pr_dashboard_score_enrichment_cache_v1`. Entries are keyed by canonical issue plus evidence type and expire after the enrichment TTL.

Repo setup evidence is fetched with read-only GitHub contents requests for setup documents and selected config/workflow hints. The stored setup summary is compact: inspected state, files checked, setup/doc/config/test flags, platform support/unsupported flags, and short reasons. Raw README/CONTRIBUTING/config bodies, request URLs, Authorization headers, API errors, and tokens are not stored.

Bounded background setup scans can reserve visible uncached candidates for setup inspection so target-platform filters can be corrected after summaries are cached. The scan budget is capped per search and stale scan runs do not keep updating the UI.

## Proof Log

Completed local contribution history is stored separately from the active board under `pr_dashboard_proof_log_v1`.

Proof Log entries use canonical lowercase issue keys such as `owner/repo#123` for storage identity. Display snapshots preserve the original GitHub repository casing when available.

Moving a board card into `Merged` creates or updates a local Proof Log entry with `status=marked_complete`. Startup also backfills entries for existing `Merged` cards. No other v1 UI path creates Proof Log entries. This is intentionally a local history record, not remote merge verification. Re-saving the same proof entry preserves its original `completed_at` and `created_at` values while updating `updated_at` and `last_seen_at`.

Activity owns the Proof Log surface, Review reminders, and learned feedback/history. Profile does not own Proof Log or reminders.

## Activity, Profile, Preferences, And Feedback

Profile metadata is stored under `pr_dashboard_profile_v1` and contains only whitelisted non-secret GitHub identity fields from the Settings connection test: `github_id`, `login`, `name`, `github_url`, `avatar_url`, and `saved_at`. Profile/header avatars render only from safe `https://avatars.githubusercontent.com/...` URLs and fall back to initials when unavailable.

Contribution preferences are stored under `pr_dashboard_contribution_preferences_v1`. They include normalized local preferences for languages, preferred work, avoided work, experience, time budget, and `saved_at`. They are used as local scoring context and do not contain tokens or private repository data.

Match feedback is stored under `pr_dashboard_match_feedback_v1`. It records compact learned feedback events from local actions such as save, enter Working, enter Merged, enter Passed, hide issue, and hide repo. Events store compact derived features such as language, repo key, labels, inferred work types, and scope. Raw issue bodies, tokens, emails, and secrets are not kept in feedback storage.

Review reminders are Activity-owned computed views from board state and local workflow timestamps such as `column_entered_at`, `last_moved_at`, `last_refreshed_at`, and GitHub activity acknowledgement metadata.

## Export And Import

Export Local Data includes portable local app data only: board cards, hidden keys, Proof Log entries, profile metadata, contribution preferences, and match feedback. It excludes GitHub tokens, remember-token settings, repository metadata cache, score/setup enrichment cache, raw enrichment/setup bodies, Authorization headers, API errors, and request URLs containing secrets.

Import accepts the same local-first payload shape and ignores token/cache fields if they appear in a hand-edited file. Board imports merge by canonical issue before numeric id, hidden imports merge compact keys by newest timestamp, Proof Log imports merge local history without wiping newer entries, contribution preferences keep the newer `saved_at`, and match feedback merges compact events without storing raw issue text.
