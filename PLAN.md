# PR Dashboard UX Fix Plan

## Summary
PR Dashboard has a strong product concept and a polished dark visual language, but the current UI asks users to process too many sections, badges, counters, and empty containers before they know what to do. The existing scorecard is directionally correct: scoring, contribution briefs, action plans, Help, and rate-limit tracking are strong; density, inspector overload, chip noise, empty board lanes, profile scope creep, and heavy Find Contributions chrome are the main blockers. This plan keeps the core primitives and rebuilds the app around faster contribution decisions: compressed search results, a tabbed inspector, consistent state, clearer scoring language, and quieter secondary pages.

Screen audit scores used for prioritization:

| Screen | Score | Reason |
|---|---:|---|
| Find Contributions — main search/results | 6.8/10 | Core flow is clear, but H1 + tabs + search + query preview + presets + filters create too much pre-result chrome. |
| Find Contributions — scrolled result grid | 6.4/10 | Useful results, but cards are visually similar, chip-heavy, and hard to scan after the first row. |
| Find Contributions — rate-limit popover | 7.0/10 | Useful power-user feature; needs cleaner anchoring, lighter placement, and a clearer depleted-state path. |
| Find Contributions — review reminders popover | 6.5/10 | Useful concept, but the empty popover feels detached from the flow and wastes a top-right overlay. |
| Settings — GitHub token setup | 7.2/10 | Security copy is good; persistence wording is conflicting and the form is larger than the decision requires. |
| Settings — hidden results / danger zone | 6.6/10 | Complete, but import/export is duplicated elsewhere and destructive actions need stronger hierarchy. |
| Profile — top / preferences | 6.4/10 | Preferences are useful, but Profile is carrying settings, stats, learned feedback, proof log, and reminders. |
| Profile — lower / proof log / reminders | 6.2/10 | Several empty sections stacked together make the page feel unfinished and heavier than it is. |
| Dashboard overview | 7.0/10 | Good first-run direction and card layout; state appears inconsistent with Board/Profile and empty states are too generic. |
| Find Contributions — saved item state | 6.7/10 | “View on board” is helpful; chips and actions still compete for attention. |
| Board / Kanban | 5.9/10 | One saved card is lost in a huge empty seven-lane layout; empty columns dominate the screen. |
| Inspector — action center / issue description | 6.1/10 | Valuable content, but the drawer exposes too much raw issue text and too many sections at once. |
| Inspector — score diagnostics / contribution brief | 6.2/10 | The scoring model is strong; its presentation competes with the actual recommendation. |
| Inspector — why score / action plan | 6.0/10 | Action checklist is useful; scroll position, density, and split panels make the decision feel like work. |
| Help | 8.1/10 | Clear, compact, and well structured. Treat as the model for secondary pages. |
| Feedback | 7.8/10 | Direct and functional. Minor polish: prefilled issue body, stronger keyboard behavior, and clearer CTA feedback. |

## Priority fixes (sorted Critical → Low)

### Critical — Rebuild the inspector as a decision drawer, not a document dump
- **Problem:** The inspector is the biggest UX failure. It stacks header metadata, action center, comments, advanced context, full issue description, score diagnostics, mini-scores, contribution brief, risk, “why this score,” and an action plan into one long scrollable drawer. This matches the existing feedback that the inspector is doing too much, but the deeper issue is decision sequencing: the user sees evidence, raw issue text, and actions in no stable priority order.
- **Screen(s) affected:** Inspector drawer states, Find Contributions with drawer open.
- **Files likely involved:** `src/components/IssueInspector.tsx`, `src/components/ScoreDiagnostics.tsx`, `src/components/ContributionBrief.tsx`, `src/components/ActionPlan.tsx`, `src/components/IssueDescription.tsx`, `src/components/InspectorHeader.tsx`, `src/styles/inspector.css`, `src/lib/score.ts`.
- **Implementation:** Replace the single long drawer with three tabs: `Overview`, `Evidence`, and `Action`. Make `Overview` the default and show only: verdict, match strength, confidence, first move, top 3 reasons, top risk, and primary actions. Move score breakdown, mini-scores, comments, advanced context, repo history, and setup context into `Evidence`. Move checklist, full issue body, GitHub open action, and saved/board actions into `Action`. Keep the title/header sticky and keep the current tab state in URL search params so reload/back works.

  Code hint:

  ```tsx
  const INSPECTOR_TABS = ["overview", "evidence", "action"] as const;
  type InspectorTab = (typeof INSPECTOR_TABS)[number];

  function IssueInspector({ issue }: { issue: IssueCandidate }) {
    const [tab, setTab] = useQueryState<InspectorTab>("inspectorTab", "overview");

    return (
      <aside className="inspector" aria-label="Issue inspector">
        <InspectorHeader issue={issue} />
        <InspectorTabs value={tab} onChange={setTab} />
        {tab === "overview" && <InspectorOverview issue={issue} />}
        {tab === "evidence" && <InspectorEvidence issue={issue} />}
        {tab === "action" && <InspectorAction issue={issue} />}
      </aside>
    );
  }
  ```

  Use Impeccable for this pass: run a polish pass on the rebuilt drawer after the tab split, specifically asking it to reduce nested cards, tighten section hierarchy, and preserve the “First Move” clarity.
- **Acceptance criteria:** A user can open an issue and decide “save, hide, open on GitHub, or pass” without scrolling. `Overview` fits above the fold at 1440px wide. The full raw issue description is not visible until the user selects `Action` or expands “Issue details.” The drawer has one primary action, one secondary action group, and no duplicated confidence badges.

### Critical — Fix local state consistency across Dashboard, Board, Profile, and search cards
- **Problem:** The screenshots show inconsistent state language and counts: Board has a saved card, Find Contributions can show “View on board,” learned feedback says “Saved to board 1,” while Dashboard/Profile counters can still show zero saved candidates. Even if this is caused by screenshot timing, the product needs a single source of truth for saved candidates, active board work, proof log, hidden items, and learned feedback. Mismatched local state destroys trust faster than visual density.
- **Screen(s) affected:** Dashboard, Board, Profile, Settings hidden results, Find Contributions result cards, inspector action center.
- **Files likely involved:** `src/lib/localStore.ts`, `src/lib/boardStore.ts`, `src/lib/profileStore.ts`, `src/lib/selectors.ts`, `src/pages/Dashboard.tsx`, `src/pages/Profile.tsx`, `src/pages/Board.tsx`, `src/components/IssueCard.tsx`, `src/components/IssueInspector.tsx`.
- **Implementation:** Create canonical selectors for all local state metrics and use them everywhere. Do not compute counts independently inside page components. Define clear terms: `savedCandidates` should mean all saved board cards, `activeBoardWork` should mean saved cards in active lanes, `proofLogEntries` should mean completed/merged/pass records, and `hiddenResults` should mean hidden issues + hidden repos.

  Code hint:

  ```ts
  export function selectDashboardMetrics(state: LocalAppState) {
    const boardCards = Object.values(state.board.cardsById ?? {});
    const activeCards = boardCards.filter(card => ACTIVE_LANES.includes(card.status));
    const completedCards = boardCards.filter(card => COMPLETED_LANES.includes(card.status));

    return {
      savedCandidates: boardCards.length,
      activeBoardWork: activeCards.length,
      resolvedOrPassed: completedCards.length,
      hiddenIssues: state.hidden.issues.length,
      hiddenRepos: state.hidden.repos.length,
      proofLogEntries: state.proofLog.entries.length,
      reviewReminders: state.reviewReminders.length,
    };
  }
  ```

  Add a simple reducer or Zustand/Context store test suite around these selectors. Any save/hide/move/import/clear action should update visible counts in all affected pages without refresh.
- **Acceptance criteria:** Saving one issue changes Dashboard saved candidates, Board lane count, Profile saved candidates, and result-card state consistently. Hiding one issue changes Dashboard hidden results and Settings hidden issue count consistently. Import/export round-trips without count drift. Add unit tests for save, unsave, hide, unhide, move, merge, pass, clear board, and clear all app data.

### High — Compress issue cards into scannable decision units
- **Problem:** Result cards carry too many chips: GitHub labels, match percentage, fit, confidence, and sometimes additional state labels. This matches the existing feedback that cards have 5–6 chips each, but the implementation fix should be stricter: default cards should show only the information needed to decide whether to inspect.
- **Screen(s) affected:** Find Contributions result list/grid, saved cards on Board, Dashboard saved candidates module, inspector background list.
- **Files likely involved:** `src/components/IssueCard.tsx`, `src/components/IssueCardMeta.tsx`, `src/components/ScoreBadge.tsx`, `src/components/LabelChips.tsx`, `src/components/Button.tsx`, `src/styles/cards.css`, `src/lib/score.ts`.
- **Implementation:** Make card hierarchy: repository + issue number, title, one-line summary, top reason, score row, action row. Show at most two default chips: match strength and confidence. Collapse GitHub labels into `+N labels` unless there is one highly meaningful label such as `good first issue` or `help wanted`. Move stars/forks/comments/assignee into a quiet metadata row. Standardize card height within each layout. Use either a full-width list or a true grid, not a hero card plus mixed grid unless the hero card has explicit “Top pick” treatment.

  Code hint:

  ```tsx
  const visibleLabels = pickPrimaryLabels(issue.labels, ["good first issue", "help wanted"]);
  const hiddenLabelCount = issue.labels.length - visibleLabels.length;

  <IssueCard>
    <IssueCardHeader repo={issue.repo} number={issue.number} updatedAt={issue.updatedAt} />
    <IssueTitle>{issue.title}</IssueTitle>
    <IssueSummary>{issue.summary}</IssueSummary>
    <TopReason>{issue.score.topReason}</TopReason>
    <ScoreRow>
      <MatchBadge score={issue.score.match} />
      <ConfidenceBadge value={issue.score.confidence} />
      {visibleLabels.map(label => <LabelChip key={label}>{label}</LabelChip>)}
      {hiddenLabelCount > 0 && <MutedChip>+{hiddenLabelCount} labels</MutedChip>}
    </ScoreRow>
    <IssueActions issue={issue} />
  </IssueCard>
  ```

  Use Impeccable to polish the card component once in isolation before touching the whole results page. Ask for better vertical rhythm, fewer badge colors, and stronger title/body contrast.
- **Acceptance criteria:** Default issue cards never show more than four chips total, including hidden label count. At 1440px width, a user can scan five cards without seeing repeated badge clutter. Cards have a consistent title/body/action structure across Find Contributions, Dashboard, and Board.

### High — Calibrate match scoring language so it feels trustworthy
- **Problem:** “100% Match,” “99% Match,” and repeated “Confidence: High” badges overstate precision and compete with the more useful “Verdict” and “First Move.” The product’s scoring is a differentiator, but the current presentation makes it feel algorithmically overconfident. Existing feedback praised the score system; the missed issue is trust calibration.
- **Screen(s) affected:** Find Contributions cards, inspector score diagnostics, contribution brief, Dashboard recommendations.
- **Files likely involved:** `src/lib/score.ts`, `src/lib/scoreLabels.ts`, `src/components/MatchBadge.tsx`, `src/components/ScoreDiagnostics.tsx`, `src/components/ContributionBrief.tsx`, `src/components/IssueCard.tsx`.
- **Implementation:** Replace raw percent-first language with strength-first language. Keep the numeric score available in diagnostics, but show cards as `Strong match`, `Good match`, `Possible match`, or `Skip`. In the inspector, show “94% match score” as supporting evidence, not the headline. Add visible cap reasons such as `Confidence capped: medium because comment thread may indicate active work`.

  Code hint:

  ```ts
  export function getMatchLabel(score: number) {
    if (score >= 90) return "Strong match";
    if (score >= 75) return "Good match";
    if (score >= 55) return "Possible match";
    return "Skip";
  }

  export function getConfidenceExplanation(candidate: CandidateScore) {
    return candidate.caps.length
      ? `Confidence capped: ${candidate.caps[0].reason}`
      : "No confidence caps found";
  }
  ```

  Show the top negative factor on cards only when it materially changes action, for example `Risk: possible active work`.
- **Acceptance criteria:** Search cards do not display raw 99–100% as the dominant badge. The inspector still exposes exact scoring in `Evidence`. Every confidence cap has a human-readable explanation. Users can tell the difference between “high score” and “safe to start.”

### High — Simplify Find Contributions header and filter architecture
- **Problem:** The Find Contributions screen has five rows before results: page title, mode tabs, search input, GitHub query preview, and preset buttons. Then a second filter system appears in the left column. This matches the existing feedback that the header chrome is heavy. The deeper IA issue is that query controls, filters, presets, and sort are spread across too many places.
- **Screen(s) affected:** Find Contributions, global top bar, result toolbar, filter sidebar.
- **Files likely involved:** `src/pages/FindContributions.tsx`, `src/components/SearchHero.tsx`, `src/components/GlobalSearch.tsx`, `src/components/FilterSidebar.tsx`, `src/components/QueryPreview.tsx`, `src/components/PresetButtons.tsx`, `src/components/ResultsToolbar.tsx`, `src/styles/search.css`.
- **Implementation:** On the Find Contributions route, hide or demote the global top search so there is one obvious search input. Move preset buttons into the filter sidebar as `Quick filters`. Collapse GitHub Query Preview into a `View GitHub query` disclosure in the result toolbar. Put active filters as removable chips above results, not as a tiny “Applied” pill next to the filter heading. Make filters live-update if API cost is low; otherwise keep `Apply Filters` but add `Reset` and a dirty-state indicator.

  Proposed layout:

  ```text
  [Find your next contribution]
  [Search input.....................................][Search]

  [24 open issues] [Active filter chips...]                 [Sort]
  [Left filter rail] [Consistent result list/grid]
  ```

  Use Superpower to store a repeatable prompt chain for “Find Contributions before/after critique” so each iteration gets checked for header height, filter clarity, and card density.
- **Acceptance criteria:** Results begin at least 120px higher on the page at 1440px width. The query preview is hidden by default. Presets are grouped with filters. There is only one primary search input on the page.

### High — Make the Board useful when it is nearly empty
- **Problem:** The Board screen shows five active lanes plus two completed lanes, but with one card the UI is mostly empty vertical columns. Existing feedback says the board feels dead when empty; the stronger fix is to design an early-state board, not just a full kanban board with empty containers.
- **Screen(s) affected:** Board/Kanban, Dashboard active board module, Help board workflow copy.
- **Files likely involved:** `src/pages/Board.tsx`, `src/components/KanbanBoard.tsx`, `src/components/KanbanColumn.tsx`, `src/components/BoardCard.tsx`, `src/components/BoardEmptyState.tsx`, `src/styles/board.css`.
- **Implementation:** Add two board modes: `compact` for 0–3 active cards and `kanban` for 4+ active cards or user-selected expanded view. In compact mode, show a focused workflow rail: current cards first, collapsed empty lanes below, and a visible “Next stage” control on each card. Empty lanes should be 48–64px high with counts, not full-height columns. Add lane-level empty copy only when useful: `Read docs: move a card here after opening README/CONTRIBUTING`.

  Code hint:

  ```tsx
  const activeCount = boardCards.filter(card => ACTIVE_LANES.includes(card.status)).length;
  const boardMode = userBoardMode ?? (activeCount <= 3 ? "compact" : "kanban");
  ```

  Use Impeccable to polish compact board empty states. This is a good candidate for visual-system refinement because empty-state hierarchy is mostly spacing, copy, and contrast.
- **Acceptance criteria:** With one saved card, the saved card is visually dominant, not a tiny object inside a large empty canvas. Empty lanes collapse in compact mode. Users can move a card to the next stage without opening a large inspector.

### High — Split Profile, Activity, and Settings responsibilities
- **Problem:** Profile is doing too much: user identity, stats, contribution preferences, learned feedback, proof log, review reminders, export/import copy, and reset actions. Existing feedback correctly calls this profile scope creep. The missed issue is duplication: export/import appears in both Profile and Settings, and learned feedback sounds like system internals rather than user profile.
- **Screen(s) affected:** Profile, Settings, Dashboard, sidebar navigation.
- **Files likely involved:** `src/pages/Profile.tsx`, `src/pages/Settings.tsx`, `src/pages/Activity.tsx`, `src/components/ProfilePreferences.tsx`, `src/components/LearnedFeedback.tsx`, `src/components/ProofLog.tsx`, `src/components/ReviewReminders.tsx`, `src/components/LocalDataPanel.tsx`, `src/components/Sidebar.tsx`.
- **Implementation:** Make Profile only about identity, contribution preferences, and high-level stats. Move `Export Local Data`, `Import Local Data`, hidden results, token setup, and danger zone exclusively to Settings. Move `Learned feedback`, `Proof Log`, and `Review reminders` into either a new `Activity` route or a tab inside Profile labeled `Activity`. Rename “Learned feedback” to “Personal scoring signals” if it remains visible; otherwise collapse it behind an advanced disclosure.

  Proposed IA:

  ```text
  Dashboard
  Find Contributions
  Board
  Profile
    - Preferences
    - Personal fit summary
  Activity
    - Proof log
    - Review reminders
    - Scoring signals
  Settings
    - GitHub token
    - Hidden results
    - Import/export
    - Danger zone
  Help
  Feedback
  ```

  Use Superpower to save a reusable “IA regression checklist” prompt: verify one owner for each concept, no duplicate import/export, and no settings-only controls on profile.
- **Acceptance criteria:** Import/export controls exist in one place. Profile fits into one vertical screen at 1440px after preferences are saved. Proof Log and Review Reminders are not empty blocks stacked under Profile by default. Sidebar labels map to user mental models, not implementation concepts.

### Medium — Create a visual-density system instead of one-off card tweaks
- **Problem:** The app is visually consistent but dense. The issue is not just “too much text”; it is uneven type scale, too many bordered containers, nested cards, repeated badges, and low-contrast metadata competing with primary labels. The existing scorecard gave clarity/density the lowest score; this fix turns that feedback into a reusable system.
- **Screen(s) affected:** All screens, especially Find Contributions, Inspector, Profile, Settings, and Board.
- **Files likely involved:** `src/styles/tokens.css`, `src/styles/theme.css`, `src/components/ui/Card.tsx`, `src/components/ui/Badge.tsx`, `src/components/ui/Button.tsx`, `src/components/ui/Section.tsx`, `src/components/ui/EmptyState.tsx`, `src/components/ui/FormField.tsx`.
- **Implementation:** Define density tokens and enforce them through shared components. Use one default card padding, one compact card padding, one section gap scale, and one badge height scale. Reduce bordered boxes inside bordered boxes. Limit accent color usage to active navigation, primary CTA, match/confidence, and destructive states. Treat green as confirmation/success only; do not use green for every “good” informational thing.

  Code hint:

  ```css
  :root {
    --space-section: 24px;
    --space-card: 16px;
    --space-card-compact: 12px;
    --radius-card: 12px;
    --font-size-body: 14px;
    --font-size-meta: 12px;
    --line-height-body: 1.45;
    --border-subtle: color-mix(in srgb, var(--color-border) 70%, transparent);
  }

  .card { padding: var(--space-card); border-radius: var(--radius-card); }
  .card--compact { padding: var(--space-card-compact); }
  .section + .section { margin-top: var(--space-section); }
  ```

  Use Impeccable after token cleanup, not before. First teach/document the visual system, then run polish passes on Find Contributions, Inspector, Board, and Profile one at a time.
- **Acceptance criteria:** Shared components own spacing and density. No page uses custom ad-hoc card padding unless justified. Card interiors have fewer nested borders. Metadata is visually quieter than titles and actions. A screenshot contact sheet should show calmer hierarchy without reducing feature depth.

### Medium — Improve accessibility, keyboard flow, and readable contrast
- **Problem:** The dark theme is polished, but many labels, chips, counts, and metadata appear very small. Drawer and popover interactions also need explicit keyboard behavior. This was not emphasized enough in the existing feedback and should be fixed before the app grows.
- **Screen(s) affected:** All screens; highest risk in Inspector, Find Contributions cards, Settings token field, Board columns, popovers.
- **Files likely involved:** `src/components/ui/*`, `src/components/IssueInspector.tsx`, `src/components/Popover.tsx`, `src/components/Dialog.tsx`, `src/styles/a11y.css`, `src/styles/tokens.css`, `src/tests/a11y/*`.
- **Implementation:** Increase default body text to at least 14px and set line-height around 1.45. Keep metadata at 12px but avoid long metadata sentences at 12px. Add visible focus rings for buttons, chips, links, checkboxes, drawer close, and popover controls. Add focus trap and Escape close for inspector drawer and popovers. Ensure destructive buttons announce confirmation dialogs. Run axe or Testing Library accessibility checks for top routes.

  Code hint:

  ```css
  :focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }

  .text-body { font-size: 14px; line-height: 1.45; }
  .text-meta { font-size: 12px; line-height: 1.35; color: var(--color-text-muted); }
  ```

- **Acceptance criteria:** All interactive controls are keyboard reachable. Inspector and popovers trap focus and close with Escape. Text-heavy cards pass contrast checks. The app remains usable at browser zoom 125% without horizontal clipping in the main workflow.

### Medium — Clarify token persistence and security copy
- **Problem:** Settings says local session storage is default, warns that localStorage is not secure for secrets, then offers “Remember token locally.” The logic is understandable to the builder, but the user-facing model is muddled: session-only vs persistent browser storage must be explicit.
- **Screen(s) affected:** Settings GitHub token setup, Help privacy card, Feedback warning copy if token-related bug reports are filed.
- **Files likely involved:** `src/pages/Settings.tsx`, `src/components/GitHubTokenSettings.tsx`, `src/components/SecurityNotice.tsx`, `src/lib/tokenStorage.ts`, `src/lib/github.ts`.
- **Implementation:** Rename the checkbox to `Persist token in this browser`. Add a short helper: `Off: token clears when this browser session ends. On: token is stored in localStorage on this machine.` Only show the red localStorage warning when the persistent option is enabled, or clearly label it as applying only to persistence. Add a small “Recommended” label to session-only mode. Keep the “No private scopes needed” card.

  Code hint:

  ```tsx
  <CheckboxField
    checked={persistToken}
    onChange={setPersistToken}
    label="Persist token in this browser"
    description="Off clears the token at the end of this browser session. On stores it in localStorage on this machine."
  />
  {persistToken && <SecurityWarning variant="danger" />}
  ```

- **Acceptance criteria:** A user can explain where the token lives in one sentence. The warning does not appear to contradict the default storage behavior. The token field, reveal button, save button, and test connection state are keyboard accessible.

### Medium — Redesign Settings danger zone for safer destructive actions
- **Problem:** The danger zone is complete but visually repetitive: four red bordered rows with similar button placement. It is easy to scan past the difference between clearing a token, clearing board data, clearing hidden items, and clearing everything. Destructive actions should be rarer, clearer, and harder to misfire.
- **Screen(s) affected:** Settings lower screen.
- **Files likely involved:** `src/components/SettingsDangerZone.tsx`, `src/components/ConfirmDialog.tsx`, `src/lib/localStore.ts`, `src/styles/settings.css`.
- **Implementation:** Group danger actions into two levels: common resets and irreversible full reset. Use neutral rows until the user opens/arms a destructive action; reserve red fill/border for the armed state and confirmation dialog. Require typed confirmation for `Clear all app data`. Add exact consequences in each modal. Keep `Clear hidden items` outside the most severe group because it is reversible in spirit and less dangerous.

  Code hint:

  ```tsx
  <DangerAction
    severity="critical"
    label="Clear all app data"
    requirePhrase="CLEAR ALL"
    consequences={["Removes GitHub token settings", "Removes board cards", "Removes profile preferences", "Removes proof log"]}
  />
  ```

- **Acceptance criteria:** `Clear all app data` requires typed confirmation. Less destructive actions are visually distinct from total reset. Each confirmation modal states what is kept and what is removed.

### Medium — Make popovers useful without obscuring the workflow
- **Problem:** The rate-limit and review-reminders popovers are useful ideas, but they appear as floating panels in the top-right and compete with the main result list. The empty review-reminders popover is especially weak because it consumes attention to say nothing is happening.
- **Screen(s) affected:** Header rate limits, review reminders popover, Dashboard review reminder card, Profile/Activity review reminders.
- **Files likely involved:** `src/components/Header.tsx`, `src/components/RateLimitPopover.tsx`, `src/components/ReviewRemindersPopover.tsx`, `src/components/Popover.tsx`, `src/lib/githubRateLimit.ts`, `src/lib/reviewReminders.ts`.
- **Implementation:** Anchor popovers to their trigger with collision-aware positioning. For empty reminders, use a compact empty state with one sentence and one link to Board or Activity; do not show a large panel. For rate limits, show a compact badge in the header (`Search 26 left`) and make the popover focus on “what happens next” if low: reset time, reduce calls, or refresh from Board only.
- **Acceptance criteria:** Popovers do not cover primary result actions at common desktop widths. Empty reminder state is compact. Escape closes popovers. Rate limit low/depleted states have actionable copy.

### Low — Keep Help and Feedback simple, but wire them into the workflow
- **Problem:** Help and Feedback are among the cleanest screens. They do not need redesign. They need small integration improvements so they support the main workflow without becoming documentation dumps.
- **Screen(s) affected:** Help, Feedback, footer sidebar links, inspector feedback path.
- **Files likely involved:** `src/pages/Help.tsx`, `src/pages/Feedback.tsx`, `src/components/FeedbackChecklist.tsx`, `src/lib/githubIssuePrefill.ts`, `src/components/Sidebar.tsx`.
- **Implementation:** Keep Help as four compact cards. Add one “Start with Find Contributions” CTA only if the user has zero saved cards. On Feedback, make each checklist item copyable into the prefilled GitHub issue body. Include browser/viewport automatically when possible, but never include token or private data. Add a “Copy diagnostic summary” button with sanitized app version, route, viewport, and local-state counts.
- **Acceptance criteria:** Help remains one screen with four cards. Feedback opens a GitHub issue with a structured body. No token value, raw Authorization header, or private repo metadata appears in copied diagnostics.

### Low — Tighten empty states across Dashboard, Profile, Board, and Activity
- **Problem:** Empty sections often say “nothing yet,” but they do not always tell the user the next useful action. The Dashboard is close; Profile and Board need more specific empty states.
- **Screen(s) affected:** Dashboard, Profile, Board, Activity/Proof Log, Review Reminders.
- **Files likely involved:** `src/components/EmptyState.tsx`, `src/pages/Dashboard.tsx`, `src/pages/Profile.tsx`, `src/pages/Board.tsx`, `src/pages/Activity.tsx`.
- **Implementation:** Create a shared `EmptyState` component with `title`, `body`, optional `primaryAction`, optional `secondaryAction`, and `variant`. Use route-specific copy. Avoid stacking multiple large empty boxes on the same page; collapse secondary empty sections into small rows.

  Code hint:

  ```tsx
  <EmptyState
    title="No proof log entries yet"
    body="Move a board card to Merged to preserve completed work."
    primaryAction={{ label: "View board", href: "/board" }}
    variant="compact"
  />
  ```

- **Acceptance criteria:** No page shows more than one large empty-state box at a time. Each empty state tells the user what creates the first item. Dashboard, Profile, Board, and Activity use the same component.

## What NOT to change
- Keep the dark theme and purple accent. They are coherent and give the app a distinct product feel.
- Keep the scoring model and explainability. “Why this score?” with positive and negative factors is a real differentiator; just move it into a calmer evidence layer.
- Keep the Contribution Brief, especially `Verdict` and `First Move`. That is the clearest product insight in the app.
- Keep the Action Plan checklist. It turns browsing into execution and should remain visible in the inspector, just not buried in a long scroll.
- Keep the API rate-limit tracker. It is practical and makes the app feel honest about GitHub constraints.
- Keep the Help page’s compact four-card structure. It is the clearest secondary screen and should be the reference for future support content.
- Keep local-first privacy posture. The product benefits from being explicit that board cards, hidden results, preferences, learned feedback, and proof log are local.
- Keep the Feedback checklist concept. It is simple and actionable; only improve the prefill and sanitized diagnostic support.
