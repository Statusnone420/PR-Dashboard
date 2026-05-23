# Match Score Full-System Implementation Plan

> **For agentic workers:** If your environment supports planning/execution sub-skills, use them. Otherwise, follow this `PLAN.md` task-by-task using the checkbox steps.

**Goal:** Upgrade PR Dashboard’s deterministic Match Score into a local-first personal matching system without redesigning the app or adding backend/AI dependencies.

**Architecture:** Keep the current Vite SPA and rules-based scoring model. Add structured scoring outputs, lean local preferences, local feedback learning, and lazy inspector-only GitHub enrichment in phased, verified increments. Search cards remain compact; richer details live in the inspector and Profile page.

**Tech Stack:** Vite, JavaScript ES modules, Tailwind CSS, browser `localStorage`, Node test runner, Playwright layout/screenshot tests, GitHub REST API read-only endpoints.

---

## 1. Purpose And Product Constraints

PR Dashboard helps a developer find GitHub issues worth contributing to, inspect risk, save candidates to a local board, and track contribution progress. The current Match Score is deterministic and explainable, but it mostly measures general contribution opportunity quality rather than whether an issue is a good match for the specific user.

This plan turns Match Score into a fuller local-first matching system while preserving the existing product feel:

- Keep deterministic scoring.
- Keep every score adjustment explainable through visible rows.
- Keep search fast.
- Keep result cards compact.
- Put deeper diagnostics in the inspector.
- Add a small preference profile on the Profile page.
- Use Board, Hidden Results, and Proof Log outcomes as transparent local feedback.
- Use GitHub enrichment lazily, starting with comments only.
- Stop after each phase for full verification and user review.

Implementation must follow `AGENTS.md`:

- Work in the current branch/workspace.
- Do not create additional worktrees.
- Use `apply_patch` for manual edits.
- Keep diffs small and targeted.
- Verify each phase before moving on.
- Update `STATE.md` only during implementation phases when repo changes are made.
- Do not rewrite unrelated user changes.
- Do not create commits, branches, pull requests, or pushes unless the user explicitly asks. Leave changes available for review as an uncommitted diff.

---

## 2. Current Architecture Areas To Inspect Before Coding

Before coding any phase, inspect these files in the current repo state. Do not assume this plan is fresher than the code.

- `AGENTS.md`
  - Local operating rules and repo constraints.
- `STATE.md`
  - Current implementation history, verification notes, known risks.
- `package.json`
  - Available scripts. Do not add scripts unless explicitly requested.
- `src/matchScore.js`
  - Current score constants, rows, caps, rating labels, `calculateMatchScore()`, `isContributionCandidate()`.
- `test/match-score.test.js`
  - Existing score regression coverage.
- `src/contributionBrief.js`
  - Current deterministic brief, scope, clarity, social risk, repo health logic.
- `test/contribution-brief.test.js`
  - Current brief behavior and labels.
- `src/profile.js`
  - Current GitHub identity-only local profile storage.
- `test/profile.test.js`
  - Profile storage safety expectations.
- `src/localData.js`
  - Export/import merge rules and excluded data.
- `test/local-data.test.js`
  - Export/import compatibility coverage.
- `src/state/store.js`
  - App state, storage clears, board movement, profile updates.
- `test/store-persistence.test.js`
  - Storage and persistence behavior.
- `src/main.js`
  - Rendering for Find Contributions, result cards, inspector, Profile, Settings, export/import bindings.
- `src/api/github.js`
  - Current read-only GitHub request helpers, search, lookup, rate-limit tracking.
- `src/api/repoMetadata.js`
  - Existing repo metadata hydration/cache pattern.
- `src/styles.css`
  - Existing design tokens, components, card/button/chip patterns.
- `test/ui-copy.test.js`
  - Product copy contracts and banned wording.
- Existing Playwright/layout tests:
  - `test/board-layout-a1.spec.cjs`
  - `test/e2e-hardening.spec.cjs`
  - `test/readme-gallery.spec.cjs`
  - configs under `test/*.config.cjs`

Use `Select-String`/PowerShell if `rg` is unavailable or fails on the Windows workspace.

---

## 3. Non-Goals

Do not implement any of these in this plan:

- No backend.
- No database.
- No GitHub OAuth.
- No GitHub App auth.
- No encrypted sync.
- No AI scoring.
- No model calls.
- No opaque learned weights.
- No cross-user learning.
- No redesign.
- No new component framework.
- No landing page or marketing UI.
- No auto-applied search filters from preferences.
- No automatic search-result enrichment in Phase 1 or Phase 2.
- No GraphQL requirement.
- No write methods to GitHub.
- No clone/fork/run-test/submit-PR behavior inside the app.
- No changing the current board workflow semantics.
- No hiding scores behind unexplained labels.
- No editing source, tests, styles, docs, or package scripts outside the requested phase scope.
- No commits, branches, pull requests, or pushes unless explicitly requested by the user.

---

## 4. Target `calculateMatchScore(issue, options)` Contract

The upgraded scoring function must preserve existing consumers while adding structured outputs.

### Target Signature

```js
calculateMatchScore(issue, options = {})
```

### Supported Options

```js
{
  now,
  profile,
  feedback,
  enrichment,
  stage
}
```

- `now`: timestamp override for deterministic tests.
- `profile`: normalized contribution preference profile, optional.
- `feedback`: local learned feedback summary, optional.
- `enrichment`: lazily fetched GitHub context, optional.
- `stage`: `"preview"` or `"enriched"`, optional. If omitted, infer `"enriched"` when enrichment is usable, otherwise `"preview"`.

### Existing Return Fields To Preserve

The return object must keep these fields with compatible meanings:

```js
{
  score,
  rating,
  rows,
  passReasons,
  flags,
  isContributionCandidate
}
```

Compatibility requirements:

- `score` remains an integer `0..100`.
- `rating` still comes from existing rating thresholds unless explicitly changed by a future user-approved spec.
- `rows` remains an array of signed point rows.
- Existing row labels should not churn unless behavior truly changes.
- `passReasons` remains an array of short chips.
- `flags.isAssigned`, `flags.hasBeginnerLabel`, and `flags.hasStaleLabel` remain available.
- `isContributionCandidate` remains based on the final score unless closed issue logic overrides it.

### New Return Fields

Add these fields:

```js
{
  stage,
  confidence,
  miniScores,
  personalFit
}
```

### `stage`

```js
stage: "preview" | "enriched"
```

- `"preview"` means score uses issue/search/repo metadata already available.
- `"enriched"` means score includes inspector-only cached GitHub enrichment.

### `confidence`

```js
confidence: {
  level: "High" | "Medium" | "Low",
  reasons: string[]
}
```

Rules:

- Confidence is separate from score.
- Missing data should not directly make a good issue look bad.
- Confidence caps are fixed unless tests prove they are impossible:
  - Low confidence: max score `88`.
  - Medium confidence: max score `94`.
  - High confidence: no confidence cap, but existing fake-perfect gates still apply.
- Changing these cap values requires explicit test updates and a note in `STATE.md`.
- Preview confidence must not treat missing future enrichment as a current-data failure.
- `Comments not inspected`, `Setup files not inspected`, and `Timeline not inspected` are advisory preview reasons only. They must not by themselves make confidence `Low`.
- Before enrichment exists, strong hydrated preview issues may be `High` confidence, or at worst `Medium`.
- `Low` confidence requires concrete weakness in data already available to the current phase, such as missing repo metadata, very short or vague issue body, unavailable issue body, stale or disabled repository, or conflicting risk signals.
- Confidence reasons must be concrete, such as:
  - `Repository metadata unavailable`
  - `Issue body is short`
  - `Comments not inspected`
  - `Setup files not inspected`
  - `Timeline not inspected`

### `miniScores`

```js
miniScores: {
  opportunityFit: { label, level, score, reasons },
  issueClarity: { label, level, score, reasons },
  scope: { label, level, score, reasons },
  repoHealth: { label, level, score, reasons },
  socialRisk: { label, level, score, reasons },
  setupEase: { label, level, score, reasons },
  personalFit: { label, level, score, reasons }
}
```

Keep level names plain and UI-friendly:

- `High`
- `Medium`
- `Low`
- `Unknown`

For negative dimensions such as Social Risk, use user-facing labels that read naturally:

- `Low risk`
- `Medium risk`
- `High risk`
- `Unknown`

### `personalFit`

```js
personalFit: {
  status: "Unknown" | "Matched" | "Mixed" | "Mismatch",
  adjustment: number,
  reasons: string[]
}
```

Rules:

- If no preference profile exists, return `Unknown`, adjustment `0`, and a reason like `No contribution preferences saved`.
- Personal preference adjustment is hard-capped at `+15 / -20`.
- Personal fit rows must be visible in `rows` when non-zero.

---

## 5. Mini-Score Definitions

### Opportunity Fit

Measures whether the issue is generally a good contribution candidate.

Signals:

- Open vs closed.
- Beginner-friendly labels.
- Strong contribution labels.
- Docs/tests/config/small fix labels or wording.
- Meta/growth/community/roadmap wording.
- Hard-pass labels such as stale, blocked, duplicate, wontfix, invalid.
- Bounded fix wording.
- Existing fake-perfect guard evidence.

Expected outputs:

- `High`: clear contribution target.
- `Medium`: plausible but needs inspection.
- `Low`: likely poor contribution target.
- `Unknown`: insufficient data.

### Issue Clarity

Measures whether the issue explains what outcome is expected.

Signals:

- Body length.
- Expected/actual behavior.
- Steps to reproduce.
- Acceptance criteria.
- Actionable task list.
- Vague wording such as unclear, not sure, somehow, details are unclear.
- Template compliance checklist false positives must not count as clarity.

Expected outputs:

- `High`: clear enough to start inspection.
- `Medium`: likely needs maintainer clarification.
- `Low`: too vague.
- `Unknown`: body unavailable or too little data.

### Scope

Measures likely size/boundedness of the work.

Signals:

- Small docs/readme/typo/config/copy cleanup.
- Bounded fix wording.
- Task list with actionable implementation items.
- Large/refactor/migration/redesign/architecture language.
- Broad project terms such as entire, across everything, roadmap.

Expected outputs:

- `Small`
- `Medium`
- `Large/unclear`
- `Unknown`

### Repo Health

Measures whether the repository looks active and viable.

Signals:

- Repo archived/disabled.
- Repo metadata availability.
- Repo pushed recently.
- Stars/open issues basic health.
- Recent merged PR sample in later phases.
- Repo label history in later phases.

Expected outputs:

- `High`: active repo.
- `Medium`: mixed/unclear activity.
- `Low`: stale/archived/disabled.
- `Unknown`: metadata unavailable.

### Social Risk

Measures whether taking the issue may duplicate work or require social navigation.

Signals:

- Assigned issue.
- Assignees list.
- Comment count.
- Staleness.
- Later enrichment:
  - comments saying `I'll take this`, `working on this`, `opened PR`, `I can work on this`
  - linked PR/timeline evidence
  - duplicate/blocked wording
  - maintainer path comments such as `PR welcome`, `happy to review`, `sounds good`

Expected outputs:

- `Low risk`: unassigned, quiet, no ownership evidence.
- `Medium risk`: needs social check.
- `High risk`: assigned, linked PR, or clearly claimed.
- `Unknown`: comments/timeline not inspected.

Default behavior must be cautious advisory. Do not strongly penalize vague comment phrases unless there is assignment or linked PR evidence.

### Setup Ease

Measures whether the repo looks practical to contribute to.

Signals:

- Later enrichment:
  - README exists.
  - CONTRIBUTING exists.
  - package/config files suggest commands are discoverable.
  - GitHub workflows exist.
  - test/build command hints exist.
  - setup instructions are missing or unclear.

Expected outputs:

- `Easy`
- `Moderate`
- `Hard`
- `Unknown`

Setup Ease remains `Unknown` before setup enrichment.

### Personal Fit

Measures match against the user’s saved lean profile.

Profile fields:

```js
{
  version: 1,
  languages: string[],
  preferredWork: string[],
  avoidWork: string[],
  experience: "first-pr" | "comfortable" | "advanced" | "",
  timeBudget: "under-1-hour" | "half-day" | "weekend" | "",
  saved_at: string
}
```

Signals:

- Repo language matches preferred language.
- Issue labels/text match preferred work.
- Issue labels/text match avoid work.
- Scope appears too large for time budget.
- Experience level aligns with beginner/deep-dive signals.

Expected outputs:

- `Matched`
- `Mixed`
- `Mismatch`
- `Unknown`

---

## 6. Scoring Caps And Hard Rules

### Closed Issues

Closed issues always force:

```js
score = 0
rating = "Risky / likely pass"
isContributionCandidate = false
```

Closed issues must ignore personal preference and feedback boosts. A closed issue cannot be rescued by personal fit, feedback, or enrichment.

### Personal Preference Adjustment Cap

Personal preference score adjustment must be hard-capped:

```text
maximum boost: +15
maximum penalty: -20
```

This prevents personal preferences from overpowering objective issue/repo risk.

### Local Feedback Adjustment Cap

Local feedback score adjustment must be hard-capped:

```text
maximum boost: +8
maximum penalty: -10
```

This keeps local learning useful but transparent and reversible.

### Confidence

Confidence is separate from score.

Use these confidence caps unless a test proves they are impossible:

```text
Low confidence: max score 88
Medium confidence: max score 94
High confidence: no confidence cap
```

High confidence still uses existing fake-perfect gates.

Changing these values requires:

- explicit test updates
- a note in `STATE.md`
- clear explanation in the final phase report

### Existing Fake-Perfect Gates

Preserve the current intent:

- Generic issue quality cannot stack into fake 100.
- Near-perfect scores require real contribution-fit evidence.
- Perfect scores require strong contribution labels or equivalent explicitly tested evidence.

---

## 7. Storage, Export, Import, And Clear Rules

### New Storage Keys

Add these local storage keys when the relevant phase implements them:

```js
export const CONTRIBUTION_PREFERENCES_STORAGE_KEY = 'pr_dashboard_contribution_preferences_v1';
export const MATCH_FEEDBACK_STORAGE_KEY = 'pr_dashboard_match_feedback_v1';
export const SCORE_ENRICHMENT_CACHE_KEY = 'pr_dashboard_score_enrichment_cache_v1';
```

Do not store preferences inside the existing GitHub identity `profile` object. Keep identity and contribution preferences separate.

### Preferences Storage

Preferences are non-secret and portable.

Store only normalized fields:

```js
{
  version: 1,
  languages: [],
  preferredWork: [],
  avoidWork: [],
  experience: "",
  timeBudget: "",
  saved_at: "ISO timestamp"
}
```

No token, email, location, private repo data, or arbitrary GitHub user fields.

### Feedback Storage

Feedback is non-secret and portable.

It may store compact aggregate patterns derived from local actions:

- saved to board
- moved to Working
- moved to Passed
- moved to Merged
- hidden issue
- hidden repo

Do not store full issue bodies in feedback records. Store compact feature buckets and counters only as values recomputed from durable event markers.

Allowed feedback shape:

```js
{
  version: 1,
  updated_at: "ISO timestamp",
  totals: {
    saved: 0,
    working: 0,
    passed: 0,
    merged: 0,
    hiddenIssue: 0,
    hiddenRepo: 0
  },
  buckets: {
    languages: {},
    workTypes: {},
    scope: {},
    repo: {},
    labels: {}
  },
  events: {}
}
```

Feedback recording must be idempotent.

In Phase 2, event markers are the source of truth for feedback.

Aggregates, totals, and buckets must be recomputed from event markers.

Do not directly mutate aggregate counters as the durable source of truth.

A given canonical issue key plus action/transition must not be counted twice because of:

- re-render
- reload
- import
- repeated movement into the same lane
- repeated save of an already-saved issue
- repeated hide of an already-hidden issue/repo
- duplicate markers in storage or import payloads

When deriving feedback from local board/hidden/proof state, first normalize it into compact per-canonical-issue/action event markers, then recompute aggregates from those markers.

Suggested event marker shape:

```js
events: {
  "owner/repo#123|saved": "2026-05-23T12:00:00.000Z",
  "owner/repo#123|entered:Working": "2026-05-23T12:05:00.000Z",
  "owner/repo#123|entered:Merged": "2026-05-23T12:30:00.000Z"
}
```

### Enrichment Cache

Enrichment cache is not portable.

It may store fetched public GitHub context summaries, but not tokens.

Do not cache enrichment for private repositories.

If repository visibility is unknown and a token was used for the request, do not cache the result. Do not create token-scoped enrichment cache entries as a workaround.

Clear enrichment cache when a GitHub token is saved, changed, or cleared.

Use TTL. Recommended initial TTL:

```text
6 hours for issue comments enrichment
24 hours for repo/setup enrichment
```

Keep cached values compact and sanitized. Do not cache Authorization headers, token-derived identity, private repository data, or any field that depends on who authenticated the request.

### Export Local Data

Update export to include:

- `contributionPreferences`
- `matchFeedback`

Continue excluding:

- GitHub tokens
- remember-token setting if currently excluded
- repo metadata cache
- score enrichment cache
- Authorization headers
- raw private data

### Import Local Data

Import must accept older payloads without preferences/feedback.

Merge behavior:

- Preferences: keep newer `saved_at`.
- Feedback: merge event markers first, then recompute counters. If only counters are available from an older payload, add counters conservatively without duplicating known local event markers.
- Enrichment cache: ignore imported enrichment cache if present in a hand-edited file.
- Tokens/cache fields: continue ignoring.

### Clear All

`clearAllLocalData()` must remove:

- token
- remember-token setting
- board
- migration key
- hidden items
- proof log
- GitHub identity profile
- repo metadata cache
- contribution preferences
- match feedback
- score enrichment cache

### Clear Token

`clearToken()` must remove:

- GitHub token
- remember-token setting
- GitHub identity profile
- rate limit state
- score enrichment cache

`clearToken()` must not remove:

- contribution preferences
- match feedback
- board
- proof log
- hidden items

---

## 8. UI Behavior

### Search Result Cards

Cards must remain compact.

Allowed additions:

- Confidence chip.
- One concise top reason if space allows.
- Existing `% Match` chip may stay as `Match`.
- Existing `Fit:` chip may stay.

Do not add a full mini-score grid to cards.

Card target content:

```text
92% Match
Fit: First PR
Confidence: Medium
```

If one reason is shown, keep it short:

```text
Matches TypeScript preference
Medium confidence: comments not inspected
```

### Inspector

Inspector is the main diagnostic surface.

Add or update inspector details to show:

- Match Score header/rating.
- `Preview` or `Enriched` stage label.
- Confidence level and reasons.
- Mini-score list/grid.
- Existing signed score rows.
- Existing pass reason chips.
- Loading state while enrichment is fetching.
- Non-blocking error state if enrichment fails.

Inspector must remain readable on desktop and mobile.

Use existing visual language:

- `bg-surface-container`
- `border-outline-variant`
- compact chips
- no new palette
- no nested card stacks beyond existing style
- no marketing copy
- no magic/AI language

### Profile Contribution Preferences

Add a Profile page card called:

```text
Contribution preferences
```

Recommended layout:

- Compact chips for preferred work.
- Compact chips for avoid work.
- Small language entry or chip selector.
- Segmented/chip controls for experience.
- Segmented/chip controls for time budget.
- Save and Reset actions.

Keep Settings focused on GitHub token, hidden items, export/import, and danger zone.

Preferences should not auto-run a search and should not auto-apply filters.

### Loading/Error States

For enrichment:

- Loading: show `Checking comments...` or similar plain copy.
- Error: show `Could not load comment context. Preview score is still available.`
- Rate limit: show `GitHub rate limit prevented enrichment. Try again later or use a token.`
- Never block saving/inspecting because enrichment failed.

---

## 9. GitHub Enrichment Rules

Enrichment is not Phase 1.

When implemented, enrichment must be:

- Inspector-only.
- Read-only.
- REST API only unless user explicitly approves GraphQL later.
- Cached.
- Rate-limit aware.
- Non-blocking.
- Optional for score improvement.
- Safe without a token, but better with one.

Official GitHub REST docs to consult before implementing enrichment:

- Issue comments: https://docs.github.com/en/rest/issues/comments
- Issue timeline events: https://docs.github.com/en/rest/issues/timeline
- Pull requests: https://docs.github.com/en/rest/pulls/pulls
- Repository contents: https://docs.github.com/en/rest/repos/contents

Never send write methods. Existing `createGitHubRequestOptions()` blocks write methods; preserve that behavior.

---

## 10. Phase Overview

There are exactly five implementation checkpoints.

Each phase must be independently useful, fully verified, and stopped before the next phase.

1. Phase 1A: Match Score v3 Core Data.
2. Phase 1B: Match Score v3 UI.
3. Phase 2: Local Feedback Learning.
4. Phase 3: Lazy Inspector Enrichment, comments first.
5. Phase 4: Advanced Enrichment.

Implementing agents must execute only the phase requested by `/goals`.

---

# Phase 1A: Match Score v3 Core Data

## Scope

Phase 1A adds structured scoring output, lean contribution preference storage, confidence, mini-scores, personal fit, store/data wiring, and export/import behavior. It does not add visible score UI, outcome feedback, or GitHub enrichment.

Implement:

- `calculateMatchScore(issue, options)` target return shape.
- `confidence`.
- `miniScores`.
- `personalFit`.
- `contributionPreferences` storage module.
- Store/data wiring for preferences.
- Export/import preferences.
- Clear All/Clear Token behavior for preferences.

## Explicit Non-Scope

Do not implement:

- Profile contribution preferences UI.
- Card confidence chip.
- Inspector mini-score/confidence section.
- UI redesign or layout changes.
- Local feedback learning.
- Enrichment cache.
- Comment fetching.
- Timeline fetching.
- Repo contents fetching.
- Recent PR sampling.
- Repo-aware label history.
- Any backend/auth change.
- Auto-applying preferences to filters.

## Likely Files

Create:

- `src/contributionPreferences.js`
- `test/contribution-preferences.test.js`

Modify:

- `src/matchScore.js`
- `test/match-score.test.js`
- `src/main.js` only if needed to pass preferences into the existing score wrapper without visible UI changes
- `src/state/store.js`
- `src/localData.js`
- `test/local-data.test.js`
- `test/store-persistence.test.js`
- `STATE.md`

Do not touch styles in Phase 1A.

## Implementation Checklist

- [ ] Inspect current `src/matchScore.js` and tests.
- [ ] Add tests for the new return shape while preserving old fields.
- [ ] Add confidence helper tests:
  - repo metadata unavailable gives lower confidence.
  - short issue body gives lower confidence.
  - well-described hydrated issue gives high confidence.
  - missing comments/setup/timeline alone does not make preview confidence `Low`.
  - strong hydrated preview issues can still score above `90` when comments/setup/timeline are not inspected.
  - low confidence requires current-data weakness such as missing repo metadata, very short/vague body, unavailable body, stale/disabled repo, or conflicting risk signals.
  - low confidence caps score at `88`.
  - medium confidence caps score at `94`.
  - high confidence uses no confidence cap but still uses fake-perfect gates.
- [ ] Add mini-score tests for all seven mini-scores.
- [ ] Add personal profile tests:
  - no profile returns `Unknown`, adjustment `0`.
  - preferred language match adds a row and adjustment.
  - preferred work match adds a row and adjustment.
  - avoid work match subtracts a row and adjustment.
  - time budget mismatch subtracts a row and adjustment.
  - personal adjustment cannot exceed `+15`.
  - personal adjustment cannot go below `-20`.
- [ ] Preserve closed issue hard zero with profile present.
- [ ] Preserve fake-perfect gates.
- [ ] Implement helpers in `src/matchScore.js` without large rewrites.
- [ ] Create `src/contributionPreferences.js`.
- [ ] Implement:
  - storage key
  - default preferences
  - normalize preferences
  - load
  - save
  - clear
  - merge newer preference on import
  - drop malformed or disallowed preference fields on import
- [ ] Add store fields/methods for preferences.
- [ ] Add export/import support.
- [ ] Ensure export excludes tokens and caches.
- [ ] Ensure malicious or hand-edited imports cannot add token/cache/private fields through preferences.
- [ ] Ensure Clear All removes preferences.
- [ ] Ensure Clear Token preserves preferences.
- [ ] Pass profile preferences into `calculateFitScore()` or equivalent score wrapper.
- [ ] Avoid visible UI changes. If a visible UI change happens accidentally, stop and move that work to Phase 1B.
- [ ] Update tests.
- [ ] Update `STATE.md` with changes, verification, and remaining risk.

## Tests

Run targeted tests first if supported:

```powershell
npm test -- test/match-score.test.js
```

If Node test filtering does not support the above in this repo, run:

```powershell
npm test
```

Required assertions:

- Existing Match Score tests still pass.
- Closed issue is still zero.
- Old consumers can still read `score`, `rating`, `rows`, `passReasons`, `flags`, `isContributionCandidate`.
- New fields exist and are stable.
- Preview missing enrichment reasons do not make confidence `Low` by themselves.
- Strong hydrated preview issues can still score above `90` without comments/setup/timeline enrichment.
- Low confidence requires concrete current-data weakness.
- Confidence caps are exactly:
  - Low: `88`
  - Medium: `94`
  - High: no confidence cap
- Preference save/load/clear works.
- Export/import includes preferences.
- Imported preferences drop token, email, private repo data, arbitrary fields, malformed values, and hand-edited cache/token fields.
- Token is not exported.
- Clear Token preserves preferences.
- Clear All removes preferences.

## UI/Screenshot Checks

Phase 1A should not require screenshots because it should not change visible UI.

If visible UI changes accidentally occur, stop and move that work to Phase 1B. If a tiny unavoidable visible change remains, run the relevant existing layout/browser smoke and inspect the diff before stopping.

## Data Checks

- Inspect local storage keys after saving preferences.
- Confirm preferences JSON has only allowed fields.
- Confirm export includes preferences.
- Confirm export does not include token or enrichment cache.
- Confirm import from old payload without preferences still works.
- Confirm malicious or hand-edited imports cannot persist token, cache, private repo data, email, arbitrary fields, or malformed preference values.

## Risks

- New mini-score objects could break assumptions in contribution brief if not backward-compatible.
- Score changes could churn existing tests; update only where behavior intentionally changed.
- `src/main.js` is large. If Phase 1A needs it only to pass preferences into scoring, keep the edit invisible and minimal.

## Stop Condition

Stop Phase 1A after:

- `npm test` passes.
- `npm run build` passes.
- `git diff --check` passes.
- Any accidental visible UI change is moved to Phase 1B or separately smoke checked.
- `STATE.md` is updated.
- Stop and wait for user review.

Do not continue to Phase 1B without explicit user instruction.

---

# Phase 1B: Match Score v3 UI

## Scope

Phase 1B adds compact UI for the Phase 1A scoring and preference data. It does not change scoring rules beyond reading the fields created in Phase 1A.

Implement:

- Profile contribution preferences card.
- Compact preference controls and Save/Reset behavior.
- Card confidence chip.
- Inspector mini-score/confidence section.
- UI/copy tests.
- Screenshot/layout checks.

## Explicit Non-Scope

Do not implement:

- Local feedback learning.
- GitHub enrichment.
- Enrichment cache.
- Search-result auto-enrichment.
- Auto-applying preferences to filters.
- Backend/auth changes.
- Scoring rule changes not required to display Phase 1A fields.
- Major redesign of cards, inspector, or Profile.

## Likely Files

Modify:

- `src/main.js`
- `test/ui-copy.test.js`
- `test/store-persistence.test.js` if Save/Reset behavior needs store coverage
- `src/styles.css` only if existing utilities cannot support the needed compact UI
- `STATE.md`

## Implementation Checklist

- [ ] Inspect Phase 1A preference store and score return shape.
- [ ] Add Profile contribution preferences card.
- [ ] Add compact controls for languages, preferred work, avoid work, experience, and time budget.
- [ ] Add Save and Reset actions using the Phase 1A store/data helpers.
- [ ] Keep Settings focused on token, hidden items, export/import, and danger zone.
- [ ] Do not auto-run search or auto-apply filters from preferences.
- [ ] Pass saved contribution preferences into card and inspector scoring.
- [ ] Add compact card confidence chip while keeping existing Match and Fit chips.
- [ ] Add inspector stage, confidence reasons, and mini-score section.
- [ ] Keep existing score rows and pass reason chips visible.
- [ ] Keep cards compact and inspector scannable on desktop and mobile.
- [ ] Update UI/copy tests.
- [ ] Update `STATE.md` with changes, verification, screenshots, and remaining risk.

## Tests

Required assertions:

- UI copy tests pass.
- Profile page includes `Contribution preferences`.
- Save/Reset controls are present and do not expose token/private-data wording.
- Result cards keep existing Match and Fit chips and add only compact confidence UI.
- Inspector shows stage, confidence reasons, mini-scores, existing score rows, and pass reason chips.
- Preferences do not auto-run search or auto-apply filters.

Run:

```powershell
npm test
npm run build
git diff --check
```

## UI/Screenshot Checks

Affected screens:

- Find Contributions desktop.
- Find Contributions mobile.
- Inspector desktop.
- Inspector mobile.
- Profile desktop.
- Profile mobile.
- Settings export/import if visible copy changes.

Minimum screenshot matrix:

```text
1920x1080: Find Contributions, inspector, Profile
390x844: Find Contributions, inspector, Profile
375x667: Profile, inspector
```

Use existing layout/browser tests where available:

```powershell
npm run test:layout
```

If running Playwright updates screenshots, inspect diffs and restore unrelated screenshot churn unless the phase intentionally updates them.

## Data Checks

- Confirm Profile Save writes only normalized contribution preferences.
- Confirm Reset removes only contribution preferences.
- Confirm Clear Token still preserves contribution preferences.
- Confirm Clear All still removes contribution preferences.

## Risks

- `src/main.js` is large; keep edits localized.
- Preference UI could make Profile feel too heavy.
- Mini-score UI could make the inspector too dense.
- Card chips can wrap awkwardly on mobile; screenshots must catch this.

## Stop Condition

Stop Phase 1B after:

- `npm test` passes.
- `npm run build` passes.
- `git diff --check` passes.
- Affected UI is screenshot/smoke checked.
- `STATE.md` is updated.
- Stop and wait for user review.

Do not continue to Phase 2 without explicit user instruction.

---

# Phase 2: Local Feedback Learning

## Scope

Phase 2 adds transparent local learning from user actions. It uses Board, Hidden Results, and Proof Log behavior to create small explainable score nudges.

Feedback signals:

- Saved to board: mild positive.
- Moved to Working: stronger positive.
- Moved to Passed: negative.
- Moved to Merged: very strong positive.
- Hidden issue: negative.
- Hidden repo: negative.

Implement compact event-marker feedback storage, recomputed aggregate summaries, and scoring rows.

## Explicit Non-Scope

Do not implement:

- GitHub API enrichment.
- Comments/timeline/repo files.
- Backend sync.
- AI learning.
- Invisible weight mutation.
- Strong auto-adaptation.
- New board lanes.
- New Proof Log semantics.
- Cross-user learning.

## Likely Files

Create:

- `src/matchFeedback.js`
- `test/match-feedback.test.js`

Modify:

- `src/matchScore.js`
- `test/match-score.test.js`
- `src/state/store.js`
- `test/store-persistence.test.js`
- `src/localData.js`
- `test/local-data.test.js`
- `src/main.js`
- `test/ui-copy.test.js`
- `STATE.md`

## Implementation Checklist

- [ ] Inspect board movement methods in `src/state/store.js`.
- [ ] Inspect hidden item methods in `src/state/store.js`.
- [ ] Inspect proof log creation/removal paths.
- [ ] Design compact feature buckets:
  - language
  - work type
  - scope
  - repo full name
  - labels
- [ ] Make feedback recording idempotent before wiring it into store actions.
- [ ] Store per-canonical-issue/action event markers as the durable source of truth.
- [ ] Recompute aggregate totals and buckets from event markers.
- [ ] Do not directly mutate aggregate counters as durable state.
- [ ] Add tests for feedback storage normalization.
- [ ] Add tests that saving to board increments feedback once.
- [ ] Add tests that saving an already-saved issue does not double-count feedback.
- [ ] Add tests that moving to Working increments feedback once.
- [ ] Add tests that repeated movement into Working does not double-count the same canonical issue/action marker.
- [ ] Add tests that moving to Merged increments feedback once.
- [ ] Add tests that moving to Passed increments negative feedback once.
- [ ] Add tests that hiding issue/repo increments negative feedback once.
- [ ] Add tests that reloading/re-rendering does not increment feedback.
- [ ] Add tests that import merge does not double-count known markers.
- [ ] Add tests that duplicate markers in storage/import are deduped before aggregate recompute.
- [ ] Add tests that feedback adjustment is capped at `+8 / -10`.
- [ ] Add tests that closed issue remains zero even with positive feedback.
- [ ] Implement `matchFeedback.js`.
- [ ] Wire store actions to record feedback.
- [ ] Pass feedback into `calculateMatchScore()`.
- [ ] Add score rows:
  - `+N Matches your completed contribution patterns`
  - `-N Similar items were passed or hidden locally`
- [ ] Add Profile display for learned feedback summary.
- [ ] Add reset learned feedback action on Profile.
- [ ] Include feedback in Export Local Data.
- [ ] Merge feedback on Import Local Data.
- [ ] Ensure Clear All removes feedback.
- [ ] Ensure Clear Token preserves feedback.
- [ ] Update UI/copy tests.
- [ ] Update `STATE.md`.

## Tests

Required tests:

- Feedback save/load/clear.
- Feedback aggregate recompute from markers.
- Feedback aggregate merge.
- Board actions record expected counters.
- Board actions do not double-count on re-render, reload, repeated save, or repeated lane entry.
- Hidden actions record expected counters once.
- Proof/Merged actions record expected counters once.
- Feedback score adjustment cap.
- Export/import includes feedback.
- Import does not duplicate existing feedback markers.
- Duplicate event markers are deduped before recomputing totals/buckets.
- Token is not exported.
- Clear All removes feedback.
- Clear Token preserves feedback.

Run:

```powershell
npm test
npm run build
git diff --check
```

## UI/Screenshot Checks

Affected screens:

- Profile desktop.
- Profile mobile.
- Find Contributions result card if score/row output visibly changes.
- Inspector score rows.
- Board movement smoke if store behavior changed.
- Settings export/import status if copy changes.

Minimum screenshot matrix:

```text
1920x1080: Profile, inspector
390x844: Profile
375x667: Profile
```

## Data Checks

- Confirm feedback stores aggregate counters and compact event markers, not full issue bodies.
- Confirm export contains feedback but not enrichment cache.
- Confirm imported older payloads still work.
- Confirm reset learned feedback removes only feedback.
- Confirm Clear Token preserves feedback.

## Risks

- Store movement paths may duplicate feedback events if an action is retried or re-rendered.
- Moved cards can pass through lanes; idempotent markers are required.
- Feedback should be useful but not noisy in score rows.
- Hidden repo feedback can be broad; keep penalty capped.

## Stop Condition

Stop Phase 2 after:

- Full verification passes.
- Feedback storage shape is inspected.
- UI is smoke/screenshot checked.
- `STATE.md` is updated.
- Stop and wait for user review and explicit approval to move to Phase 3.

Do not continue to Phase 3 without explicit user instruction.

---

# Phase 3: Lazy Inspector Enrichment, Comments First

## Scope

Phase 3 adds inspector-only GitHub comment enrichment.

Fetch issue comments when an issue is inspected, cache a compact summary, and use it to refine Social Risk and confidence.

Comment enrichment should detect:

- maintainer encouragement:
  - `PR welcome`
  - `happy to review`
  - `sounds good`
  - `go ahead`
- ownership/claimed signals:
  - `I'll take this`
  - `working on this`
  - `I can work on this`
  - `opened a PR`
- blocked/duplicate hints:
  - `blocked by`
  - `duplicate of`
  - `waiting on`
- bot-only recent activity.

Start with comments only. Do not fetch timeline, repo files, or PR samples in this phase.

## Explicit Non-Scope

Do not implement:

- Timeline events.
- Linked PR detection through timeline.
- Repo setup files.
- Recent PR sampling.
- Repo-aware label history.
- Search-result auto-enrichment.
- Reordering results after enrichment.
- Backend/AI.

## Likely Files

Create:

- `src/api/issueComments.js`
- `test/issue-comments.test.js`

Modify:

- `src/matchScore.js`
- `test/match-score.test.js`
- `src/state/store.js`
- `src/main.js`
- `src/api/github.js` if shared request helpers are needed
- `test/ui-copy.test.js`
- `STATE.md`

## Implementation Checklist

- [ ] Inspect existing GitHub request helper patterns.
- [ ] Create safe issue comments API helper using read-only REST.
- [ ] Use existing token and rate-limit tracking patterns.
- [ ] Add storage/cache helpers for comment enrichment under enrichment cache key.
- [ ] Cache by canonical issue key.
- [ ] Add TTL for comment enrichment.
- [ ] Do not cache private repository enrichment.
- [ ] Do not cache if repository visibility is unknown and a token was used.
- [ ] Clear enrichment cache when the token is saved, changed, or cleared.
- [ ] Add tests for API URL construction.
- [ ] Add tests blocking non-GitHub or invalid issue references.
- [ ] Add tests parsing comment summary:
  - maintainer encouragement.
  - ownership claim.
  - blocked hint.
  - bot-only recent activity.
- [ ] Add tests for enrichment cache load/save/expiry.
- [ ] Add inspector loading state.
- [ ] Trigger comment enrichment only from inspector open.
- [ ] Do not trigger enrichment from search card rendering.
- [ ] Pass enrichment summary into `calculateMatchScore()`.
- [ ] Make enriched score `stage: "enriched"`.
- [ ] Update confidence reasons:
  - before comments: `Comments not inspected`
  - after comments: remove that reason or mark comments inspected.
- [ ] Add score rows for comment evidence:
  - `+N Maintainer appears open to PRs`
  - `-N Comment thread suggests someone may be working on this`
  - `-N Comment thread suggests blocked work`
- [ ] Keep social-risk penalties cautious unless evidence is strong.
- [ ] Show inspector error state if comments fail.
- [ ] Do not block Save/Hide/Open actions if comments fail.
- [ ] Update `STATE.md`.

## Tests

Required tests:

- Issue comments URL construction.
- GitHub API request remains read-only.
- Authorization only goes to `https://api.github.com`.
- Comment summary classification.
- Bot-only recent activity does not count as maintainer encouragement.
- Enrichment cache TTL.
- Enrichment cache privacy and token-change clearing.
- Enriched scoring rows.
- Enriched confidence behavior.
- Inspector loading/error copy exists.
- No comment fetch from initial search rendering.

Run:

```powershell
npm test
npm run build
git diff --check
```

## UI/Screenshot Checks

Affected screens:

- Inspector loading state.
- Inspector enriched state.
- Inspector enrichment error state.
- Find Contributions cards should not gain heavy UI.
- Mobile inspector.

Minimum screenshot matrix:

```text
1920x1080: inspector loading/enriched
390x844: inspector enriched
375x667: inspector error or low-confidence state
```

Use mocked Playwright routes for deterministic comment responses. Do not depend on live GitHub comments for screenshot tests.

## Data Checks

- Confirm enrichment cache is not exported.
- Confirm cache contains compact summaries only.
- Confirm no token/header/token-derived identity is cached.
- Confirm private repositories and token-used unknown-visibility responses are not cached.
- Confirm Clear All removes enrichment cache.
- Confirm token save/change/clear removes enrichment cache.

## Risks

- GitHub comment endpoints can hit rate limits.
- Live comments are messy; avoid overconfident penalties.
- Maintainer identity is not always known from comments alone. Use cautious wording.
- Inspector re-renders can cause duplicate fetches if not guarded.

## Stop Condition

Stop Phase 3 after:

- Full verification passes.
- Mocked browser smoke confirms inspector enrichment.
- API/cache safety is inspected.
- `STATE.md` is updated.
- Stop and wait for user review and explicit approval to move to Phase 4.

Do not continue to Phase 4 without explicit user instruction.

---

# Phase 4: Advanced Enrichment

## Scope

Phase 4 adds additional lazy inspector enrichment beyond comments.

Add, in this order:

1. Timeline events for linked PR/closed/renamed/referenced/assigned context.
2. Repo setup ease from README/CONTRIBUTING/config/workflow files.
3. Recent repo PR sample.
4. Same-label recent issue sample for repo-aware label quality.

All enrichment remains inspector-only, read-only, cached, and non-blocking.

Phase 4 may be split into sequential sub-features if the diff becomes large. These are sub-features inside Phase 4, not additional phases. Complete timeline, setup ease, recent PR sample, and same-label sample sequentially. After each sub-feature, run targeted tests before continuing. If a sub-feature starts to create UI clutter, API overuse, or broad diff risk, stop and ask the user whether to defer the remaining Phase 4 sub-features.

## Explicit Non-Scope

Do not implement:

- Backend.
- OAuth.
- AI.
- Deep repo history scan.
- Enrichment for every search result.
- Automatic result reordering after enrichment.
- Writing to GitHub.
- Clone/fork/test commands.
- Heavy UI redesign.

## Likely Files

Create as needed:

- `src/api/issueTimeline.js`
- `src/api/repoSetup.js`
- `src/api/repoHistory.js`
- `test/issue-timeline.test.js`
- `test/repo-setup.test.js`
- `test/repo-history.test.js`

Modify:

- `src/matchScore.js`
- `test/match-score.test.js`
- `src/main.js`
- `src/state/store.js`
- `src/api/github.js` if shared helpers are needed
- `STATE.md`

## Implementation Checklist

- [ ] Inspect Phase 3 enrichment cache shape.
- [ ] Extend enrichment cache without breaking comment summaries.
- [ ] Implement timeline sub-feature first.
- [ ] Add timeline fetch helper.
- [ ] Add timeline summary:
  - linked PR evidence.
  - cross-referenced PR.
  - assigned/unassigned events.
  - closed/reopened context.
  - duplicate/blocked references if visible.
- [ ] Add score rows for strong linked PR/claimed work evidence.
- [ ] Run targeted timeline tests before continuing.
- [ ] Implement repo setup sub-feature second.
- [ ] Add repo setup helper.
- [ ] Fetch/check public repo files conservatively:
  - README
  - CONTRIBUTING
  - package files
  - lock/config files
  - `.github/workflows`
- [ ] Do not fetch large file bodies unnecessarily.
- [ ] Summarize setup evidence:
  - setup docs present.
  - test/build hints present.
  - workflows present.
  - setup unclear.
- [ ] Add Setup Ease mini-score updates.
- [ ] Run targeted setup tests before continuing.
- [ ] Implement recent PR sample sub-feature third.
- [ ] Add recent PR sample helper.
- [ ] Sample a small number of recent closed/merged PRs.
- [ ] Summarize repo merge activity.
- [ ] Run targeted PR sample tests before continuing.
- [ ] Implement same-label issue sample sub-feature fourth.
- [ ] Add same-label issue sample helper.
- [ ] Sample small recent issue set for candidate labels.
- [ ] Summarize whether labels look active or stale.
- [ ] Update Repo Health and Opportunity Fit rows from repo history evidence.
- [ ] Add rate-limit-aware sequencing.
- [ ] Inspector should show progressive enrichment states, not a frozen panel.
- [ ] Add tests for each helper and scoring impact.
- [ ] Update UI screenshots.
- [ ] Update `STATE.md`.

## Tests

Required tests:

- Timeline URL construction and sanitization.
- Timeline summary for linked PR evidence.
- Timeline summary does not over-penalize weak references.
- Repo setup detection:
  - README present.
  - CONTRIBUTING present.
  - workflow present.
  - config/test hints present.
  - missing setup files.
- Recent PR sample:
  - recent merged PRs increase repo health confidence.
  - no recent merged PRs keeps or lowers confidence.
- Repo-aware labels:
  - active same-label history improves confidence/opportunity.
  - stale label sample lowers confidence/opportunity.
- Enrichment cache remains compact.
- Enrichment cache excluded from export.
- Rate-limit errors are non-blocking.

Run after each sub-feature where practical:

```powershell
npm test
```

Run full phase gates before stopping:

```powershell
npm test
npm run build
git diff --check
```

## UI/Screenshot Checks

Affected screens:

- Inspector progressive enrichment.
- Inspector final enriched score.
- Inspector setup ease mini-score.
- Inspector social risk mini-score.
- Inspector repo health mini-score.
- Mobile inspector.

Minimum screenshot matrix:

```text
1920x1080: inspector final enriched state
390x844: inspector final enriched state
375x667: inspector loading/error state
```

If Profile or cards are affected by enriched cache display, include those screens too.

## Data Checks

- Confirm enrichment cache excludes tokens.
- Confirm enrichment cache is excluded from export.
- Confirm Clear All removes cache.
- Confirm token save/change/clear removes cache.
- Confirm private repositories and token-used unknown-visibility responses are not cached.
- Confirm old comment-only cache entries still load or are safely ignored.
- Confirm API fetch count stays within phase budget.

## Risks

- API usage can grow quickly.
- GitHub repo contents endpoints vary by repo/default branch.
- Timeline events can be noisy or incomplete.
- Repo-aware label quality from a small sample is heuristic.
- UI can become too dense if every enrichment detail is shown.
- Phase 4 is intentionally the highest-risk phase. Split internally and stop early if it begins to sprawl.

## Stop Condition

Stop Phase 4 after:

- Full verification passes.
- Inspector UI remains compact and readable.
- API/cache safety is inspected.
- `STATE.md` is updated.
- Stop and wait for user review.

---

## 11. Phase Gates

Every phase must end with full verification and stop.

Required gate commands:

```powershell
npm test
npm run build
git diff --check
```

Also inspect package scripts before relying on optional browser/layout tests:

```powershell
Get-Content -Raw package.json
```

Then run relevant existing browser/layout/screenshot tests when the phase affects UI:

```powershell
npm run test:layout
```

If README gallery screenshots or docs screenshots are affected, inspect package scripts and run the appropriate existing screenshot test.

Do not continue to the next phase after passing gates. Report results and wait for explicit user instruction.

---

## 12. Global Stop Conditions

Stop immediately and ask for direction if any of these happen:

- Tests fail and the cause is unclear after focused debugging.
- Build fails and the cause is unclear after focused debugging.
- UI screenshots show design drift, clutter, overlap, or mobile overflow.
- The diff becomes broad enough that it no longer maps cleanly to the requested phase.
- Storage shape becomes unclear or risks token/private-data leakage.
- Export/import compatibility is uncertain.
- GitHub API usage exceeds the phase budget.
- A phase requires backend/OAuth/AI to continue.
- Existing user changes conflict with the phase and cannot be safely preserved.
- You need to change package scripts.
- You need to redesign major layout surfaces.
- You need to continue into the next phase to make the current phase coherent.
- You believe commits, branches, pushes, or pull requests are required. Ask the user first.

---

## 13. Testing Matrix

Run these in each phase unless the phase is explicitly documentation-only:

```powershell
npm test
npm run build
git diff --check
```

Inspect package scripts:

```powershell
Get-Content -Raw package.json
```

Use existing browser/layout/screenshot tests when UI changes:

```powershell
npm run test:layout
```

Consider these existing tests depending on affected surface:

- `test/match-score.test.js`
- `test/contribution-brief.test.js`
- `test/profile.test.js`
- `test/local-data.test.js`
- `test/store-persistence.test.js`
- `test/ui-copy.test.js`
- `test/github-api-security.test.js`
- `test/github-query.test.js`
- `test/repo-metadata.test.js`
- `test/finder-store.test.js`
- `test/css-contract.test.js`
- `test/board-layout-a1.spec.cjs`
- `test/e2e-hardening.spec.cjs`

Do not assume targeted test command syntax works. If unsure, run `npm test`.

---

## 14. Screenshot Matrix

Use existing screenshots as design guardrails. Do not let the app drift into overbuilt UI.

### Phase 1A Screenshots

Phase 1A should not require screenshots unless visible UI changes accidentally occur.

### Phase 1B Screenshots

Desktop:

- Dashboard if score chips appear there.
- Find Contributions initial/results.
- Inspector.
- Profile preferences.
- Settings export/import if copy changed.

Mobile:

- Find Contributions `390x844`.
- Inspector `390x844`.
- Profile `390x844`.
- Profile `375x667`.

### Phase 2 Screenshots

Desktop:

- Profile feedback summary.
- Inspector score rows with feedback.
- Board if movement UI/copy changed.

Mobile:

- Profile `390x844`.
- Inspector `390x844`.

### Phase 3 Screenshots

Desktop:

- Inspector loading.
- Inspector enriched comments state.
- Inspector enrichment error.

Mobile:

- Inspector enriched state `390x844`.
- Inspector error/low confidence `375x667`.

### Phase 4 Screenshots

Desktop:

- Inspector final advanced enriched state.
- Inspector setup ease/social risk/repo health mini-scores.

Mobile:

- Inspector final enriched state `390x844`.
- Inspector loading/error state `375x667`.

### Visual Acceptance Criteria

- No horizontal page overflow.
- No clipped buttons.
- No incoherent text overlap.
- No unreadable select/options.
- Cards remain compact.
- Inspector remains scannable.
- Profile preferences do not look like a heavy onboarding wizard.
- Existing dark UI and semantic colors remain.
- No decorative gradients/orbs.
- No marketing-style hero changes.

---

## 15. Fresh-Agent Startup Instructions

A fresh agent starting from this plan must:

1. Read `AGENTS.md`.
2. Read `PLAN.md`.
3. Read `STATE.md`.
4. Run `git status --short`.
5. Inspect `package.json`.
6. Inspect the files listed in section 2 for the requested phase.
7. Confirm which `/goals` phase was requested: Phase 1A, Phase 1B, Phase 2, Phase 3, or Phase 4.
8. Execute only that phase.
9. Use tests-first implementation for behavior changes.
10. Keep diffs scoped to the phase.
11. Do not create commits, branches, pushes, or pull requests unless the user explicitly asks.
12. Run full phase gates.
13. Update `STATE.md` with:
    - what changed
    - tests run
    - build result
    - screenshot/browser validation
    - known risk
14. Stop after the phase and report results.

Do not create a new worktree. Work inside the current branch/workspace.

---

## 16. `/goals` Prompts

### Audit Prompt

```text
/goals
Objective: Audit the Match Score full-system plan before implementation. Read AGENTS.md, PLAN.md, STATE.md, package.json, src/matchScore.js, src/main.js, src/profile.js, src/localData.js, src/state/store.js, and relevant tests. Do not edit files. Report whether PLAN.md is coherent, phase-bounded, compatible with current architecture, and missing safety/test/UI/data checks. Verify Phase 1A/1B boundaries, preview confidence, feedback idempotency, and enrichment cache privacy. Stop after audit.
```

### Phase 1A Prompt

```text
/goals
Objective: Execute Phase 1A only from PLAN.md: Match Score v3 Core Data. Add structured calculateMatchScore output, fixed confidence caps, miniScores, personalFit, contributionPreferences storage, store/data wiring, export/import support, Clear All/Clear Token behavior, and tests. Do not implement Profile preference UI, card confidence chips, inspector mini-score UI, local feedback, or GitHub enrichment. Prove strong hydrated preview issues can still score above 90 without comments/setup/timeline enrichment. Test malicious preference imports drop token/private/cache fields. Run npm test, npm run build, git diff --check, update STATE.md, and stop.
```

### Phase 1B Prompt

```text
/goals
Objective: Execute Phase 1B only from PLAN.md: Match Score v3 UI. Add Profile contribution preferences UI, compact card confidence chip, inspector stage/confidence/mini-score section, UI/copy tests, and required screenshots/layout checks using the Phase 1A data contract. Do not change scoring rules except to pass/read existing Phase 1A fields. Do not implement local feedback or GitHub enrichment. Run npm test, npm run build, git diff --check, npm run test:layout or relevant UI smoke, update STATE.md, and stop.
```

### Phase 2 Prompt

```text
/goals
Objective: Execute Phase 2 only from PLAN.md: Local Feedback Learning. Add idempotent compact local feedback storage from Save, Working, Passed, Merged, Hide issue, and Hide repo actions. Use event markers as durable source of truth and recompute totals/buckets from markers; do not mutate aggregate counters as durable truth. Feed transparent capped feedback rows into Match Score. Include feedback in export/import, preserve token exclusion, add Profile reset/summary, verify storage and UI. Do not implement GitHub enrichment. Run full phase gates, update STATE.md, and stop.
```

### Phase 3 Prompt

```text
/goals
Objective: Execute Phase 3 only from PLAN.md: Lazy Inspector Enrichment, comments first. Add inspector-only read-only GitHub issue comment enrichment with compact public-only cached summaries, loading/error UI, confidence updates, and cautious social-risk score rows. Do not cache private repos or token-used unknown-visibility results. Clear enrichment cache on token save/change/clear. Do not fetch timeline events, repo setup files, PR samples, or label history. Run full phase gates, mocked UI checks, update STATE.md, and stop.
```

### Phase 4 Prompt

```text
/goals
Objective: Execute Phase 4 only from PLAN.md: Advanced Enrichment. Add inspector-only cached read-only enrichment for issue timeline events, repo setup ease, recent PR sample, and same-label repo sample. Work sequentially and split internal sub-features if diff/API/UI risk grows. Keep cache compact, public-only, cleared on token save/change/clear, and excluded from export. Run full phase gates, screenshot checks, update STATE.md, and stop.
```

---

## 17. Final Instruction For Implementing Agents

Implementing agents must execute only the phase requested by `/goals` and must not continue to the next phase or checkpoint without explicit user instruction.
